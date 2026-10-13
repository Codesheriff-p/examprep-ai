"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCourse, requireUser } from "@/lib/auth";
import type { ActionState } from "./types";

const CourseSchema = z.object({
  title: z.string().trim().min(1, "Give the course a name."),
  description: z.string().trim().optional(),
  examDate: z.string().optional(),
});

function parseDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(`${value}T09:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createCourse(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = CourseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const course = await db.course.create({
    data: {
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      examDate: parseDate(parsed.data.examDate),
    },
  });
  redirect(`/courses/${course.id}/notes`);
}

export async function updateCourse(
  courseId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireCourse(courseId);
  const parsed = CourseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await db.course.update({
    where: { id: courseId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      examDate: parseDate(parsed.data.examDate),
    },
  });
  revalidatePath(`/courses/${courseId}`, "layout");
  return { ok: "Saved." };
}

export async function deleteCourse(courseId: string) {
  await requireCourse(courseId);
  await db.course.delete({ where: { id: courseId } });
  redirect("/dashboard");
}
