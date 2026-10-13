"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { courseNotes } from "@/lib/notes";
import { weakTopics } from "@/lib/progress";
import { describeAIError, generateFlashcards } from "@/lib/ai";
import { schedule, type Grade } from "@/lib/srs";
import { logFlashcardReview } from "@/lib/study";
import type { ActionState } from "./types";

const Request = z.object({
  count: z.coerce.number().int().min(5).max(40),
  focus: z.enum(["all", "weak"]),
});

export async function createFlashcards(
  courseId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireCourse(courseId);
  const parsed = Request.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const [docs, weak, existing] = await Promise.all([
      courseNotes(courseId),
      parsed.data.focus === "weak" ? weakTopics(courseId) : Promise.resolve([]),
      db.flashcard.findMany({ where: { courseId }, select: { front: true } }),
    ]);
    const cards = await generateFlashcards({
      docs,
      count: parsed.data.count,
      focusTopics: weak,
      existingFronts: existing.map((c) => c.front),
    });
    await db.flashcard.createMany({ data: cards.map((c) => ({ ...c, courseId })) });
    revalidatePath(`/courses/${courseId}`, "layout");
    return { ok: `Added ${cards.length} flashcards.` };
  } catch (err) {
    return { error: describeAIError(err) };
  }
}

export async function reviewCard(courseId: string, cardId: string, grade: Grade) {
  const { user } = await requireCourse(courseId);
  const card = await db.flashcard.findFirst({ where: { id: cardId, courseId } });
  if (!card) return;
  await db.flashcard.update({ where: { id: card.id }, data: schedule(card, grade) });
  await logFlashcardReview(user.id, courseId);
  revalidatePath(`/courses/${courseId}`, "layout");
}

export async function deleteCard(courseId: string, cardId: string) {
  await requireCourse(courseId);
  await db.flashcard.deleteMany({ where: { id: cardId, courseId } });
  revalidatePath(`/courses/${courseId}`, "layout");
}
