import { describe, expect, it } from "vitest";
import { isHttpUrl, toEmbedUrl, videoEmbedUrl } from "./embeds";

describe("videoEmbedUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://m.youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
    ["https://vimeo.com/123456789", "https://player.vimeo.com/video/123456789"],
    ["https://vimeo.com/123456789/abcdef12", "https://player.vimeo.com/video/123456789?h=abcdef12"],
  ])("%s", (input, expected) => {
    expect(videoEmbedUrl(input)).toBe(expected);
  });

  it("rejects other URLs", () => {
    expect(videoEmbedUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(videoEmbedUrl("https://youtube.com/watch?v=short")).toBeNull();
  });
});

describe("toEmbedUrl", () => {
  it("embeds supported providers", () => {
    expect(toEmbedUrl("https://docs.google.com/presentation/d/abc123/edit#slide=id.p")).toBe(
      "https://docs.google.com/presentation/d/abc123/embed",
    );
    expect(toEmbedUrl("https://docs.google.com/document/d/abc123/edit")).toBe("https://docs.google.com/document/d/abc123/preview");
    expect(toEmbedUrl("https://docs.google.com/forms/d/e/xyz/viewform")).toBe(
      "https://docs.google.com/forms/d/e/xyz/viewform?embedded=true",
    );
    expect(toEmbedUrl("https://drive.google.com/file/d/FILEID/view?usp=sharing")).toBe("https://drive.google.com/file/d/FILEID/preview");
    expect(toEmbedUrl("https://myschool.h5p.com/content/1291")).toBe("https://myschool.h5p.com/content/1291");
    expect(toEmbedUrl("https://www.canva.com/design/DAF1/abc/edit")).toBe("https://www.canva.com/design/DAF1/abc/view?embed");
    expect(toEmbedUrl("https://www.figma.com/design/key/Name")).toMatch(/^https:\/\/www\.figma\.com\/embed\?/);
  });

  it("never embeds unknown or unsafe URLs", () => {
    expect(toEmbedUrl("https://evil.example.com/page")).toBeNull();
    expect(toEmbedUrl("https://docs.google.com.evil.com/presentation/d/x/edit")).toBeNull();
    expect(toEmbedUrl("data:text/html,<script>")).toBeNull();
    expect(toEmbedUrl("not a url")).toBeNull();
  });

  it("recognizes http(s) URLs", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});
