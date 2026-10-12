"use client";

import dynamic from "next/dynamic";

const fallback = () => <p className="p-6 text-center text-sm text-muted-foreground">Loading document…</p>;

/** pdf.js needs browser APIs, so the viewers load on the client only. */
export const PdfPages = dynamic(() => import("./pdf").then((m) => m.PdfPages), { ssr: false, loading: fallback });
export const PdfSlides = dynamic(() => import("./pdf").then((m) => m.PdfSlides), { ssr: false, loading: fallback });
