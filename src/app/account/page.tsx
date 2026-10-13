import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { studyStats } from "@/lib/study";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Muted, PageTitle } from "@/components/ui/Typography";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const metadata = { title: "My account · ExamPrep AI" };

export default async function AccountPage() {
  const user = await requireUser();
  const stats = await studyStats(user.id);

  return (
    <>
      <AppHeader userName={user.name} streak={stats.streak} />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 rounded-md text-sm text-muted transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> My courses
        </Link>
        <PageTitle className="mt-2">My account</PageTitle>
        <Muted className="mt-2">Manage your login details.</Muted>

        <div className="mt-8 space-y-6">
          <Card>
            <CardHeader title="Profile" />
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[120px_1fr]">
              <dt className="text-muted">Name</dt>
              <dd className="font-medium">{user.name}</dd>
              <dt className="text-muted">Email</dt>
              <dd className="font-medium break-all">{user.email}</dd>
            </dl>
          </Card>
          <ChangePasswordForm />
        </div>
      </main>
    </>
  );
}
