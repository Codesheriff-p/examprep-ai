"use client";

import { useActionState, useState } from "react";
import { BookText, ChevronDown, FileText, Lightbulb, ListChecks, Sparkles, Trash2, Baby } from "lucide-react";
import { deleteDocument, summarizeDocumentAction } from "@/app/actions/notes";
import { FormMessage } from "@/components/FormMessage";
import { Markdown } from "@/components/Markdown";
import { SubmitButton } from "@/components/SubmitButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export type DocumentData = {
  id: string;
  title: string;
  content: string;
  words: number;
  addedLabel: string;
  summary: string | null;
  keyPoints: string[];
  keyTerms: { term: string; definition: string }[];
  simpleExplanation: string | null;
};

const TABS = [
  { id: "summary", label: "Summary", icon: BookText },
  { id: "points", label: "Key points", icon: ListChecks },
  { id: "terms", label: "Key terms", icon: Lightbulb },
  { id: "simple", label: "Simply put", icon: Baby },
  { id: "full", label: "Full text", icon: FileText },
] as const;

type Tab = (typeof TABS)[number]["id"];

export function DocumentCard({ courseId, doc }: { courseId: string; doc: DocumentData }) {
  const hasGuide = !!doc.summary;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(hasGuide ? "summary" : "full");
  const [state, summarize] = useActionState(async () => {
    const result = await summarizeDocumentAction(courseId, doc.id);
    if (result?.ok) {
      setOpen(true);
      setTab("summary");
    }
    return result;
  }, undefined);

  const panelId = `doc-${doc.id}`;
  return (
    <Card className="p-0 sm:p-0">
      <div className="flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <span className="block truncate font-medium">{doc.title}</span>
          <span className="block text-xs text-muted">
            <span className="tabular-nums">{doc.words.toLocaleString()}</span> words · added {doc.addedLabel}
            {hasGuide && <span className="text-good"> · study guide ready</span>}
          </span>
        </button>
        {!hasGuide && (
          <form action={summarize} className="hidden sm:block">
            <SubmitButton variant="soft" size="sm" pendingText="Summarising…">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Study guide
            </SubmitButton>
          </form>
        )}
        <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label={open ? "Collapse" : "Expand"}>
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")} />
        </Button>
      </div>

      {state?.error && <div className="px-5 pb-4"><FormMessage state={state} /></div>}

      {open && (
        <div id={panelId} className="border-t border-border px-5 pt-4 pb-5">
          <div role="tablist" aria-label="Document views" className="flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1 [scrollbar-width:none]">
            {TABS.map(({ id, label, icon: Icon }) => {
              const disabled = id !== "full" && !hasGuide;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  disabled={disabled}
                  onClick={() => setTab(id)}
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors",
                    tab === id && "bg-surface font-medium text-foreground shadow-sm",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" className="mt-4">
            {tab === "summary" && doc.summary && <Markdown>{doc.summary}</Markdown>}
            {tab === "points" && (
              <ol className="space-y-2">
                {doc.keyPoints.map((p, i) => (
                  <li key={i} className="flex gap-3 rounded-xl border border-border px-3.5 py-2.5 text-sm leading-relaxed">
                    <span className="font-mono text-xs leading-6 font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
                    {p}
                  </li>
                ))}
              </ol>
            )}
            {tab === "terms" && (
              <dl className="grid gap-2 sm:grid-cols-2">
                {doc.keyTerms.map((t) => (
                  <div key={t.term} className="rounded-xl bg-surface-2/70 px-3.5 py-2.5">
                    <dt className="text-sm font-semibold">{t.term}</dt>
                    <dd className="mt-0.5 text-sm leading-relaxed text-muted">{t.definition}</dd>
                  </div>
                ))}
              </dl>
            )}
            {tab === "simple" && doc.simpleExplanation && <Markdown>{doc.simpleExplanation}</Markdown>}
            {tab === "full" && (
              <pre className="max-h-96 overflow-auto rounded-xl bg-surface-2 p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                {doc.content.slice(0, 20000)}
                {doc.content.length > 20000 && "\n\n… Preview ends here. The AI uses the full text."}
              </pre>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            {!hasGuide ? (
              <form action={summarize}>
                <SubmitButton variant="soft" size="sm" pendingText="Summarising…">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Create study guide
                </SubmitButton>
              </form>
            ) : (
              <form action={summarize}>
                <SubmitButton variant="ghost" size="sm" pendingText="Regenerating…">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Regenerate guide
                </SubmitButton>
              </form>
            )}
            <form action={deleteDocument.bind(null, courseId, doc.id)}>
              <Button type="submit" variant="danger" size="sm">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove document
              </Button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
