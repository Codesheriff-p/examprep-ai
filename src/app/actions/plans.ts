"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { courseNotes } from "@/lib/notes";
import { topicMastery } from "@/lib/progress";
import { describeAIError, generateStudyPlan } from "@/lib/ai";
import type { ActionState } from "./types";

const MAX_PLAN_DAYS = 28;

const Request = z.object({
  minutesPerDay: z.coerce.number().int().min(15).max(600),
});

function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function createPlan(
  courseId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { course } = await requireCourse(courseId);
  const parsed = Request.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const start = new Date();
  start.setHours(12, 0, 0, 0);
  // Plan up to the exam (capped), or two weeks if no exam date is set.
  let end = new Date(start);
  end.setDate(end.getDate() + 13);
  if (course.examDate && course.examDate > start) end = new Date(course.examDate);
  const cap = new Date(start);
  cap.setDate(cap.getDate() + MAX_PLAN_DAYS - 1);
  if (end > cap) end = cap;

  try {
    const [docs, mastery] = await Promise.all([courseNotes(courseId), topicMastery(courseId)]);
    const plan = await generateStudyPlan({
      docs,
      courseTitle: course.title,
      startDate: isoDay(start),
      endDate: isoDay(end),
      examDate: course.examDate ? isoDay(course.examDate) : null,
      minutesPerDay: parsed.data.minutesPerDay,
      mastery,
    });

    const tasks = plan.days.flatMap((day) => {
      const date = new Date(`${day.date}T12:00:00`);
      if (Number.isNaN(date.getTime())) return [];
      return day.tasks.map((t) => ({ ...t, date }));
    });

    // Keep one active plan per course: the new plan replaces the old one.
    await db.$transaction([
      db.studyPlan.deleteMany({ where: { courseId } }),
      db.studyPlan.create({
        data: { courseId, summary: plan.summary, tasks: { create: tasks } },
      }),
    ]);
    revalidatePath(`/courses/${courseId}`, "layout");
    return { ok: "Study plan ready." };
  } catch (err) {
    return { error: describeAIError(err) };
  }
}

export async function toggleTask(courseId: string, taskId: string, done: boolean) {
  await requireCourse(courseId);
  await db.studyTask.updateMany({
    where: { id: taskId, plan: { courseId } },
    data: { done },
  });
  revalidatePath(`/courses/${courseId}`, "layout");
  revalidatePath("/dashboard");
}
