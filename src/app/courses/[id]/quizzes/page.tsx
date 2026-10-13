import { BookOpenCheck, Clock, GraduationCap, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { weakTopics } from "@/lib/progress";
import { deleteQuiz } from "@/app/actions/quizzes";
import { formatDate, percent, relativeDay } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Muted, SectionTitle } from "@/components/ui/Typography";
import { NewMockExamForm } from "./NewMockExamForm";
import { NewQuizForm } from "./NewQuizForm";

const DIFFICULTY_TONE: Record<string, BadgeTone> = { easy: "good", medium: "warn", hard: "bad" };

type QuizRow = {
  id: string;
  title: string;
  difficulty: string;
  mode: string;
  timeLimit: number | null;
  createdAt: Date;
  _count: { questions: number };
  attempts: { id: string; score: number }[];
};

function QuizCard({ courseId, quiz }: { courseId: string; quiz: QuizRow }) {
  const best = quiz.attempts.length ? Math.max(...quiz.attempts.map((a) => a.score)) : null;
  const isExam = quiz.mode === "exam";
  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{quiz.title}</p>
          <Badge tone={DIFFICULTY_TONE[quiz.difficulty] ?? "neutral"} className="capitalize">{quiz.difficulty}</Badge>
          {isExam && quiz.timeLimit && (
            <Badge tone="accent"><Clock className="h-3 w-3" aria-hidden="true" />{quiz.timeLimit} min</Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          <span className="tabular-nums">{quiz._count.questions}</span> questions · created {formatDate(quiz.createdAt, "short")} ({relativeDay(quiz.createdAt)})
          {quiz.attempts.length > 0 && <> · <span className="tabular-nums">{quiz.attempts.length}</span> attempt{quiz.attempts.length > 1 ? "s" : ""}</>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {best !== null && (
          <div className="mr-auto pr-2 sm:mr-0 sm:text-right">
            <p className="text-xs text-muted">Best</p>
            <p className="font-semibold tabular-nums">{percent(best)}</p>
          </div>
        )}
        {quiz.attempts[0] && (
          <ButtonLink variant="secondary" href={`/courses/${courseId}/quizzes/${quiz.id}/attempts/${quiz.attempts[0].id}`}>Results</ButtonLink>
        )}
        <ButtonLink href={`/courses/${courseId}/quizzes/${quiz.id}`}>
          {quiz.attempts.length ? "Retake" : isExam ? "Start exam" : "Start"}
        </ButtonLink>
        <form action={deleteQuiz.bind(null, courseId, quiz.id)}>
          <Button type="submit" variant="ghost" size="icon" className="hover:text-bad" aria-label={`Delete ${quiz.title}`} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  );
}

export default async function QuizzesPage({ params }: PageProps<"/courses/[id]/quizzes">) {
  const { id } = await params;
  await requireCourse(id);
  const [quizzes, docCount, weak] = await Promise.all([
    db.quiz.findMany({
      where: { courseId: id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { questions: true } },
        attempts: { orderBy: { createdAt: "desc" }, select: { id: true, score: true } },
      },
    }),
    db.document.count({ where: { courseId: id } }),
    weakTopics(id),
  ]);
  const exams = quizzes.filter((q) => q.mode === "exam");
  const practice = quizzes.filter((q) => q.mode !== "exam");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <section className="space-y-4" aria-labelledby="exams-heading">
          <div>
            <SectionTitle id="exams-heading">Mock exams</SectionTitle>
            <Muted className="mt-1">Timed papers under exam conditions. The best way to check you&apos;re ready.</Muted>
          </div>
          {exams.length === 0 ? (
            <EmptyState icon={GraduationCap} title="No mock exams yet">
              Create one when you&apos;ve covered most of the syllabus. It&apos;s timed and marked like the real thing.
            </EmptyState>
          ) : (
            exams.map((quiz) => <QuizCard key={quiz.id} courseId={id} quiz={quiz} />)
          )}
        </section>

        <section className="space-y-4" aria-labelledby="practice-heading">
          <div>
            <SectionTitle id="practice-heading">Practice quizzes</SectionTitle>
            <Muted className="mt-1">Short, untimed quizzes. Every answer updates your topic mastery.</Muted>
          </div>
          {practice.length === 0 ? (
            <EmptyState icon={BookOpenCheck} title="No quizzes yet">
              Generate your first quiz. Your answers will show which topics need more work.
            </EmptyState>
          ) : (
            practice.map((quiz) => <QuizCard key={quiz.id} courseId={id} quiz={quiz} />)
          )}
        </section>
      </div>
      <aside className="space-y-6">
        <NewQuizForm courseId={id} hasNotes={docCount > 0} weakTopics={weak} />
        <NewMockExamForm courseId={id} hasNotes={docCount > 0} />
      </aside>
    </div>
  );
}
