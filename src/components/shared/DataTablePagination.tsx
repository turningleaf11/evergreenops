// DataTablePagination — plain page-number pager used by DataTable's
// pageSize prop. Named to avoid colliding with the existing shadcn
// src/components/ui/pagination.tsx (different, lower-level API —
// Pagination/PaginationContent/PaginationItem). Ported from
// autumn-design-system/src/components/ui/pagination.tsx.

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

function pageList(page: number, pageCount: number): (number | "ellipsis")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) result.push("ellipsis");
    result.push(p);
  });
  return result;
}

export function DataTablePagination({ page, pageCount, onPageChange, totalItems, pageSize, className }: Props) {
  if (pageCount <= 1) return null;

  const rangeLabel =
    totalItems !== undefined && pageSize !== undefined
      ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalItems)} of ${totalItems}`
      : null;

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      {rangeLabel && <span className="text-xs text-muted-foreground">{rangeLabel}</span>}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {pageList(page, pageCount).map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e${i}`} className="px-1 text-xs text-muted-foreground/60">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                "inline-flex items-center justify-center h-7 w-7 rounded-md text-xs font-medium transition-colors",
                p === page ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
