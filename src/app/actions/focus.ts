"use server";

import { revalidatePath } from "next/cache";
import { requireCourse } from "@/lib/auth";
import { logSession } from "@/lib/study";

/** Records a completed focus-timer block. */
export async function logFocusSession(courseId: string, minutes: number) {
  const { user } = await requireCourse(courseId);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) return;
  await logSession(user.id, courseId, "focus", minutes);
  revalidatePath(`/courses/${courseId}`, "layout");
  revalidatePath("/dashboard");
}
