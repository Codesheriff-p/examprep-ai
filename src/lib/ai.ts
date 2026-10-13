import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { TUTOR_MODES, type TutorMode } from "@/lib/tutor-modes";
import { AIError, type ChatTurn, type NoteDoc } from "@/lib/ai-shared";
import {
  offlineFlashcards,
  offlineGrade,
  offlineQuiz,
  offlineStudyGuide,
  offlineStudyPlan,
  offlineTutorReply,
} from "@/lib/offline-ai";

export { AIError, type NoteDoc };

/**
 * All Claude calls live in this file. Each feature sends the student's notes as the
 * first (cached) system block, so quiz generation, grading, flashcards, planning and
 * the tutor all reuse the same prompt-cache prefix for a course.
 *
 * Without an API key every feature falls back to the offline engine in offline-ai.ts,
 * which builds the same outputs from the notes with plain text analysis.
 */

let anthropic: Anthropic | undefined;

/** True when a Claude API key is configured; otherwise the offline engine is used. */
export function claudeEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function client() {
  return (anthropic ??= new Anthropic());
}

export const MODEL = "claude-opus-5-5";

// If a request is declined by a safety classifier, the API retries it on a fallback
// model inside the same call instead of failing the student's request.
const FALLBACK: Pick<Anthropic.Beta.MessageCreateParams, "betas" | "fallbacks"> = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
};

// ~2M characters is roughly 500K tokens: well inside the 1M context window while
// leaving room for chat history and output.
const MAX_NOTES_CHARS = 2_000_000;

function notesBlock(docs: NoteDoc[]): Anthropic.Beta.BetaTextBlockParam {
  if (docs.length === 0) {
    throw new AIError("Upload some notes for this course first.");
  }
  const text = docs
    .map((d) => `<document title="${d.title.replace(/"/g, "'")}">\n${d.content}\n</document>`)
    .join("\n\n");
  if (text.length > MAX_NOTES_CHARS) {
    throw new AIError(
      "This course's notes are too large to send in one request. Remove or split some documents and try again.",
    );
  }
  return {
    type: "text",
    text: `The student's course notes:\n\n<notes>\n${text}\n</notes>`,
    cache_control: { type: "ephemeral" },
  };
}

function system(docs: NoteDoc[], instructions: string): Anthropic.Beta.BetaTextBlockParam[] {
  return [notesBlock(docs), { type: "text", text: instructions }];
}

/** Turns SDK errors into messages a student can act on. */
export function describeAIError(err: unknown): string {
  if (err instanceof AIError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) {
    return "The Claude API key is missing or invalid. Set ANTHROPIC_API_KEY in .env.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Claude is busy right now. Wait a moment and try again.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    return `Claude rejected the request: ${err.message}`;
  }
  if (err instanceof Anthropic.APIError) {
    return `Claude API error (${err.status ?? "network"}). Try again shortly.`;
  }
  console.error(err);
  return "Something went wrong while talking to Claude.";
}

async function parse<T extends z.ZodType>(opts: {
  docs: NoteDoc[];
  instructions: string;
  prompt: string;
  schema: T;
  effort: "low" | "medium" | "high";
}): Promise<z.infer<T>> {
  const response = await client().beta.messages.parse({
    ...FALLBACK,
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: opts.effort, format: betaZodOutputFormat(opts.schema) },
    system: system(opts.docs, opts.instructions),
    messages: [{ role: "user", content: opts.prompt }],
  });
  if (response.stop_reason === "refusal") {
    throw new AIError("Claude declined this request. Try rephrasing or using different notes.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new AIError("Claude's answer was cut off. Try asking for fewer items.");
  }
  return response.parsed_output;
}

// ---------------------------------------------------------------- Quizzes

const QuizSchema = z.object({
  title: z.string().describe("Short descriptive quiz title"),
  questions: z.array(
    z.object({
      type: z.enum(["mcq", "short"]),
      prompt: z.string(),
      options: z.array(z.string()).describe("4 options for mcq; empty for short"),
      correctIndex: z.number().int().describe("Index of the correct option for mcq; -1 for short"),
      modelAnswer: z.string().describe("The ideal answer, used for grading"),
      explanation: z.string().describe("Why the answer is correct, referencing the notes"),
      topic: z.string().describe("Short topic label, reused consistently across questions"),
    }),
  ),
});

export type GeneratedQuestion = z.infer<typeof QuizSchema>["questions"][number];

export async function generateQuiz(opts: {
  docs: NoteDoc[];
  count: number;
  difficulty: "easy" | "medium" | "hard";
  format: "mcq" | "short" | "mixed";
  focusTopics: string[];
  existingTopics: string[];
  /** "exam" writes a balanced paper that samples the whole syllabus, like a real exam. */
  purpose?: "practice" | "exam";
}) {
  if (!claudeEnabled()) return offlineQuiz(opts);

  const formatText = {
    mcq: "Use only multiple-choice questions.",
    short: "Use only short-answer questions.",
    mixed: "Use about 70% multiple-choice and 30% short-answer questions.",
  }[opts.format];

  const quiz = await parse({
    docs: opts.docs,
    effort: "medium",
    schema: QuizSchema,
    instructions: `You write exam practice questions from a student's own course notes.
Every question must be answerable from the notes; do not test material the notes don't cover.
Test understanding and application, not just recall of exact wording.
Multiple-choice questions have exactly 4 plausible options with one correct answer; vary the position of the correct option.
Short-answer questions should be answerable in 1-3 sentences.
Label each question with a short topic name. ${
      opts.existingTopics.length
        ? `Reuse these existing topic labels where they fit: ${opts.existingTopics.join(", ")}.`
        : ""
    }`,
    prompt:
      opts.purpose === "exam"
        ? `Write a ${opts.count}-question mock exam paper at ${opts.difficulty} difficulty. ${formatText}
Sample every major topic in the notes in proportion to how much the notes cover it, like a real exam paper would.
Order questions from easier to harder.`
        : `Write ${opts.count} ${opts.difficulty} questions. ${formatText}${
            opts.focusTopics.length
              ? ` The student is weak on: ${opts.focusTopics.join(", ")}. Put most questions on those topics.`
              : " Cover the notes broadly."
          }`,
  });

  const questions = quiz.questions.filter((q) =>
    q.type === "mcq"
      ? q.options.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.options.length
      : q.modelAnswer.trim().length > 0,
  );
  if (questions.length === 0) throw new AIError("Claude didn't produce any usable questions.");
  return { title: quiz.title, questions };
}

// ---------------------------------------------------------------- Grading

const GradeSchema = z.object({
  grades: z.array(
    z.object({
      id: z.string(),
      correct: z.boolean(),
      feedback: z.string().describe("1-2 sentences addressed to the student"),
    }),
  ),
});

export async function gradeShortAnswers(
  docs: NoteDoc[],
  items: { id: string; prompt: string; modelAnswer: string; response: string }[],
) {
  if (items.length === 0) return new Map<string, { correct: boolean; feedback: string }>();
  if (!claudeEnabled()) return offlineGrade(docs, items);

  const { grades } = await parse({
    docs,
    effort: "low",
    schema: GradeSchema,
    instructions: `You grade a student's short answers against a model answer and their course notes.
Mark an answer correct if it captures the key idea of the model answer, even when worded differently or incomplete in minor details.
Feedback is encouraging and specific: say what was right, and what was missing or wrong.`,
    prompt: `Grade each answer. Return one grade per id.\n\n${JSON.stringify(items, null, 2)}`,
  });

  return new Map(grades.map((g) => [g.id, { correct: g.correct, feedback: g.feedback }]));
}

// ---------------------------------------------------------------- Flashcards

const FlashcardSchema = z.object({
  cards: z.array(z.object({ front: z.string(), back: z.string(), topic: z.string() })),
});

export async function generateFlashcards(opts: {
  docs: NoteDoc[];
  count: number;
  focusTopics: string[];
  existingFronts: string[];
}) {
  if (!claudeEnabled()) return offlineFlashcards(opts);
  const { cards } = await parse({
    docs: opts.docs,
    effort: "low",
    schema: FlashcardSchema,
    instructions: `You make spaced-repetition flashcards from a student's course notes.
Each card tests one atomic fact, definition, or relationship. The front is a question or cue; the back is a concise answer (one or two sentences).
Avoid duplicating cards the student already has.`,
    prompt: `Make ${opts.count} flashcards.${
      opts.focusTopics.length ? ` Prioritise these weak topics: ${opts.focusTopics.join(", ")}.` : ""
    }${
      opts.existingFronts.length
        ? `\n\nExisting card fronts (don't repeat):\n${opts.existingFronts.slice(-200).join("\n")}`
        : ""
    }`,
  });
  return cards;
}

// ---------------------------------------------------------------- Study plan

const PlanSchema = z.object({
  summary: z.string().describe("2-3 sentence overview of the strategy"),
  days: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD"),
      tasks: z.array(
        z.object({
          title: z.string(),
          details: z.string(),
          topic: z.string(),
          minutes: z.number().int(),
          kind: z.enum(["review", "practice", "flashcards", "mock"]),
        }),
      ),
    }),
  ),
});

export async function generateStudyPlan(opts: {
  docs: NoteDoc[];
  courseTitle: string;
  startDate: string;
  endDate: string;
  examDate: string | null;
  minutesPerDay: number;
  mastery: { topic: string; accuracy: number; total: number }[];
}) {
  if (!claudeEnabled()) return offlineStudyPlan(opts);
  return parse({
    docs: opts.docs,
    effort: "medium",
    schema: PlanSchema,
    instructions: `You are a study coach building a day-by-day revision plan from a student's course notes and quiz results.
Spend more time on weak topics, but keep revisiting strong ones. Mix reviewing notes, practice quizzes, and flashcards.
If an exam date is given, schedule a mock exam two or three days before it and keep the final day light.
Each day's tasks should add up to roughly the student's daily time budget. Task details say exactly what to do.`,
    prompt: `Course: ${opts.courseTitle}
Plan from ${opts.startDate} to ${opts.endDate} (inclusive), one entry per day.
Exam date: ${opts.examDate ?? "not set"}
Daily time budget: ${opts.minutesPerDay} minutes
Quiz performance by topic: ${
      opts.mastery.length
        ? opts.mastery
            .map((m) => `${m.topic}: ${Math.round(m.accuracy * 100)}% over ${m.total} questions`)
            .join("; ")
        : "no quizzes taken yet"
    }`,
  });
}

// ---------------------------------------------------------------- Notes study guide

const StudyGuideSchema = z.object({
  summary: z.string().describe("Markdown: a 2-sentence overview, then 5-8 bullet points of the main ideas"),
  keyPoints: z.array(z.string()).describe("The 3-6 facts most likely to be examined, one sentence each"),
  keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })).describe("Important terms with one-sentence definitions"),
  simpleExplanation: z.string().describe("Markdown: the whole document explained simply, with an everyday analogy"),
});

export type StudyGuide = z.infer<typeof StudyGuideSchema>;

/** Builds a study guide (summary, key points, glossary, plain-language version) for one document. */
export async function summarizeDocument(doc: NoteDoc): Promise<StudyGuide> {
  if (!claudeEnabled()) return offlineStudyGuide(doc);
  return parse({
    docs: [doc],
    effort: "low",
    schema: StudyGuideSchema,
    instructions: `You turn a student's lecture notes into a concise study guide.
Stay faithful to the notes: don't add facts they don't contain. Keep the student's terminology.
Definitions are one sentence and precise enough to write in an exam.
The simple explanation is for a student meeting the topic for the first time: short paragraphs, plain words, one everyday analogy.`,
    prompt: `Write the study guide for "${doc.title}".`,
  });
}

// ---------------------------------------------------------------- Tutor

const TUTOR_BASE = `You are a patient, encouraging exam-preparation tutor.
Ground your answers in the student's notes above, and say which document an idea comes from when it helps.
If the notes don't cover something, say so, then answer from general knowledge and label it as going beyond the notes.
Format with Markdown. Keep answers focused; don't pad.`;

export type TutorReply = { chunks: AsyncIterable<string>; abort(): void };

/** Yields offline text a few words at a time so it streams like a live reply. */
async function* typeOut(text: string, signal: AbortSignal) {
  const pieces = text.match(/\S+\s*/g) ?? [];
  for (let i = 0; i < pieces.length && !signal.aborted; i += 3) {
    yield pieces.slice(i, i + 3).join("");
    await new Promise((r) => setTimeout(r, 25));
  }
}

/**
 * Starts a streamed tutor reply. The caller reads text chunks and saves the final text.
 * Throws AIError straight away (before streaming) when there are no notes.
 */
export function streamTutorReply(docs: NoteDoc[], history: ChatTurn[], mode: TutorMode = "explain"): TutorReply {
  if (!claudeEnabled()) {
    const text = offlineTutorReply(docs, history, mode);
    const controller = new AbortController();
    return { chunks: typeOut(text, controller.signal), abort: () => controller.abort() };
  }

  const stream = client().beta.messages.stream({
    ...FALLBACK,
    model: MODEL,
    max_tokens: 64000,
    output_config: { effort: "medium" },
    system: system(docs, `${TUTOR_BASE}\n\nMode: ${TUTOR_MODES[mode].label}. ${TUTOR_MODES[mode].instructions}`),
    messages: history,
  });
  async function* chunks() {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") yield "\n\n_The tutor couldn't answer that. Try rephrasing your question._";
  }
  return { chunks: chunks(), abort: () => stream.abort() };
}
