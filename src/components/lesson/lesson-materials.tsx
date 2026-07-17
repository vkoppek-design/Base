"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LessonAttachment } from "@/types";
import { FileText, Download } from "lucide-react";

// Renders a single downloadable-file card, positioned inline wherever its
// <!-- FILE:id --> marker appears in the lesson content — see
// src/components/lesson/lesson-content-renderer.tsx.
export function LessonFileBlock({ attachmentId }: { attachmentId: string }) {
  const [attachment, setAttachment] = useState<LessonAttachment | null>(null);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("lesson_attachments")
      .select("*")
      .eq("id", attachmentId)
      .maybeSingle()
      .then(({ data }: { data: LessonAttachment | null }) => {
        if (!cancelled) setAttachment(data);
      });
    return () => {
      cancelled = true;
    };
  }, [attachmentId]);

  if (!attachment) return null;

  return (
    <a
      href={attachment.file_url}
      download={attachment.file_name || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border hover:border-accent transition-colors group"
    >
      <FileText className="w-4 h-4 text-accent shrink-0" />
      <span className="flex-1 min-w-0 text-sm text-foreground truncate">{attachment.title}</span>
      <Download className="w-4 h-4 text-muted group-hover:text-accent shrink-0 transition-colors" />
    </a>
  );
}
