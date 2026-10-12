import { Code2, FileAudio, FileText, Files, Link as LinkIcon, Presentation, Video, type LucideIcon } from "lucide-react";
import type { EntryType } from "../registry";

const ICONS: Record<EntryType, LucideIcon> = {
  TEXT: FileText,
  VIDEO: Video,
  AUDIO: FileAudio,
  DOCUMENT: Files,
  PRESENTATION: Presentation,
  LINK: LinkIcon,
  EMBED: Code2,
};

export function EntryIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type as EntryType] ?? FileText;
  return <Icon className={className ?? "size-4 text-muted-foreground"} aria-hidden />;
}
