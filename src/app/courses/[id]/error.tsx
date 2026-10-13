"use client";

import { ErrorPanel } from "@/components/ErrorPanel";

// Keeps the course header and tabs visible when one section fails.
export default function CourseError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorPanel error={error} retry={retry} />;
}
