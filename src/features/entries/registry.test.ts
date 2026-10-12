import { describe, expect, it } from "vitest";
import { completionThreshold, parseContent, prepareContent, publishProblems, referencedFiles, trackingFor } from "./registry";

const textDoc = (text: string) => ({ doc: { type: "doc", content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] } });

describe("entry registry", () => {
  it("fills defaults for empty content", () => {
    expect(parseContent("VIDEO", undefined)).toEqual({ source: "file", fileId: null, url: null, completionPercent: 90 });
    expect(parseContent("DOCUMENT", null)).toEqual({ fileIds: [] });
    expect(parseContent("EMBED", { height: "9999" })).toEqual({ url: null, height: 600 });
  });

  it("reports what's missing before publishing", () => {
    expect(publishProblems("TEXT", textDoc(""))).toEqual(["Write some text."]);
    expect(publishProblems("TEXT", textDoc("Hello"))).toEqual([]);
    expect(publishProblems("VIDEO", { source: "file" })).toEqual(["Upload a video."]);
    expect(publishProblems("VIDEO", { source: "url", url: "https://example.com/v" })).toHaveLength(1);
    expect(publishProblems("VIDEO", { source: "url", url: "https://youtu.be/dQw4w9WgXcQ" })).toEqual([]);
    expect(publishProblems("DOCUMENT", { fileIds: ["f1"] })).toEqual([]);
    expect(publishProblems("LINK", { url: "javascript:alert(1)" })).toHaveLength(1);
    expect(publishProblems("EMBED", { url: "https://evil.com" })).toHaveLength(1);
    expect(publishProblems("PRESENTATION", { source: "url", url: "https://docs.google.com/presentation/d/x/edit" })).toEqual([]);
  });

  it("lists referenced files", () => {
    expect(referencedFiles("DOCUMENT", { fileIds: ["a", "b", "a"] })).toEqual(["a", "b"]);
    expect(referencedFiles("VIDEO", { source: "url", fileId: "stale", url: "x", completionPercent: 90 })).toEqual([]);
    expect(referencedFiles("AUDIO", { fileId: "a1", completionPercent: 90 })).toEqual(["a1"]);
    const { fileIds } = prepareContent("TEXT", {
      doc: { type: "doc", content: [{ type: "image", attrs: { src: "/api/files/cmv5l6e6v0004y0k9hk66o6mi" } }] },
    });
    expect(fileIds).toEqual(["cmv5l6e6v0004y0k9hk66o6mi"]);
  });

  it("sanitizes rich text on prepare", () => {
    const { content } = prepareContent("TEXT", { doc: { type: "doc", content: [{ type: "script", text: "x" }] } });
    expect(content).toEqual({ doc: { type: "doc", content: [{ type: "paragraph" }] } });
  });

  it("chooses how progress is tracked", () => {
    expect(trackingFor("VIDEO", { source: "file" })).toBe("media");
    expect(trackingFor("VIDEO", { source: "url" })).toBe("manual");
    expect(trackingFor("PRESENTATION", { source: "file" })).toBe("pages");
    expect(trackingFor("LINK", {})).toBe("link");
    expect(trackingFor("TEXT", {})).toBe("manual");
    expect(completionThreshold("VIDEO", { completionPercent: 75 })).toBe(75);
    expect(completionThreshold("TEXT", {})).toBe(100);
  });
});
