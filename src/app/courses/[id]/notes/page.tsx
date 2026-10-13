import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { formatDate, relativeDay } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Muted, SectionTitle } from "@/components/ui/Typography";
import { DocumentCard, type DocumentData } from "./DocumentCard";
import { Glossary } from "./Glossary";
import { NotesUpload } from "./NotesUpload";

export default async function NotesPage({ params }: PageProps<"/courses/[id]/notes">) {
  const { id } = await params;
  await requireCourse(id);
  const docs = await db.document.findMany({ where: { courseId: id }, orderBy: { createdAt: "asc" } });

  const data: DocumentData[] = docs.map((d) => ({
    id: d.id,
    title: d.title,
    content: d.content,
    words: d.content.split(/\s+/).filter(Boolean).length,
    addedLabel: `${formatDate(d.createdAt, "short")} (${relativeDay(d.createdAt)})`,
    summary: d.summary,
    keyPoints: (d.keyPoints as string[] | null) ?? [],
    keyTerms: (d.keyTerms as { term: string; definition: string }[] | null) ?? [],
    simpleExplanation: d.simpleExplanation,
  }));
  const totalWords = data.reduce((sum, d) => sum + d.words, 0);
  const terms = data.flatMap((d) => d.keyTerms.map((t) => ({ ...t, source: d.title })));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="space-y-4">
        <div>
          <SectionTitle>Course notes</SectionTitle>
          <Muted className="mt-1">
            Quizzes, flashcards, your study plan and the tutor all work from these documents.
            {docs.length > 0 && (
              <> <span className="tabular-nums">{docs.length}</span> documents · <span className="tabular-nums">{totalWords.toLocaleString()}</span> words.</>
            )}
          </Muted>
        </div>
        {docs.length === 0 && (
          <EmptyState icon={FileText} title="No notes yet">
            Upload a PDF or paste some text to get started.
          </EmptyState>
        )}
        {data.map((doc) => <DocumentCard key={doc.id} courseId={id} doc={doc} />)}
      </section>
      <aside className="space-y-6">
        <NotesUpload courseId={id} />
        {terms.length > 0 && <Glossary terms={terms} />}
      </aside>
    </div>
  );
}
