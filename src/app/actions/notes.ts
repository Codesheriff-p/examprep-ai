"use server";

import { revalidatePath } from "next/cache";
import { extractText, getDocumentProxy } from "unpdf";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { describeAIError, summarizeDocument } from "@/lib/ai";
import type { ActionState } from "./types";

async function fileToText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  return new TextDecoder().decode(bytes);
}

export async function addNotes(
  courseId: string,
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireCourse(courseId);

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const pastedTitle = String(formData.get("title") ?? "").trim();
  const pasted = String(formData.get("text") ?? "").trim();

  const docs: { title: string; content: string }[] = [];
  for (const file of files) {
    try {
      const content = (await fileToText(file)).trim();
      if (!content) {
        return { error: `No text found in ${file.name}. Scanned PDFs need OCR first.` };
      }
      docs.push({ title: file.name.replace(/\.[^.]+$/, ""), content });
    } catch (err) {
      console.error(err);
      return { error: `Couldn't read ${file.name}. Upload a PDF, .txt or .md file.` };
    }
  }
  if (pasted) docs.push({ title: pastedTitle || "Pasted notes", content: pasted });

  if (docs.length === 0) return { error: "Choose a file or paste some notes." };

  await db.document.createMany({ data: docs.map((d) => ({ ...d, courseId })) });
  revalidatePath(`/courses/${courseId}`, "layout");
  return { ok: `Added ${docs.length} document${docs.length > 1 ? "s" : ""}.` };
}

export async function deleteDocument(courseId: string, documentId: string) {
  await requireCourse(courseId);
  await db.document.deleteMany({ where: { id: documentId, courseId } });
  revalidatePath(`/courses/${courseId}`, "layout");
}

export async function summarizeDocumentAction(courseId: string, documentId: string): Promise<ActionState> {
  await requireCourse(courseId);
  const doc = await db.document.findFirst({ where: { id: documentId, courseId } });
  if (!doc) return { error: "Document not found." };
  try {
    const guide = await summarizeDocument({ title: doc.title, content: doc.content });
    await db.document.update({
      where: { id: doc.id },
      data: { ...guide, summarizedAt: new Date() },
    });
  } catch (err) {
    return { error: describeAIError(err) };
  }
  revalidatePath(`/courses/${courseId}/notes`);
  return { ok: "Study guide ready." };
}
