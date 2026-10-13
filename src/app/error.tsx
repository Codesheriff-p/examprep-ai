"use client";

import { ErrorPanel } from "@/components/ErrorPanel";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="main" className="flex flex-1 items-center justify-center">
      <ErrorPanel error={error} retry={retry} />
    </main>
  );
}
