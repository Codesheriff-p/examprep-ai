"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";

type Term = { term: string; definition: string; source: string };

export function Glossary({ terms }: { terms: Term[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...terms].sort((a, b) => a.term.localeCompare(b.term));
    return q ? sorted.filter((t) => `${t.term} ${t.definition}`.toLowerCase().includes(q)) : sorted;
  }, [terms, query]);

  return (
    <Card>
      <CardHeader title="Glossary" description={`${terms.length} key terms from your study guides`} />
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <label htmlFor="glossary-search" className="sr-only">Search terms</label>
        <Input id="glossary-search" className="pl-9" placeholder="Search terms" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <dl className="mt-3 max-h-[28rem] divide-y divide-border overflow-y-auto">
        {filtered.map((t) => (
          <div key={`${t.source}-${t.term}`} className="py-2.5">
            <dt className="text-sm font-semibold">{t.term}</dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-muted">{t.definition}</dd>
          </div>
        ))}
        {filtered.length === 0 && <p className="py-4 text-center text-sm text-muted">No terms match “{query}”.</p>}
      </dl>
    </Card>
  );
}
