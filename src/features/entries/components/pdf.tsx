"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";

// Copied to public/ by scripts/copy-pdf-worker.mjs (matches react-pdf's pdf.js version).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number>();
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

const loading = <p className="p-6 text-center text-sm text-muted-foreground">Loading document…</p>;
const failed = <p className="p-6 text-center text-sm text-destructive">The document couldn&apos;t be displayed. Try downloading it.</p>;

/** All pages, stacked (documents). */
export function PdfPages({ url }: { url: string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [pages, setPages] = useState(0);
  return (
    // min-w-0 + overflow-hidden: the measured width must never grow because of its own content.
    <div ref={ref} className="grid w-full min-w-0 gap-4 overflow-hidden">
      <Document file={url} loading={loading} error={failed} onLoadSuccess={(pdf) => setPages(pdf.numPages)}>
        {width
          ? Array.from({ length: pages }, (_, i) => (
              // Subtract the 2px border so the page fits exactly.
              <Page key={i} pageNumber={i + 1} width={width - 2} className="mb-4 overflow-hidden rounded-md border shadow-sm" />
            ))
          : null}
      </Document>
    </div>
  );
}

/** One page at a time (presentations). Reports the current page and page count. */
export function PdfSlides({
  url,
  initialPage = 1,
  onPage,
}: {
  url: string;
  initialPage?: number;
  onPage?: (page: number, total: number) => void;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(Math.max(1, initialPage));
  const frame = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  // Stable, and applies the starting page only once: react-pdf calls onLoadSuccess again
  // whenever the callback changes, which would otherwise jump back to the first slide.
  const onLoadSuccess = useCallback(
    (pdf: { numPages: number }) => {
      setTotal(pdf.numPages);
      if (loaded.current) return;
      loaded.current = true;
      const start = Math.min(Math.max(1, initialPage), pdf.numPages);
      setPage(start);
      onPage?.(start, pdf.numPages);
    },
    [initialPage, onPage],
  );

  const go = useCallback(
    (next: number) => {
      if (!total) return;
      const clamped = Math.min(Math.max(1, next), total);
      setPage(clamped);
      onPage?.(clamped, total);
    },
    [total, onPage],
  );

  return (
    <div
      ref={frame}
      tabIndex={0}
      className="grid gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring [&:fullscreen]:bg-black [&:fullscreen]:p-6"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
          e.preventDefault();
          go(page + 1);
        } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
          e.preventDefault();
          go(page - 1);
        }
      }}
      aria-label="Presentation. Use the arrow keys to change slides."
    >
      <div ref={ref} className="min-w-0 overflow-hidden rounded-md border bg-muted/30">
        <Document
          file={url}
          loading={loading}
          error={failed}
          onLoadSuccess={onLoadSuccess}
        >
          {width ? <Page pageNumber={page} width={width} renderTextLayer={false} renderAnnotationLayer={false} /> : null}
        </Document>
      </div>
      {total ? (
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous slide">
            <ChevronLeft /> Previous
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
            Slide {page} of {total}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => frame.current?.requestFullscreen?.()} aria-label="Full screen">
              <Maximize />
            </Button>
            <Button variant="outline" size="sm" onClick={() => go(page + 1)} disabled={page >= total} aria-label="Next slide">
              Next <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
