import { Skeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <>
      <div className="h-14 border-b border-border bg-surface" />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10" aria-busy="true" aria-label="Loading your courses">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-8 w-72" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="grid content-start gap-4 sm:grid-cols-2">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </main>
    </>
  );
}
