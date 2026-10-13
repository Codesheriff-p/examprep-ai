"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { courseNotes } from "@/lib/notes";
import { weakTopics } from "@/lib/progress";
import { describeAIError, generateQuiz, gradeShortAnswers } from "@/lib/ai";
import { logSession } from "@/lib/study";
import type { ActionState } from "./types";

const QuizRequest = z.object({
  count: z.coerce.number().int().min(3).max(25),
  difficulty: z.enum(["easy", "medium", "hard"]),
  format: z.enum(["mcq", "short", "mixed"]),
  focus: z.enum(["all", "weak"]),
});

export async function createQuiz(
  courseId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireCourse(courseId);
  const parsed = QuizRequest.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { count, difficulty, format, focus } = parsed.data;

  let quizId: string;
  try {
    const [docs, weak, existing] = await Promise.all([
      courseNotes(courseId),
      focus === "weak" ? weakTopics(courseId) : Promise.resolve([]),
      db.question.findMany({
        where: { quiz: { courseId } },
        distinct: ["topic"],
        select: { topic: true },
      }),
    ]);
    const quiz = await generateQuiz({
      docs,
      count,
      difficulty,
      format,
      focusTopics: weak,
      existingTopics: existing.map((q) => q.topic),
    });
    const created = await db.quiz.create({
      data: {
        courseId,
        title: quiz.title,
        difficulty,
        questions: {
          create: quiz.questions.map((q, position) => ({
            position,
            type: q.type,
            prompt: q.prompt,
            options: q.type === "mcq" ? q.options : [],
            answer: q.type === "mcq" ? String(q.correctIndex) : q.modelAnswer,
            explanation: q.explanation,
            topic: q.topic,
          })),
        },
      },
    });
    quizId = created.id;
  } catch (err) {
    return { error: describeAIError(err) };
  }
  redirect(`/courses/${courseId}/quizzes/${quizId}`);
}

const MockRequest = z.object({
  count: z.coerce.number().int().min(10).max(30),
  timeLimit: z.coerce.number().int().min(10).max(180),
  difficulty: z.enum(["medium", "hard"]),
});

export async function createMockExam(
  courseId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireCourse(courseId);
  const parsed = MockRequest.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { count, timeLimit, difficulty } = parsed.data;

  let quizId: string;
  try {
    const [docs, existing, previous] = await Promise.all([
      courseNotes(courseId),
      db.question.findMany({ where: { quiz: { courseId } }, distinct: ["topic"], select: { topic: true } }),
      db.quiz.count({ where: { courseId, mode: "exam" } }),
    ]);
    const exam = await generateQuiz({
      docs,
      count,
      difficulty,
      format: "mixed",
      focusTopics: [],
      existingTopics: existing.map((q) => q.topic),
      purpose: "exam",
    });
    const created = await db.quiz.create({
      data: {
        courseId,
        title: `Mock exam ${previous + 1}`,
        difficulty,
        mode: "exam",
        timeLimit,
        questions: {
          create: exam.questions.map((q, position) => ({
            position,
            type: q.type,
            prompt: q.prompt,
            options: q.type === "mcq" ? q.options : [],
            answer: q.type === "mcq" ? String(q.correctIndex) : q.modelAnswer,
            explanation: q.explanation,
            topic: q.topic,
          })),
        },
      },
    });
    quizId = created.id;
  } catch (err) {
    return { error: describeAIError(err) };
  }
  redirect(`/courses/${courseId}/quizzes/${quizId}`);
}

export async function submitAttempt(
  courseId: string,
  quizId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user } = await requireCourse(courseId);
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, courseId },
    include: { questions: { orderBy: { position: "asc" } } },
  });
  if (!quiz) return { error: "Quiz not found." };

  const responses = new Map(
    quiz.questions.map((q) => [q.id, String(formData.get(`q_${q.id}`) ?? "").trim()]),
  );

  let attemptId: string;
  try {
    // Short answers that were left blank are simply wrong; only send real answers to Claude.
    const toGrade = quiz.questions
      .filter((q) => q.type === "short" && responses.get(q.id))
      .map((q) => ({ id: q.id, prompt: q.prompt, modelAnswer: q.answer, response: responses.get(q.id)! }));
    const grades = await gradeShortAnswers(await courseNotes(courseId), toGrade);

    const answers = quiz.questions.map((q) => {
      const response = responses.get(q.id) ?? "";
      if (q.type === "mcq") {
        const correct = response === q.answer;
        return { questionId: q.id, response, correct, feedback: correct ? "Correct." : "Not quite." };
      }
      const grade = grades.get(q.id);
      return {
        questionId: q.id,
        response,
        correct: grade?.correct ?? false,
        feedback: grade?.feedback ?? (response ? "Couldn't be graded." : "No answer given."),
      };
    });

    // Time taken comes from the browser; clamp it so a bad value can't distort stats.
    const reported = Number(formData.get("durationSec"));
    const maxSec = (quiz.timeLimit ?? 180) * 60 + 120;
    const durationSec = Number.isFinite(reported) ? Math.min(Math.max(Math.round(reported), 0), maxSec) : null;

    const attempt = await db.quizAttempt.create({
      data: {
        quizId,
        userId: user.id,
        score: answers.filter((a) => a.correct).length / answers.length,
        durationSec,
        answers: { create: answers },
      },
    });
    attemptId = attempt.id;
    if (durationSec) {
      await logSession(user.id, courseId, quiz.mode === "exam" ? "mock" : "quiz", Math.max(1, Math.round(durationSec / 60)));
    }
  } catch (err) {
    return { error: describeAIError(err) };
  }
  revalidatePath(`/courses/${courseId}`, "layout");
  redirect(`/courses/${courseId}/quizzes/${quizId}/attempts/${attemptId}`);
}

export async function deleteQuiz(courseId: string, quizId: string) {
  await requireCourse(courseId);
  await db.quiz.deleteMany({ where: { id: quizId, courseId } });
  revalidatePath(`/courses/${courseId}`, "layout");
}
