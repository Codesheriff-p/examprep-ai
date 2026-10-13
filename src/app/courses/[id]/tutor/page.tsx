import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { weakTopics } from "@/lib/progress";
import { formatDate, relativeDay } from "@/lib/format";
import { isTutorMode, type TutorMode } from "@/lib/tutor-modes";
import { EmptyState } from "@/components/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { TutorChat } from "./TutorChat";

/** Builds the opening message for "Explain my mistake" on a quiz result. */
async function explainPrompt(answerId: string, courseId: string, userId: string) {
  const a = await db.attemptAnswer.findFirst({
    where: { id: answerId, attempt: { userId, quiz: { courseId } } },
    include: { question: true },
  });
  if (!a) return null;
  const q = a.question;
  const options = q.options as string[];
  const letter = (i: string) => (i ? `${"ABCDEFGH"[Number(i)]}) ${options[Number(i)]}` : "no answer");
  const lines =
    q.type === "mcq"
      ? [`My answer: ${letter(a.response)}`, `Correct answer: ${letter(q.answer)}`]
      : [`My answer: ${a.response || "(blank)"}`, `Model answer: ${q.answer}`];
  return [
    a.correct
      ? `I got this ${q.topic} question right, but I want to understand it more deeply.`
      : `I got this ${q.topic} question wrong. Explain why the correct answer is right and where my thinking went wrong, then give me a similar question to try.`,
    "",
    `Question: ${q.prompt}`,
    ...(q.type === "mcq" ? options.map((o, i) => `${"ABCDEFGH"[i]}) ${o}`) : []),
    ...lines,
  ].join("\n");
}

/** Builds the opening message for "Review with tutor" on a whole attempt. */
async function reviewPrompt(attemptId: string, courseId: string, userId: string) {
  const attempt = await db.quizAttempt.findFirst({
    where: { id: attemptId, userId, quiz: { courseId } },
    include: { quiz: true, answers: { where: { correct: false }, include: { question: true } } },
  });
  if (!attempt) return null;
  if (attempt.answers.length === 0) {
    return `I scored ${Math.round(attempt.score * 100)}% on "${attempt.quiz.title}". What should I study next to stretch myself?`;
  }
  return [
    `I scored ${Math.round(attempt.score * 100)}% on "${attempt.quiz.title}". These are the questions I got wrong:`,
    ...attempt.answers.map((a, i) => `${i + 1}. [${a.question.topic}] ${a.question.prompt}`),
    "",
    "Find the pattern in my mistakes, explain the key ideas I'm missing, and then quiz me on them one question at a time.",
  ].join("\n");
}

export default async function TutorPage({ params, searchParams }: PageProps<"/courses/[id]/tutor">) {
  const { id } = await params;
  const sp = await searchParams;
  const param = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const { user } = await requireCourse(id);

  const [conversations, weak, docCount] = await Promise.all([
    db.conversation.findMany({
      where: { courseId: id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, mode: true, updatedAt: true, _count: { select: { messages: true } } },
    }),
    weakTopics(id),
    db.document.count({ where: { courseId: id } }),
  ]);

  if (docCount === 0) {
    return (
      <EmptyState icon={FileText} title="Add notes to use the tutor" action={<ButtonLink href={`/courses/${id}/notes`}>Upload notes</ButtonLink>}>
        The tutor answers from your course material, so it needs something to read first.
      </EmptyState>
    );
  }

  const requested = param("c");
  const activeId = requested === "new" ? null : (conversations.find((c) => c.id === requested) ?? conversations[0])?.id ?? null;
  const active = activeId ? conversations.find((c) => c.id === activeId) : null;
  const messages = activeId
    ? await db.chatMessage.findMany({
        where: { conversationId: activeId },
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      })
    : [];

  const explain = param("explain");
  const review = param("review");
  const autoPrompt = !activeId
    ? explain
      ? await explainPrompt(explain, id, user.id)
      : review
        ? await reviewPrompt(review, id, user.id)
        : null
    : null;
  const modeParam = param("mode");
  const initialMode: TutorMode = active && isTutorMode(active.mode) ? active.mode : isTutorMode(modeParam) ? modeParam : "explain";

  return (
    <TutorChat
      key={activeId ?? `new-${explain ?? review ?? modeParam ?? ""}`}
      courseId={id}
      conversationId={activeId}
      conversations={conversations.map((c) => ({
        id: c.id,
        title: c.title,
        mode: c.mode,
        messageCount: c._count.messages,
        when: relativeDay(c.updatedAt) === "today" ? "Today" : formatDate(c.updatedAt, "short"),
      }))}
      initialMessages={messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))}
      initialMode={initialMode}
      autoPrompt={autoPrompt}
      weakTopics={weak}
    />
  );
}
