"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, MessageSquareText, Plus, Square, Trash2 } from "lucide-react";
import { deleteConversation } from "@/app/actions/chat";
import { Markdown } from "@/components/Markdown";
import { LogoMark } from "@/components/Logo";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SectionTitle } from "@/components/ui/Typography";
import { cn } from "@/lib/cn";
import { TUTOR_MODES, type TutorMode } from "@/lib/tutor-modes";

type Message = { role: "user" | "assistant"; content: string };
type ConversationSummary = { id: string; title: string; mode: string; messageCount: number; when: string };

const MODE_OPTIONS = Object.entries(TUTOR_MODES).map(([value, m]) => ({ value, label: m.label, description: m.description }));

const STARTERS: Record<TutorMode, (weak?: string) => string[]> = {
  explain: (weak) => [
    weak ? `Explain ${weak} step by step.` : "Explain the hardest topic in my notes step by step.",
    "Summarise the key ideas I need to know for the exam.",
    "What's the difference between the concepts students most often confuse here?",
  ],
  socratic: (weak) => [
    weak ? `Help me work out ${weak} for myself.` : "Help me understand the main idea of my notes by asking me questions.",
    "I think I understand this topic. Test my reasoning.",
  ],
  quiz: (weak) => [weak ? `Quiz me on ${weak}.` : "Quiz me on the whole course.", "Give me a 5-question rapid-fire quiz."],
  eli5: (weak) => [weak ? `Explain ${weak} like I'm new to it.` : "Explain my notes in plain English.", "Give me an everyday analogy for the hardest idea."],
  exam: (weak) => [
    weak ? `What does a full-mark answer about ${weak} look like?` : "What questions are likely to come up in the exam?",
    "How should I structure a long-answer question?",
  ],
};

export function TutorChat({
  courseId,
  conversationId: initialConversationId,
  conversations,
  initialMessages,
  initialMode,
  autoPrompt,
  weakTopics,
}: {
  courseId: string;
  conversationId: string | null;
  conversations: ConversationSummary[];
  initialMessages: Message[];
  initialMode: TutorMode;
  autoPrompt: string | null;
  weakTopics: string[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [mode, setMode] = useState<TutorMode>(initialMode);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoSent = useRef(false);
  const base = `/courses/${courseId}/tutor`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);

    const appendToReply = (chunk: string) =>
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        next[next.length - 1] = { ...last, content: last.content + chunk };
        return next;
      });

    let newId: string | null = null;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/courses/${courseId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode, conversationId }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        appendToReply(`**Error:** ${await res.text()}`);
        return;
      }
      newId = res.headers.get("X-Conversation-Id");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToReply(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") appendToReply("\n\n**Error:** The connection dropped. Send your message again.");
    } finally {
      setBusy(false);
      abortRef.current = null;
      if (newId && newId !== conversationId) {
        setConversationId(newId);
        // Show the new conversation in the sidebar and give it a shareable URL.
        router.replace(`${base}?c=${newId}`, { scroll: false });
      } else {
        router.refresh();
      }
    }
  }

  // "Explain my mistake" / "Review with tutor" open a new chat with a prepared first message.
  useEffect(() => {
    if (autoPrompt && !autoSent.current && initialMessages.length === 0) {
      autoSent.current = true;
      void send(autoPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrompt]);

  const starters = STARTERS[mode](weakTopics[0]);
  const activeTitle = conversations.find((c) => c.id === conversationId)?.title ?? "New chat";

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Conversation list: sidebar on desktop, dropdown on small screens. */}
      <aside className="hidden lg:block">
        <ButtonLink href={`${base}?c=new&mode=${mode}`} variant="secondary" className="w-full">
          <Plus className="h-4 w-4" aria-hidden="true" /> New chat
        </ButtonLink>
        <nav aria-label="Saved chats" className="mt-3 space-y-1">
          {conversations.length === 0 && <p className="px-2 py-3 text-sm text-muted">Your chats will be saved here.</p>}
          {conversations.map((c) => {
            const isActive = c.id === conversationId;
            return (
              <div key={c.id} className={cn("group flex items-center rounded-xl transition-colors", isActive ? "bg-surface shadow-sm ring-1 ring-border" : "hover:bg-surface/70")}>
                <Link href={`${base}?c=${c.id}`} aria-current={isActive ? "page" : undefined} className="min-w-0 flex-1 px-3 py-2.5">
                  <span className={cn("block truncate text-sm", isActive && "font-medium")}>{c.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    {TUTOR_MODES[c.mode as TutorMode]?.label ?? c.mode} · {c.when}
                  </span>
                </Link>
                <form action={deleteConversation.bind(null, courseId, c.id)} className="pr-1.5">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 hover:text-bad focus-visible:opacity-100"
                    aria-label={`Delete chat: ${c.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            );
          })}
        </nav>
      </aside>

      <Card className="flex h-[calc(100dvh-17rem)] min-h-[32rem] flex-col p-0 sm:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display leading-tight font-semibold">{activeTitle}</h2>
              <p className="text-xs text-muted">Answers from your course notes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Tutor mode"
              value={mode}
              onChange={(v) => setMode(v as TutorMode)}
              options={MODE_OPTIONS}
              className="w-40"
            />
            <div className="lg:hidden">
              <Select
                aria-label="Switch chat"
                value={conversationId ?? "new"}
                onChange={(v) => router.push(`${base}?c=${v}`)}
                options={[{ value: "new", label: "+ New chat" }, ...conversations.map((c) => ({ value: c.id, label: c.title, description: c.when }))]}
                className="w-40"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
          {messages.length === 0 && (
            <div className="mx-auto max-w-xl animate-fade-up py-6 text-center">
              <LogoMark className="mx-auto h-10 w-10" />
              <SectionTitle className="mt-4">What do you want to work on?</SectionTitle>
              <p className="mt-1 text-sm text-muted">
                <Badge tone="accent" className="mr-1">{TUTOR_MODES[mode].label}</Badge>
                {TUTOR_MODES[mode].description}. Change the mode any time.
              </p>
              <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="cursor-pointer rounded-xl border border-border bg-surface px-4 py-3 text-sm transition-colors duration-150 hover:border-accent/60 hover:bg-accent-soft/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] whitespace-pre-wrap text-on-accent">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <LogoMark className="mt-1 h-7 w-7 shrink-0" />
                <div className="max-w-[90%] min-w-0 flex-1">
                  {m.content ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <span className="inline-flex items-center gap-2 py-1 text-sm text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Thinking…
                    </span>
                  )}
                </div>
              </div>
            ),
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="border-t border-border p-3 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-2/50 p-1.5 transition-colors focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
            <label htmlFor="tutor-input" className="sr-only">Message the tutor</label>
            <textarea
              id="tutor-input"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] outline-none placeholder:text-muted/70"
              rows={1}
              value={input}
              placeholder={mode === "quiz" ? "Type your answer, or name a topic to be quizzed on" : "Ask a question about your notes"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            {busy ? (
              <Button variant="secondary" className="h-10 w-10 px-0" onClick={() => abortRef.current?.abort()} aria-label="Stop generating">
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button type="submit" className="h-10 w-10 px-0" disabled={!input.trim()} aria-label="Send message">
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-muted">Enter to send · Shift + Enter for a new line</p>
        </form>
      </Card>
    </div>
  );
}
