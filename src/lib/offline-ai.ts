import "server-only";
import { AIError, type ChatTurn, type NoteDoc } from "@/lib/ai-shared";
import type { TutorMode } from "@/lib/tutor-modes";

/**
 * Offline engine: every AI feature, built from the student's own notes with plain text
 * analysis. Used automatically when no Claude API key is configured (see src/lib/ai.ts).
 *
 * - Headings (ALL CAPS lines, Markdown "#" lines, "Title:" lines) become topics.
 * - "X is Y", "X refers to Y" and "X: Y" / "X – Y" lines become definitions.
 * - Sentences that mention a key term become fill-in-the-blank questions.
 * - Sentences are ranked by how many of the notes' distinctive words they contain.
 */

// ---------------------------------------------------------------- Text analysis

const STOP = new Set(
  `a about above after again against all also am an and any are as at be because been before being below between
  both but by can could did do does doing down during each few for from further had has have having he her here
  hers him his how i if in into is it its itself just let may me might more most must my no nor not now of off on
  once only or other our out over own same she should so some such than that the their them then there these they
  this those through to too under until up us very was we were what when where which while who whom why will with
  would you your yes etc eg ie per via using used use one two three four five many much like make makes made get
  gets way ways another usually often typically always never every others least`.split(/\s+/),
);

// Common verbs: poor fill-in-the-blank answers.
const VERBS = new Set(
  "occurs occur allows allow provides provide contains contain causes cause requires require becomes become stores store loads load means includes include gives give takes take needs need called known based moves move".split(" "),
);

// Labels that look like "X: ..." lines but aren't terms worth testing.
const GENERIC_LABELS = new Set(
  "benefits advantages disadvantages criteria example examples note notes strategies types steps summary definition properties features handling".split(
    " ",
  ),
);

const NON_TERM_START = new Set(
  "it this that these those there they which each if when how what why so but then here we you he she one some all".split(" "),
);

function tokens(text: string) {
  return text.toLowerCase().match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) ?? [];
}

function stem(w: string) {
  if (w.length > 5 && w.endsWith("sses")) return w.slice(0, -2);
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && /(?:x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  return w;
}

function keyStems(text: string) {
  return tokens(text)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem);
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "THE CRITICAL-SECTION PROBLEM" -> "The Critical-Section Problem"; keeps short acronyms like CPU. */
function titleCase(heading: string) {
  const clean = heading.replace(/[#:]+$/g, "").trim();
  if (/[a-z]/.test(clean)) return clean;
  const small = new Set(["a", "an", "and", "of", "in", "the", "to", "for", "on", "with", "or", "vs"]);
  return clean
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && small.has(lower)) return lower;
      if (word.length <= 4 && !small.has(lower) && /^[A-Z/]+$/.test(word)) return word;
      return lower.replace(/(^|-)([a-z])/g, (_, sep: string, c: string) => sep + c.toUpperCase());
    })
    .join(" ");
}

function headingOf(line: string) {
  const md = line.match(/^#{1,6}\s+(.+)$/);
  if (md) return md[1];
  if (line.length <= 60 && !/[a-z]/.test(line) && /^[A-Z][A-Z0-9 &,'()/–—:-]+$/.test(line) && tokens(line).length <= 8) {
    return line;
  }
  const colon = line.match(/^([A-Z][\w ,&'()/-]{2,50}):$/);
  return colon ? colon[1] : null;
}

/** "Week 2 – Processes and CPU scheduling" -> "Processes and CPU scheduling" */
function topicFromTitle(title: string) {
  return title.replace(/^(?:week|lecture|chapter|unit|topic|module|lesson)\s*\d+\s*[-–—:.]\s*/i, "").trim() || title;
}

type Sentence = { text: string; doc: string; topic: string; stems: Set<string>; index: number };
type Definition = { term: string; article: string; definition: string; sentence: Sentence };

type Corpus = {
  sentences: Sentence[];
  definitions: Definition[];
  topics: string[];
  idf: Map<string, number>;
  /** Content words that appear in several sentences: candidates for blanks. */
  keywords: string[];
};

// "X is held / split / …": passive descriptions rather than definitions.
const PARTICIPLES = new Set("held split made done given known taken seen kept set run shown built found sent put".split(" "));

const VERB_DEF =
  /^(?:(a|an|the)\s+)?(.{2,60}?)\s+(is defined as|is called|refers to|occurs when|happens when|means|is|are)\s+(.{8,})$/i;
const LABEL_DEF = /^(.{2,70}?)(?:\s*:\s+|\s+[–—-]\s+)(.{8,})$/;

function validTerm(term: string) {
  const t = tokens(term);
  if (t.length === 0 || t.length > 7) return false;
  if (NON_TERM_START.has(t[0]!)) return false;
  if (t.length === 1 && GENERIC_LABELS.has(t[0]!)) return false;
  return /[a-z]/i.test(term) && !/[.;=]/.test(term);
}

function findDefinition(sentence: Sentence): Definition | null {
  const label = sentence.text.match(LABEL_DEF);
  if (label && validTerm(label[1]) && !/\b(is|are|was|were)\b/i.test(label[1]) && !label[2].trim().endsWith(":")) {
    return { term: label[1].trim(), article: "", definition: capitalize(label[2].trim()), sentence };
  }
  const verb = sentence.text.match(VERB_DEF);
  if (!verb) return null;
  const [, article = "", term = "", link = "", rest = ""] = verb;
  const firstWord = tokens(rest)[0] ?? "";
  // "X is split into…", "X is not…": a description, not a definition.
  if (/^(not|also|then|only|very|too|usually|typically|often|still)$/.test(firstWord)) return null;
  if (link.toLowerCase() === "is" || link.toLowerCase() === "are") {
    if (firstWord.endsWith("ed") || firstWord.endsWith("ing") || PARTICIPLES.has(firstWord)) return null;
  }
  // Long subjects ("Compaction can reduce … but") are clauses, not terms.
  if (!validTerm(term) || tokens(term).length > 4 || /\b(can|must|will|should|may|while|but|when)\b/i.test(term)) return null;
  const lowered = link.toLowerCase();
  const definition = lowered.endsWith("when") ? `${capitalize(lowered)} ${rest}` : capitalize(rest);
  return { term: term.trim(), article: article.toLowerCase(), definition: definition.trim(), sentence };
}

function cleanLine(line: string) {
  return line
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
    .replace(/\*\*|__|`/g, "")
    .trim();
}

function buildCorpus(docs: NoteDoc[]): Corpus {
  if (docs.length === 0) throw new AIError("Upload some notes for this course first.");

  const sentences: Sentence[] = [];
  const topics: string[] = [];
  for (const doc of docs) {
    let topic = topicFromTitle(doc.title);
    for (const raw of doc.content.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const heading = headingOf(line);
      if (heading) {
        topic = titleCase(heading);
        continue;
      }
      for (const text of cleanLine(line).split(/(?<=[.!?])\s+(?=[A-Z0-9("'])/)) {
        const t = text.trim();
        if (tokens(t).length < 4 || t.length > 400) continue;
        sentences.push({ text: t, doc: doc.title, topic, stems: new Set(keyStems(t)), index: sentences.length });
        if (!topics.includes(topic)) topics.push(topic);
      }
    }
  }
  if (sentences.length === 0) {
    throw new AIError("Your notes don't contain enough text to work with. Add more detailed notes and try again.");
  }

  const df = new Map<string, number>();
  for (const s of sentences) for (const w of s.stems) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = new Map([...df].map(([w, n]) => [w, Math.log((sentences.length + 1) / n) + 1]));

  const wordCounts = new Map<string, number>();
  for (const s of sentences) {
    for (const w of tokens(s.text)) {
      if (w.length >= 5 && !STOP.has(w) && !VERBS.has(w) && !/\d/.test(w)) wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
    }
  }
  const keywords = [...wordCounts]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  const definitions = sentences.map(findDefinition).filter((d): d is Definition => d !== null);
  return { sentences, definitions, topics, idf, keywords };
}

/** How much a sentence is about the notes' distinctive vocabulary. */
function sentenceWeight(s: Sentence, corpus: Corpus) {
  let total = 0;
  for (const w of s.stems) total += corpus.idf.get(w) ?? 0;
  return total / Math.sqrt(Math.max(s.stems.size, 1));
}

/** Core of a term without its bracketed expansion: "Round Robin (RR)" -> "Round Robin". */
const termCore = (term: string) => term.replace(/\s*\([^)]*\)\s*/g, " ").trim();

const isPlural = (term: string) => {
  const last = termCore(term).split(/\s+/).pop() ?? "";
  return /[a-z]s$/.test(last) && !/ss$/.test(last);
};

function askWhatIs(d: Definition) {
  const verb = isPlural(d.term) ? "are" : "is";
  if (/^[a-z]+ing\b/i.test(d.term)) return `${capitalize(d.term)}: what does it involve?`;
  // Descriptive labels ("Strategies for choosing a hole") read badly as "What is …?".
  if (/\s(for|of|in|to|with|on|from)\s/i.test(termCore(d.term))) return `${capitalize(d.term)}: what ${verb === "are" ? "are they" : "is it"}?`;
  const article = d.article === "the" ? "the " : d.article ? `${/^[aeiou]/i.test(d.term) ? "an" : "a"} ` : "";
  return `What ${verb} ${article}${d.term}?`;
}

// ---------------------------------------------------------------- Fill-in-the-blank

type Blank = { answer: string; cloze: string; kind: "term" | "acronym" | "keyword" };

function makeBlank(s: Sentence, corpus: Corpus): Blank | null {
  const tryAnswer = (answer: string, kind: Blank["kind"]): Blank | null => {
    const re = new RegExp(`(^|[^\\w])(${escapeRegExp(answer)})(?=[^\\w]|$)`, "i");
    const match = s.text.match(re);
    if (!match || match.index === undefined) return null;
    const start = match.index + match[1].length;
    const cloze = `${s.text.slice(0, start)}_____${s.text.slice(start + match[2].length)}`;
    // Enough context must remain to work out the answer.
    if (tokens(cloze).length < 5) return null;
    return { answer: match[2], cloze, kind };
  };

  const terms = corpus.definitions
    .map((d) => termCore(d.term))
    .filter((t) => t.length >= 3 && tokens(t).length <= 4)
    .sort((a, b) => b.length - a.length);
  // Skip the sentence's own definition label: blanking it would make a trivial question.
  const own = corpus.definitions.find((d) => d.sentence === s);
  // Words found all over the notes ("process") make dull, guessable blanks.
  const generic = (t: string) => tokens(t).length === 1 && (corpus.idf.get(stem(t.toLowerCase())) ?? Infinity) < Math.log(1 / 0.12) + 1;
  for (const t of terms) {
    if (generic(t) || (own && termCore(own.term).toLowerCase() === t.toLowerCase())) continue;
    const blank = tryAnswer(t, "term");
    if (blank) return blank;
  }
  for (const acronym of s.text.match(/\b[A-Z]{2,6}s?\b/g) ?? []) {
    const blank = tryAnswer(acronym, "acronym");
    if (blank) return blank;
  }
  const best = tokens(s.text)
    .filter((w) => corpus.keywords.includes(w))
    .sort((a, b) => (corpus.idf.get(stem(b)) ?? 0) - (corpus.idf.get(stem(a)) ?? 0))[0];
  return best ? tryAnswer(best, "keyword") : null;
}

function distractorPool(kind: Blank["kind"], corpus: Corpus): { text: string; topic: string }[] {
  if (kind === "term") return corpus.definitions.map((d) => ({ text: termCore(d.term), topic: d.sentence.topic }));
  if (kind === "acronym") {
    return corpus.sentences.flatMap((s) => (s.text.match(/\b[A-Z]{2,6}s?\b/g) ?? []).map((text) => ({ text, topic: s.topic })));
  }
  return corpus.keywords.slice(0, 80).map((text) => ({ text, topic: "" }));
}

/** Up to n wrong options, preferring ones from the same topic so they're plausible. */
function pickDistractors(correct: string, pool: { text: string; topic: string }[], topic: string, n = 3) {
  const seen = new Set([correct.toLowerCase()]);
  const ranked = shuffle(pool).sort((a, b) => Number(b.topic === topic) - Number(a.topic === topic));
  const out: string[] = [];
  for (const p of ranked) {
    const key = p.text.toLowerCase();
    if (seen.has(key) || key.includes(correct.toLowerCase()) || correct.toLowerCase().includes(key)) continue;
    seen.add(key);
    out.push(p.text);
    if (out.length === n) break;
  }
  return out;
}

function withOptions(correct: string, distractors: string[]) {
  const options = shuffle([correct, ...distractors]);
  return { options, correctIndex: options.indexOf(correct) };
}

/** Recovers the answer to a "_____" question by matching it against the notes. */
function answerForCloze(cloze: string, corpus: Corpus) {
  const [before, after] = cloze.split("_____");
  if (after === undefined) return null;
  const re = new RegExp(`^${escapeRegExp(before.trim())}\\s*(.+?)\\s*${escapeRegExp(after.trim())}$`, "i");
  for (const s of corpus.sentences) {
    const m = s.text.match(re);
    if (m) return { answer: m[1], sentence: s };
  }
  return null;
}

// ---------------------------------------------------------------- Quizzes

export type OfflineQuestion = {
  type: "mcq" | "short";
  prompt: string;
  options: string[];
  correctIndex: number;
  modelAnswer: string;
  explanation: string;
  topic: string;
};

type Candidate = OfflineQuestion & { level: 1 | 2 | 3; source: number };

const source = (s: Sentence) => `From your notes, "${s.doc}" (${s.topic}): ${s.text}`;

function quizCandidates(corpus: Corpus): Candidate[] {
  const out: Candidate[] = [];
  const termPool = distractorPool("term", corpus);
  const defPool = corpus.definitions.map((d) => ({ text: d.definition, topic: d.sentence.topic }));

  for (const d of corpus.definitions) {
    const s = d.sentence;
    const base = { topic: s.topic, explanation: source(s), source: s.index, modelAnswer: s.text };
    const core = termCore(d.term).toLowerCase();

    const terms = pickDistractors(termCore(d.term), termPool, s.topic);
    if (terms.length >= 2 && !d.definition.toLowerCase().includes(core)) {
      out.push({
        ...base,
        ...withOptions(termCore(d.term), terms),
        level: 1,
        type: "mcq",
        prompt: `Which term matches this description? "${d.definition}"`,
      });
    }
    const defs = pickDistractors(d.definition, defPool, s.topic);
    if (defs.length >= 2) {
      out.push({ ...base, ...withOptions(d.definition, defs), level: 2, type: "mcq", prompt: `Which statement best describes ${d.term}?` });
    }
    out.push({ ...base, options: [], correctIndex: -1, level: 2, type: "short", prompt: `${askWhatIs(d)} Answer in your own words.` });
  }

  for (const s of corpus.sentences) {
    const blank = makeBlank(s, corpus);
    if (!blank) continue;
    const wrong = pickDistractors(blank.answer, distractorPool(blank.kind, corpus), s.topic);
    if (wrong.length >= 2) {
      out.push({
        ...withOptions(blank.answer, wrong),
        type: "mcq",
        level: 2,
        prompt: `Fill in the blank: ${blank.cloze}`,
        modelAnswer: blank.answer,
        explanation: source(s),
        topic: s.topic,
        source: s.index,
      });
    }
    // Harder: spot the true statement among versions with the key term swapped out.
    const swappable = blank.kind === "acronym" || (blank.kind === "term" && tokens(blank.answer).length > 1);
    if (wrong.length === 3 && swappable && !/\(_____\)|_____ \(/.test(blank.cloze)) {
      const swap = (w: string) => blank.cloze.replace("_____", w);
      out.push({
        ...withOptions(s.text, wrong.map(swap)),
        type: "mcq",
        level: 3,
        prompt: "Which of these statements is correct?",
        modelAnswer: s.text,
        explanation: source(s),
        topic: s.topic,
        source: s.index,
      });
    }
  }

  // Hardest: explain a whole topic. The model answer is its two most important sentences.
  for (const topic of corpus.topics) {
    const inTopic = corpus.sentences.filter((s) => s.topic === topic);
    if (inTopic.length < 3) continue;
    const best = [...inTopic].sort((a, b) => sentenceWeight(b, corpus) - sentenceWeight(a, corpus)).slice(0, 2);
    best.sort((a, b) => a.index - b.index);
    out.push({
      type: "short",
      level: 3,
      prompt: `Explain the main ideas of ${topic}.`,
      options: [],
      correctIndex: -1,
      modelAnswer: best.map((s) => s.text).join(" "),
      explanation: `Key points from "${best[0].doc}": ${best.map((s) => s.text).join(" ")}`,
      topic,
      source: -1 - corpus.topics.indexOf(topic),
    });
  }
  return out;
}

const LEVEL_WEIGHT = {
  easy: { 1: 4, 2: 2, 3: 0.5 },
  medium: { 1: 1, 2: 4, 3: 2 },
  hard: { 1: 0.3, 2: 2, 3: 4 },
} as const;

/** Picks `count` candidates spread across topics, favouring the right difficulty and focus topics. */
function select(candidates: Candidate[], count: number, weightOf: (c: Candidate) => number, used: Set<number>) {
  // Weighted random order (Efraimidis–Spirakis): higher weight tends to come first.
  const ordered = candidates
    .map((c) => ({ c, key: Math.random() ** (1 / Math.max(weightOf(c), 0.01)) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.c);

  const byTopic = new Map<string, Candidate[]>();
  for (const c of ordered) byTopic.set(c.topic, [...(byTopic.get(c.topic) ?? []), c]);
  const queues = [...byTopic.values()];

  const picked: Candidate[] = [];
  while (picked.length < count && queues.some((q) => q.length)) {
    for (const q of queues) {
      while (q.length && used.has(q[0].source)) q.shift();
      const next = q.shift();
      if (!next) continue;
      picked.push(next);
      used.add(next.source);
      if (picked.length === count) break;
    }
  }
  return picked;
}

export function offlineQuiz(opts: {
  docs: NoteDoc[];
  count: number;
  difficulty: "easy" | "medium" | "hard";
  format: "mcq" | "short" | "mixed";
  focusTopics: string[];
  purpose?: "practice" | "exam";
}): { title: string; questions: OfflineQuestion[] } {
  const corpus = buildCorpus(opts.docs);
  const all = quizCandidates(corpus);
  const focus = new Set(opts.focusTopics.map((t) => t.toLowerCase()));
  const weightOf = (c: Candidate) => LEVEL_WEIGHT[opts.difficulty][c.level] * (focus.has(c.topic.toLowerCase()) ? 4 : 1);

  const used = new Set<number>();
  const shortCount = opts.format === "short" ? opts.count : opts.format === "mixed" ? Math.round(opts.count * 0.3) : 0;
  const shorts = select(all.filter((c) => c.type === "short"), shortCount, weightOf, used);
  const mcqs = select(all.filter((c) => c.type === "mcq"), opts.count - shorts.length, weightOf, used);

  let picked = shuffle([...mcqs, ...shorts]);
  if (opts.purpose === "exam") picked = picked.sort((a, b) => a.level - b.level);
  if (picked.length === 0) {
    throw new AIError("Your notes don't have enough definitions or key facts to build questions. Add more detailed notes.");
  }

  const topicCounts = new Map<string, number>();
  for (const q of picked) topicCounts.set(q.topic, (topicCounts.get(q.topic) ?? 0) + 1);
  const top = [...topicCounts].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const title =
    focus.size > 0
      ? `Weak spots: ${top.slice(0, 2).join(" & ")}`
      : top.length > 2
        ? `${capitalize(opts.difficulty)} mixed review: ${top.slice(0, 2).join(", ")} and more`
        : `${capitalize(opts.difficulty)} quiz: ${top.join(" & ")}`;

  const questions = picked.map((c): OfflineQuestion => ({
    type: c.type,
    prompt: c.prompt,
    options: c.options,
    correctIndex: c.correctIndex,
    modelAnswer: c.modelAnswer,
    explanation: c.explanation,
    topic: c.topic,
  }));
  return { title, questions };
}

// ---------------------------------------------------------------- Grading

/** Marks a short answer by how many of the model answer's key words it covers. */
function gradeOne(modelAnswer: string, response: string, idf: Map<string, number>) {
  const key = [...new Set(keyStems(modelAnswer))];
  const said = new Set(keyStems(response));
  const hit = key.filter((w) => said.has(w));
  const coverage = key.length ? hit.length / key.length : 0;
  const correct = coverage >= 0.45 || (coverage >= 0.3 && hit.length >= 4);

  // The most distinctive words the answer left out.
  const byStem = new Map<string, string>();
  for (const w of tokens(modelAnswer)) {
    if (w.length > 3 && !STOP.has(w) && !said.has(stem(w)) && !byStem.has(stem(w))) byStem.set(stem(w), w);
  }
  const missing = [...byStem.values()]
    .sort((a, b) => (idf.get(stem(b)) ?? 0) - (idf.get(stem(a)) ?? 0))
    .slice(0, 4);
  const feedback = correct
    ? missing.length
      ? `Good answer: you covered the key idea. To make it complete, also mention ${missing.slice(0, 2).join(" and ")}.`
      : "Excellent: you covered all the key points."
    : hit.length
      ? `Partly there, but key points are missing. A full answer would mention ${missing.join(", ")}.`
      : `This doesn't match the notes yet. A full answer would mention ${missing.join(", ")}.`;
  return { correct, feedback };
}

export function offlineGrade(docs: NoteDoc[], items: { id: string; modelAnswer: string; response: string }[]) {
  let idf = new Map<string, number>();
  try {
    idf = buildCorpus(docs).idf;
  } catch {
    // No usable notes: grade on word overlap alone.
  }
  return new Map(items.map((i) => [i.id, gradeOne(i.modelAnswer, i.response, idf)]));
}

// ---------------------------------------------------------------- Flashcards

export function offlineFlashcards(opts: { docs: NoteDoc[]; count: number; focusTopics: string[]; existingFronts: string[] }) {
  const corpus = buildCorpus(opts.docs);
  const existing = new Set(opts.existingFronts.map((f) => f.toLowerCase()));
  const focus = new Set(opts.focusTopics.map((t) => t.toLowerCase()));

  type Card = { front: string; back: string; topic: string; source: number; priority: number };
  const cards: Card[] = [];
  for (const d of corpus.definitions) {
    cards.push({ front: askWhatIs(d), back: d.sentence.text, topic: d.sentence.topic, source: d.sentence.index, priority: 2 });
  }
  for (const s of corpus.sentences) {
    const blank = makeBlank(s, corpus);
    if (blank) cards.push({ front: `Fill in the blank: ${blank.cloze}`, back: `${blank.answer}. ${s.text}`, topic: s.topic, source: s.index, priority: 1 });
  }

  const fresh = cards.filter((c) => !existing.has(c.front.toLowerCase()));
  const weight = (c: Card) => c.priority * (focus.has(c.topic.toLowerCase()) ? 4 : 1);
  const ordered = fresh.map((c) => ({ c, key: Math.random() ** (1 / weight(c)) })).sort((a, b) => b.key - a.key);

  // One card per source sentence, rotating through topics so every topic gets cards.
  const byTopic = new Map<string, Card[]>();
  for (const { c } of ordered) byTopic.set(c.topic, [...(byTopic.get(c.topic) ?? []), c]);
  const queues = [...byTopic.values()];
  const used = new Set<number>();
  const out: { front: string; back: string; topic: string }[] = [];
  while (out.length < opts.count && queues.some((q) => q.length)) {
    for (const q of queues) {
      while (q.length && used.has(q[0].source)) q.shift();
      const c = q.shift();
      if (!c) continue;
      used.add(c.source);
      out.push({ front: c.front, back: c.back, topic: c.topic });
      if (out.length === opts.count) break;
    }
  }
  if (out.length === 0) {
    throw new AIError(
      existing.size ? "You already have flashcards for everything in these notes. Add more notes for new cards." : "Your notes don't have enough key facts to make flashcards.",
    );
  }
  return out;
}

// ---------------------------------------------------------------- Study plan

const DAY_MS = 86_400_000;
const parseDay = (iso: string) => new Date(`${iso}T12:00:00`);
function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const niceDate = (iso: string) => parseDay(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

type PlanTask = { title: string; details: string; topic: string; minutes: number; kind: "review" | "practice" | "flashcards" | "mock" };

export function offlineStudyPlan(opts: {
  docs: NoteDoc[];
  courseTitle: string;
  startDate: string;
  endDate: string;
  examDate: string | null;
  minutesPerDay: number;
  mastery: { topic: string; accuracy: number; total: number }[];
}) {
  const corpus = buildCorpus(opts.docs);
  const accuracy = new Map(opts.mastery.filter((m) => m.total > 0).map((m) => [m.topic.toLowerCase(), m.accuracy]));
  const acc = (t: string) => accuracy.get(t.toLowerCase()) ?? 0.5;
  const topics = [...corpus.topics].sort((a, b) => acc(a) - acc(b));

  // Weak topics come round more often: below 50% three times as often, below 75% twice.
  const weightOf = (t: string) => (acc(t) < 0.5 ? 3 : acc(t) < 0.75 ? 2 : 1);
  const rotation: string[] = [];
  for (let r = 0; r < 3; r++) for (const t of topics) if (weightOf(t) > r) rotation.push(t);

  const docOf = (t: string) => corpus.sentences.find((s) => s.topic === t)?.doc ?? opts.courseTitle;
  const termsOf = (t: string) =>
    corpus.definitions
      .filter((d) => d.sentence.topic === t)
      .slice(0, 3)
      .map((d) => termCore(d.term));

  const start = parseDay(opts.startDate);
  const end = parseDay(opts.endDate);
  const exam = opts.examDate ? parseDay(opts.examDate) : null;
  const mockDay = exam ? isoDay(new Date(exam.getTime() - 2 * DAY_MS)) : null;
  const budget = opts.minutesPerDay;

  const days: { date: string; tasks: PlanTask[] }[] = [];
  let slot = 0;
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + DAY_MS)) {
    const date = isoDay(d);
    const tasks: PlanTask[] = [];
    const daysToExam = exam ? Math.round((exam.getTime() - d.getTime()) / DAY_MS) : null;

    if (daysToExam === 0) {
      tasks.push({ title: "Exam-day warm-up", details: "Flip through your due flashcards to warm up. No new material today. Get some rest before the exam.", topic: "All topics", minutes: Math.min(budget, 20), kind: "flashcards" });
    } else if (daysToExam === 1) {
      tasks.push({ title: "Light review", details: `Skim the key terms of every topic: ${topics.slice(0, 4).join(", ")}. Stop early and sleep well.`, topic: "All topics", minutes: round5(Math.min(budget, 45) * 0.6), kind: "review" });
      tasks.push({ title: "Flashcards", details: "Review your due flashcards in the Flashcards tab.", topic: "All topics", minutes: round5(Math.min(budget, 45) * 0.4), kind: "flashcards" });
    } else if (date === mockDay) {
      const mock = Math.min(budget, 90);
      tasks.push({ title: "Full mock exam", details: "Take a timed mock exam from the Quizzes tab under exam conditions, then read the explanations for every question you missed.", topic: "All topics", minutes: mock, kind: "mock" });
      if (budget - mock >= 15) tasks.push({ title: "Fix weak spots", details: "Make flashcards on your weak topics and review them once.", topic: topics[0], minutes: budget - mock, kind: "flashcards" });
    } else {
      const topic = rotation[slot % rotation.length];
      const practiceTopic = rotation[(slot + 1) % rotation.length];
      slot++;
      const terms = termsOf(topic);
      const review = round5(budget * (budget < 30 ? 0.6 : 0.4));
      const practice = budget < 30 ? 0 : round5(budget * 0.35);
      const cards = Math.max(5, budget - review - practice);
      tasks.push({
        title: `Review: ${topic}`,
        details: `Re-read the ${topic} section of "${docOf(topic)}", then write down ${terms.length ? `${terms.join(", ")}` : "the main ideas"} from memory and check them against the notes.`,
        topic,
        minutes: review,
        kind: "review",
      });
      if (practice) {
        tasks.push({
          title: `Practice quiz: ${practiceTopic}`,
          details: `Take a short quiz in the Quizzes tab${acc(practiceTopic) < 0.6 ? " with the weak-topics focus" : ""}, then read the explanation for every question you missed.`,
          topic: practiceTopic,
          minutes: practice,
          kind: "practice",
        });
      }
      tasks.push({ title: "Flashcards", details: "Review all due flashcards in the Flashcards tab.", topic, minutes: cards, kind: "flashcards" });
    }
    days.push({ date, tasks });
  }

  const weak = topics.filter((t) => acc(t) < 0.6 && accuracy.has(t.toLowerCase()));
  const summary = [
    `This ${days.length}-day plan covers ${topics.length} topic${topics.length === 1 ? "" : "s"} at about ${budget} minutes a day, mixing note review, practice quizzes and flashcards.`,
    weak.length
      ? `Your weakest topics (${weak.slice(0, 3).join(", ")}) come up most often.`
      : "Every topic comes round in turn; take a few quizzes so future plans can target your weak spots.",
    mockDay && days.some((d) => d.date === mockDay) ? `A full mock exam is scheduled for ${niceDate(mockDay)}, and the last day before the exam is kept light.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return { summary, days };
}

// ---------------------------------------------------------------- Notes study guide

/** Drops bracketed asides and anything after a semicolon, for plain-language versions. */
function simplify(text: string) {
  return text
    .replace(/\s*\([^)]*\)/g, "")
    .split(/;\s/)[0]
    .replace(/\s+([.,])/g, "$1")
    .replace(/[^.!?]$/, (c) => `${c}.`);
}

export function offlineStudyGuide(doc: NoteDoc) {
  const corpus = buildCorpus([doc]);
  const ranked = [...corpus.sentences].sort((a, b) => sentenceWeight(b, corpus) - sentenceWeight(a, corpus));

  const overview = corpus.sentences
    .filter((s) => tokens(s.text).length >= 6)
    .slice(0, 2)
    .map((s) => s.text)
    .join(" ");
  // One main idea per topic, then fill up with the strongest remaining sentences.
  const bullets: Sentence[] = [];
  for (const topic of corpus.topics) {
    const best = ranked.find((s) => s.topic === topic && !overview.includes(s.text));
    if (best) bullets.push(best);
  }
  for (const s of ranked) {
    if (bullets.length >= 6) break;
    if (!bullets.includes(s) && !overview.includes(s.text)) bullets.push(s);
  }
  bullets.splice(8);
  bullets.sort((a, b) => a.index - b.index);

  const keyPoints = ranked
    .filter((s) => !bullets.includes(s) && tokens(s.text).length >= 6)
    .slice(0, 5)
    .map((s) => s.text);
  if (keyPoints.length < 3) keyPoints.push(...bullets.slice(0, 3 - keyPoints.length).map((s) => s.text));

  const keyTerms = corpus.definitions.slice(0, 12).map((d) => ({ term: capitalize(termCore(d.term)), definition: d.definition }));

  const sections = corpus.topics.map((topic) => {
    const first = corpus.sentences.filter((s) => s.topic === topic).slice(0, 2);
    return `**${topic}.** ${first.map((s) => simplify(s.text)).join(" ")}`;
  });
  const simpleExplanation = [
    `In short, "${topicFromTitle(doc.title)}" is about ${corpus.topics.length > 1 ? `${corpus.topics.slice(0, -1).join(", ")} and ${corpus.topics.at(-1)}` : corpus.topics[0]}. Here it is one piece at a time:`,
    ...sections,
    keyTerms.length ? `If you remember only a few words, make them: ${keyTerms.slice(0, 4).map((t) => `**${t.term}**`).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    summary: `${overview}\n\n${bullets.map((s) => `- ${s.text}`).join("\n")}`,
    keyPoints,
    keyTerms,
    simpleExplanation,
  };
}

// ---------------------------------------------------------------- Tutor

function relevant(query: string, corpus: Corpus, n: number) {
  const q = new Set(keyStems(query));
  if (q.size === 0) return [];
  return corpus.sentences
    .map((s) => {
      let score = 0;
      for (const w of q) if (s.stems.has(w)) score += corpus.idf.get(w) ?? 1;
      // Sentences under a heading that names the question's subject are the best answers.
      for (const w of keyStems(s.topic)) if (q.has(w)) score += 2;
      return { s, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.s);
}

const QUESTION_MARK = "**Question";

function askBlank(pool: Sentence[], corpus: Corpus, number: number, skip: Set<Sentence> = new Set()) {
  for (const s of shuffle(pool)) {
    if (skip.has(s)) continue;
    const blank = makeBlank(s, corpus);
    if (blank) return `${QUESTION_MARK} ${number}.** Fill in the blank:\n\n> ${blank.cloze}`;
  }
  return null;
}

/** The previous "fill in the blank" question in the conversation, with its answer recovered from the notes. */
function pendingQuestion(history: ChatTurn[], corpus: Corpus) {
  const last = history.at(-2);
  if (last?.role !== "assistant") return null;
  const cloze = last.content.match(/^> (.*_____.*)$/m)?.[1];
  const found = cloze ? answerForCloze(cloze, corpus) : null;
  return found && cloze ? { ...found, cloze } : null;
}

function isRight(response: string, answer: string) {
  const r = keyStems(response).join(" ");
  const a = keyStems(answer).join(" ");
  return a.length > 0 && (r === a || ` ${r} `.includes(` ${a} `) || (tokens(answer).length > 1 && a.split(" ").every((w) => r.includes(w))));
}

const OFFLINE_NOTE = "\n\n---\n_Offline tutor: answers are drawn straight from your notes. Add a Claude API key for full AI explanations._";

export function offlineTutorReply(docs: NoteDoc[], history: ChatTurn[], mode: TutorMode): string {
  const corpus = buildCorpus(docs);
  const message = history.at(-1)?.content ?? "";
  // Follow-ups like "why?" lean on the previous question for context.
  const previousUser = history.slice(0, -1).findLast((t) => t.role === "user")?.content ?? "";
  let hits = relevant(message, corpus, 4);
  if (hits.length < 2 && previousUser) hits = relevant(`${message} ${previousUser}`, corpus, 4);

  if (mode === "quiz" || mode === "socratic") {
    const pending = pendingQuestion(history, corpus);
    const asked = history.filter((t) => t.role === "assistant" && t.content.includes(QUESTION_MARK)).length;
    const parts: string[] = [];

    if (pending) {
      const right = isRight(message, pending.answer);
      const scoreSoFar = history.filter((t) => t.role === "assistant" && /^✅/m.test(t.content)).length + Number(right);
      if (mode === "socratic" && !right && !/\b(give up|tell me|answer|idk|don'?t know)\b/i.test(message)) {
        const pendingTerm = corpus.definitions.find((d) => termCore(d.term).toLowerCase() === pending.answer.toLowerCase());
        const hint = pendingTerm
          ? `your notes describe it as "${pendingTerm.definition}"`
          : `it starts with "${pending.answer.slice(0, 2)}…" and has ${pending.answer.length} letters.`;
        return `Not quite, but you're thinking about it. Here's a hint: ${hint}\n\nHave another go. Reply "tell me" if you'd like the answer.\n\n> ${pending.cloze}${OFFLINE_NOTE}`;
      }
      parts.push(
        right ? `✅ **Correct!** The answer is **${pending.answer}**.` : `❌ **Not quite.** The answer is **${pending.answer}**.`,
        `From "${pending.sentence.doc}": ${pending.sentence.text}`,
      );
      if (mode === "quiz") parts.push(`**Score: ${scoreSoFar}/${asked}**`);
    } else if (mode === "quiz") {
      parts.push(`Let's test you${hits.length ? ` on ${hits[0].topic}` : ""}. Reply with the missing word or phrase.`);
    } else {
      parts.push("Let's work it out together. I'll ask; you answer, and we'll build up from there.");
    }

    // Stay on the topic the student first asked about, falling back to the whole course.
    const firstAsk = history.find((t) => t.role === "user")?.content ?? message;
    const topicPool = relevant(firstAsk, corpus, 12);
    // Never repeat a question from earlier in the conversation.
    const askedBefore = new Set(
      history
        .filter((t) => t.role === "assistant")
        .flatMap((t) => [...t.content.matchAll(/^> (.*_____.*)$/gm)].map((m) => answerForCloze(m[1], corpus)?.sentence))
        .filter((x): x is Sentence => x !== undefined),
    );
    const next =
      askBlank(topicPool.length >= 3 ? topicPool : corpus.sentences, corpus, asked + 1, askedBefore) ??
      askBlank(corpus.sentences, corpus, asked + 1, askedBefore);
    if (next) parts.push(next);
    return parts.join("\n\n") + OFFLINE_NOTE;
  }

  if (hits.length === 0) {
    return `I couldn't find that in your notes. They cover: ${corpus.topics.join(", ")}. Try asking about one of those, for example "Explain ${corpus.topics[0]}".${OFFLINE_NOTE}`;
  }

  const terms = corpus.definitions.filter((d) => hits.some((h) => h.topic === d.sentence.topic) && keyStems(d.term).some((w) => keyStems(message + " " + hits.map((h) => h.text).join(" ")).includes(w))).slice(0, 4);
  const docs_ = [...new Set(hits.map((h) => `"${h.doc}"`))].join(" and ");
  const ordered = [...hits].sort((a, b) => a.index - b.index);

  switch (mode) {
    case "eli5":
      return [
        `**In simple terms:**`,
        ...ordered.map((s) => `- ${simplify(s.text)}`),
        terms.length ? `**Words to know:** ${terms.map((d) => `**${termCore(d.term)}** means ${simplify(d.definition).charAt(0).toLowerCase()}${simplify(d.definition).slice(1)}`).join(" ")}` : "",
        `_Source: ${docs_}._`,
      ]
        .filter(Boolean)
        .join("\n\n") + OFFLINE_NOTE;

    case "exam": {
      const keywords = [...new Set(terms.map((d) => termCore(d.term)).concat(hits.flatMap((h) => h.text.match(/\b[A-Z]{2,6}\b/g) ?? [])))].slice(0, 6);
      const confusable = corpus.definitions.filter((d) => d.sentence.topic === hits[0].topic && !terms.includes(d)).slice(0, 2);
      return [
        `**A full-mark answer covers these points** (from ${docs_}):`,
        ordered.map((s, i) => `${i + 1}. ${s.text}`).join("\n"),
        keywords.length ? `**Keywords an examiner looks for:** ${keywords.map((k) => `**${k}**`).join(", ")}` : "",
        [
          "**Common ways to lose marks:**",
          "- Giving a definition without explaining why it matters or giving an example.",
          confusable.length ? `- Mixing this up with ${confusable.map((d) => `**${termCore(d.term)}**`).join(" or ")}.` : "- Leaving out a step or condition the question asks for.",
          "- Writing everything you know instead of answering the exact question.",
        ].join("\n"),
      ]
        .filter(Boolean)
        .join("\n\n") + OFFLINE_NOTE;
    }

    default: {
      const check = askBlank(hits, corpus, 1)?.replace(`${QUESTION_MARK} 1.**`, "**Check yourself.**");
      return [
        `Here's what your notes say (${docs_}):`,
        ordered.map((s) => `- ${s.text}`).join("\n"),
        terms.length ? `**Key terms**\n${terms.map((d) => `- **${capitalize(termCore(d.term))}**: ${d.definition}`).join("\n")}` : "",
        check ?? "",
      ]
        .filter(Boolean)
        .join("\n\n") + OFFLINE_NOTE;
    }
  }
}
