"use client";

import { useMemo, useState } from "react";
import type { Programme } from "@/lib/programmes";
import { EmptyState } from "@/components/ui";
import { ProgrammeCard } from "@/components/programme-card";

export function ProgrammeCatalog({ programmes }: { programmes: Programme[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = useMemo(() => ["All", ...new Set(programmes.map((p) => p.category).filter(Boolean))], [programmes]);
  const visible = useMemo(() => programmes.filter((programme) => {
    const matchesCategory = category === "All" || programme.category === category;
    const matchesQuery = `${programme.name} ${programme.summary} ${programme.category}`.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  }), [category, programmes, query]);

  if (!programmes.length) return <EmptyState title="No programmes are available">Training programmes will appear here after Tamark publishes them.</EmptyState>;

  return (
    <>
      <div className="catalog-tools">
        <label className="sr-only" htmlFor="programme-search">Search training programmes</label>
        <input id="programme-search" className="catalog-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search programmes" />
        <div className="filter-row" aria-label="Filter by category">
          {categories.map((item) => <button className="filter-chip" type="button" aria-pressed={category === item} key={item} onClick={() => setCategory(item)}>{item}</button>)}
        </div>
      </div>
      {visible.length ? <div className="programme-grid">{visible.map((programme) => <ProgrammeCard key={programme.id} programme={programme} />)}</div> : <EmptyState title="No matching programmes">Try a different search or category.</EmptyState>}
    </>
  );
}
