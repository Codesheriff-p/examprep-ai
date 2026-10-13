import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { courseNotes } from "@/lib/notes";
import { describeAIError, streamTutorReply } from "@/lib/ai";
import { TUTOR_MODES, type TutorMode } from "@/lib/tutor-modes";

// How many earlier messages the tutor sees. Older turns stay in the database.
const HISTORY_LIMIT = 40;

const Body = z.object({
  message: z.string().trim().min(1).max(8000),
  conversationId: z.string().nullish(),
  mode: z.enum(Object.keys(TUTOR_MODES) as [TutorMode, ...TutorMode[]]).default("explain"),
});

function titleFrom(message: string) {
  const line = message.replace(/\s+/g, " ").trim();
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

/**
 * Streams the tutor's reply as plain text, then stores both sides of the exchange.
 * Without a conversationId a new conversation is created; its id is returned in the
 * X-Conversation-Id header so the client can keep using it.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/courses/[id]/chat">) {
  const { id: courseId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in.", { status: 401 });
  const course = await db.course.findFirst({ where: { id: courseId, userId: user.id } });
  if (!course) return new Response("Course not found.", { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Message is empty or too long.", { status: 400 });
  const { message, mode } = parsed.data;

  let conversation = parsed.data.conversationId
    ? await db.conversation.findFirst({ where: { id: parsed.data.conversationId, courseId } })
    : null;
  if (parsed.data.conversationId && !conversation) return new Response("Conversation not found.", { status: 404 });

  const [docs, previous] = await Promise.all([
    courseNotes(courseId),
    conversation
      ? db.chatMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: "desc" },
          take: HISTORY_LIMIT,
          select: { role: true, content: true },
        })
      : Promise.resolve([]),
  ]);

  const history = previous.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  // The API requires the conversation to start with a user turn.
  while (history.length && history[0].role !== "user") history.shift();
  history.push({ role: "user", content: message });

  let stream: ReturnType<typeof streamTutorReply>;
  try {
    stream = streamTutorReply(docs, history, mode);
  } catch (err) {
    return new Response(describeAIError(err), { status: 400 });
  }

  conversation ??= await db.conversation.create({ data: { courseId, title: titleFrom(message), mode } });
  const conversationId = conversation.id;

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
        for await (const text of stream.chunks) {
          reply += text;
          controller.enqueue(encoder.encode(text));
        }
        await db.$transaction([
          db.chatMessage.createMany({
            data: [
              { conversationId, role: "user", content: message },
              { conversationId, role: "assistant", content: reply },
            ],
          }),
          db.conversation.update({ where: { id: conversationId }, data: { mode } }),
        ]);
      } catch (err) {
        // The browser may have stopped the reply; then the stream is already closed.
        try {
          controller.enqueue(encoder.encode(`\n\n**Error:** ${describeAIError(err)}`));
        } catch {}
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": conversationId,
    },
  });
}
