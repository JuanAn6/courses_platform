import { FileText } from "lucide-react";
import type { StudentQuestionView } from "../questions";

/** A submitted response, rendered as text (results pages and grading). */
export function ReadOnlyAnswer({
  view,
  response,
  fileNames = {},
}: {
  view: StudentQuestionView;
  response: Record<string, unknown>;
  fileNames?: Record<string, string>;
}) {
  const none = <p className="text-sm italic text-muted-foreground">No answer</p>;
  const box = (children: React.ReactNode) => (
    <div className="rounded-md border bg-muted/30 p-3 text-sm">
      <p className="mb-1 text-xs text-muted-foreground">Answer</p>
      {children}
    </div>
  );
  switch (view.type) {
    case "SINGLE_CHOICE": {
      const o = view.options.find((x) => x.id === response.choice);
      return o ? box(o.text) : none;
    }
    case "MULTIPLE_CHOICE": {
      const chosen = (response.choices as string[]) ?? [];
      const texts = view.options.filter((o) => chosen.includes(o.id)).map((o) => o.text);
      return texts.length ? box(texts.join(", ")) : none;
    }
    case "TRUE_FALSE":
      return response.value == null ? none : box(response.value ? "True" : "False");
    case "SHORT_ANSWER":
    case "ESSAY":
      return String(response.text ?? "").trim() ? box(<span className="whitespace-pre-line">{String(response.text)}</span>) : none;
    case "NUMERIC":
      return String(response.value ?? "").trim() ? box(String(response.value)) : none;
    case "MATCHING": {
      const matches = (response.matches as Record<string, string>) ?? {};
      const right = new Map(view.right.map((r) => [r.id, r.text]));
      const rows = view.left.filter((l) => matches[l.id]);
      return rows.length
        ? box(<ul>{rows.map((l) => <li key={l.id}>{l.text} → {right.get(matches[l.id]) ?? "?"}</li>)}</ul>)
        : none;
    }
    case "ORDERING": {
      const order = (response.order as string[]) ?? [];
      const byId = new Map(view.items.map((i) => [i.id, i.text]));
      return order.length ? box(<ol className="list-decimal pl-5">{order.map((id) => <li key={id}>{byId.get(id)}</li>)}</ol>) : none;
    }
    case "FILL_BLANKS": {
      const blanks = (response.blanks as string[]) ?? [];
      if (!blanks.some((b) => b?.trim())) return none;
      return box(
        <p>
          {view.parts.map((p, i) =>
            typeof p === "string" ? <span key={i}>{p}</span> : <mark key={i} className="rounded bg-primary/15 px-1">{blanks[p.blank] || "___"}</mark>,
          )}
        </p>,
      );
    }
    case "FILE_UPLOAD": {
      const ids = (response.fileIds as string[]) ?? [];
      return ids.length
        ? box(
            <ul className="grid gap-1">
              {ids.map((id) => (
                <li key={id}>
                  <a href={`/api/files/${id}?download=1`} className="inline-flex items-center gap-2 underline underline-offset-4">
                    <FileText className="size-4" aria-hidden /> {fileNames[id] ?? "File"}
                  </a>
                </li>
              ))}
            </ul>,
          )
        : none;
    }
  }
}
