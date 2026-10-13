import { Skeleton } from "@/components/ui/Skeleton";

/** Shown inside the course layout (header and tabs stay put) while a section loads. */
export default function CourseSectionLoading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]" aria-busy="true" aria-label="Loading">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
