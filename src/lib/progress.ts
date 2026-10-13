import "server-only";
import { db } from "@/lib/db";

export type TopicStat = { topic: string; correct: number; total: number; accuracy: number };

/** Per-topic accuracy across every quiz answer the student has given in a course. */
export async function topicMastery(courseId: string): Promise<TopicStat[]> {
  const answers = await db.attemptAnswer.findMany({
    where: { attempt: { quiz: { courseId } } },
    select: { correct: true, question: { select: { topic: true } } },
  });

  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const a of answers) {
    const topic = a.question.topic;
    const s = byTopic.get(topic) ?? { correct: 0, total: 0 };
    s.total += 1;
    if (a.correct) s.correct += 1;
    byTopic.set(topic, s);
  }

  return [...byTopic.entries()]
    .map(([topic, s]) => ({ topic, ...s, accuracy: s.correct / s.total }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

/** Topics the student is getting wrong most often (below 70% accuracy). */
export async function weakTopics(courseId: string, limit = 5) {
  const stats = await topicMastery(courseId);
  return stats.filter((s) => s.accuracy < 0.7).slice(0, limit).map((s) => s.topic);
}

export async function courseSummary(courseId: string) {
  const [attempts, dueCards, totalCards, docs] = await Promise.all([
    db.quizAttempt.findMany({
      where: { quiz: { courseId } },
      orderBy: { createdAt: "asc" },
      select: { score: true, createdAt: true, quiz: { select: { title: true } } },
    }),
    db.flashcard.count({ where: { courseId, dueAt: { lte: new Date() } } }),
    db.flashcard.count({ where: { courseId } }),
    db.document.count({ where: { courseId } }),
  ]);
  const average = attempts.length
    ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length
    : null;
  return { attempts, average, dueCards, totalCards, docs };
}
