import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, GraduationCap } from "lucide-react";
import { db } from "@/lib/db";
import { requireCourse } from "@/lib/auth";
import { PageTitle } from "@/components/ui/Typography";
import { TakeQuiz } from "./TakeQuiz";

export default async function QuizPage({ params }: PageProps<"/courses/[id]/quizzes/[quizId]">) {
  const { id, quizId } = await params;
  await requireCourse(id);
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, courseId: id },
    include: { questions: { orderBy: { position: "asc" } } },
  });
  if (!quiz) notFound();

  // Answers and explanations stay on the server until the attempt is submitted.
  const questions = quiz.questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options as string[],
    topic: q.topic,
  }));
  const isExam = quiz.mode === "exam";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/courses/${id}/quizzes`} className="inline-flex items-center gap-1 rounded-md text-sm text-muted hover:text-foreground">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Quizzes & exams
      </Link>
      <PageTitle className="mt-2">{quiz.title}</PageTitle>
      <p className="mt-1 mb-6 text-sm text-muted">
        <span className="tabular-nums">{questions.length}</span> questions · <span className="capitalize">{quiz.difficulty}</span>
        {isExam && quiz.timeLimit && <> · {quiz.timeLimit} minutes</>}
      </p>
      {isExam && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-accent/30 bg-accent-soft/60 p-4 text-sm">
          <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <p className="font-medium">Exam conditions</p>
            <p className="mt-0.5 text-muted">
              <Clock className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
              The clock started when you opened this page. Your paper is handed in automatically when time runs out.
              Close your notes. Answers are revealed after you finish.
            </p>
          </div>
        </div>
      )}
      <TakeQuiz courseId={id} quizId={quiz.id} questions={questions} timeLimit={isExam ? quiz.timeLimit : null} />
    </div>
  );
}
