import { FileText, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { weakTopics } from "@/lib/progress";
import { deleteCard } from "@/app/actions/flashcards";
import { formatDate, relativeDay } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Muted, SectionTitle } from "@/components/ui/Typography";
import { NewFlashcardsForm } from "./NewFlashcardsForm";
import { ReviewDeck } from "./ReviewDeck";

export default async function FlashcardsPage({ params }: PageProps<"/courses/[id]/flashcards">) {
  const { id } = await params;
  await requireCourse(id);
  const now = new Date();
  const [cards, weak, docCount] = await Promise.all([
    db.flashcard.findMany({ where: { courseId: id }, orderBy: { dueAt: "asc" } }),
    weakTopics(id),
    db.document.count({ where: { courseId: id } }),
  ]);
  const due = cards.filter((c) => c.dueAt <= now);
  const upcoming = cards.filter((c) => c.dueAt > now);
  const nextDue = upcoming[0]?.dueAt;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-6">
        <div>
          <SectionTitle>Review</SectionTitle>
          <Muted className="mt-1">
            <span className="tabular-nums">{due.length}</span> due now · <span className="tabular-nums">{cards.length}</span> in your deck
            {nextDue && <> · next card {relativeDay(nextDue)}</>}. Cards you find hard come back sooner.
          </Muted>
        </div>
        <ReviewDeck courseId={id} cards={due.map((c) => ({ id: c.id, front: c.front, back: c.back, topic: c.topic }))} />
        {cards.length > 0 && (
          <Card className="p-0 sm:p-0">
            <details>
              <summary className="cursor-pointer p-5 font-medium">Browse all cards ({cards.length})</summary>
              <ul className="divide-y divide-border border-t border-border">
                {cards.map((c) => {
                  const isDue = c.dueAt <= now;
                  return (
                    <li key={c.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{c.front}</p>
                        <p className="mt-0.5 text-muted">{c.back}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={isDue ? "accent" : "neutral"} title={formatDate(c.dueAt, "long")}>
                          {isDue ? "Due" : relativeDay(c.dueAt)}
                        </Badge>
                        <form action={deleteCard.bind(null, id, c.id)}>
                          <Button type="submit" variant="ghost" size="icon-sm" className="hover:text-bad" aria-label="Delete card" title="Delete card">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </details>
          </Card>
        )}
      </section>
      <aside>
        {docCount === 0 ? (
          <EmptyState icon={FileText} title="Add notes first">Flashcards are made from your course notes.</EmptyState>
        ) : (
          <NewFlashcardsForm courseId={id} weakTopics={weak} />
        )}
      </aside>
    </div>
  );
}
