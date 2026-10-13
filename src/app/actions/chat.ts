"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";

export async function deleteConversation(courseId: string, conversationId: string) {
  await requireCourse(courseId);
  await db.conversation.deleteMany({ where: { id: conversationId, courseId } });
  revalidatePath(`/courses/${courseId}/tutor`);
  redirect(`/courses/${courseId}/tutor`);
}
