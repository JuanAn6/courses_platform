import { describe, expect, it } from "vitest";
import { EMPTY_DOC, plainText, safeHref, sanitizeDoc } from "./sanitize";

const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });

describe("sanitizeDoc", () => {
  it("keeps allowed structure and marks", () => {
    const input = doc(
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Title" }] },
      p({ type: "text", text: "Bold", marks: [{ type: "bold" }] }),
      { type: "bulletList", content: [{ type: "listItem", content: [p({ type: "text", text: "item" })] }] },
    );
    expect(sanitizeDoc(input).doc).toEqual(input);
    expect(sanitizeDoc(input).textLength).toBe(13);
  });

  it("drops unknown nodes, marks and attributes", () => {
    const { doc: out } = sanitizeDoc(
      doc(
        { type: "iframe", attrs: { src: "https://evil.com" } },
        p({ type: "text", text: "x", marks: [{ type: "textStyle", attrs: { color: "red" } }] }),
        { type: "heading", attrs: { level: 1, onclick: "alert(1)" }, content: [{ type: "text", text: "H" }] },
      ),
    );
    expect(out).toEqual(doc(p({ type: "text", text: "x" }), { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "H" }] }));
  });

  it("removes unsafe links but keeps their text", () => {
    const link = (href: string) => p({ type: "text", text: "click", marks: [{ type: "link", attrs: { href } }] });
    expect(sanitizeDoc(doc(link("javascript:alert(1)"))).doc).toEqual(doc(p({ type: "text", text: "click" })));
    expect(sanitizeDoc(doc(link("https://example.com"))).doc.content?.[0].content?.[0].marks).toEqual([
      { type: "link", attrs: { href: "https://example.com", target: "_blank", rel: "noopener noreferrer nofollow" } },
    ]);
  });

  it("allows uploaded and https images, and collects file ids", () => {
    const img = (src: string) => ({ type: "image", attrs: { src, alt: "a", onerror: "x" } });
    const result = sanitizeDoc(doc(img("/api/files/cmv5l6e6v0004y0k9hk66o6mi"), img("https://cdn.example.com/x.png"), img("http://x/y.png"), img("data:image/png;base64,AAA")));
    expect(result.doc.content).toHaveLength(2);
    expect(result.fileIds).toEqual(["cmv5l6e6v0004y0k9hk66o6mi"]);
    expect(result.doc.content?.[0].attrs).toEqual({ src: "/api/files/cmv5l6e6v0004y0k9hk66o6mi", alt: "a", title: null });
  });

  it("falls back to an empty document for garbage", () => {
    expect(sanitizeDoc(null).doc).toEqual(EMPTY_DOC);
    expect(sanitizeDoc({ type: "paragraph" }).doc).toEqual(EMPTY_DOC);
    expect(sanitizeDoc(doc()).doc).toEqual(EMPTY_DOC);
  });
});

describe("safeHref", () => {
  it.each([
    ["https://a.com/x", "https://a.com/x"],
    ["mailto:a@b.com", "mailto:a@b.com"],
    ["/learn", "/learn"],
    ["//evil.com", null],
    ["javascript:alert(1)", null],
    ["  JAVASCRIPT:alert(1)", null],
    ["data:text/html,x", null],
  ])("%s", (href, expected) => {
    expect(safeHref(href)).toBe(expected);
  });
});

describe("plainText", () => {
  it("extracts and truncates text", () => {
    const d = doc(p({ type: "text", text: "Hello" }), p({ type: "text", text: "world" }), { type: "image", attrs: { src: "https://x/y.png" } });
    expect(plainText(d)).toBe("Hello world [image]");
    expect(plainText(d, 6)).toBe("Hello…");
    expect(plainText(null)).toBe("");
  });
});
