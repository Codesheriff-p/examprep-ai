import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { addDays, toISODate } from "@/lib/format";

function icsDate(date: Date) {
  return toISODate(date).replace(/-/g, "");
}

function escape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** Exports the exam date and study plan as an .ics file for Google/Apple/Outlook calendars. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/courses/[id]/calendar">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in.", { status: 401 });
  const course = await db.course.findFirst({
    where: { id, userId: user.id },
    include: { plans: { include: { tasks: { orderBy: { date: "asc" } } }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!course) return new Response("Course not found.", { status: 404 });

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const events: string[] = [];
  const allDay = (uid: string, date: Date, summary: string, description: string) =>
    events.push(
      [
        "BEGIN:VEVENT",
        `UID:${uid}@examprep.ai`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${icsDate(date)}`,
        `DTEND;VALUE=DATE:${icsDate(addDays(date, 1))}`,
        `SUMMARY:${escape(summary)}`,
        `DESCRIPTION:${escape(description)}`,
        "END:VEVENT",
      ].join("\r\n"),
    );

  if (course.examDate) allDay(`exam-${course.id}`, course.examDate, `${course.title} exam`, "Good luck!");
  for (const task of course.plans[0]?.tasks ?? []) {
    allDay(`task-${task.id}`, task.date, `${course.title}: ${task.title} (${task.minutes} min)`, task.details);
  }

  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ExamPrep AI//Study plan//EN", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
  const filename = `${course.title.replace(/[^\w-]+/g, "-").toLowerCase()}-study-plan.ics`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
