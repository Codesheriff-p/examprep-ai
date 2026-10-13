import "server-only";
import { db } from "@/lib/db";

/** All notes for a course in upload order — the order matters for prompt caching. */
export function courseNotes(courseId: string) {
  return db.document.findMany({
    where: { courseId },
    orderBy: { createdAt: "asc" },
    select: { title: true, content: true },
  });
}
