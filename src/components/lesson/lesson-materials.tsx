"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LessonAttachment } from "@/types";
import { FileText, Download } from "lucide-react";

export function LessonMaterials({ lessonId }: { lessonId: string }) {
  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("lesson_attachments")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("sort_order")
      .then(({ data }: { data: LessonAttachment[] | null }) => {
        if (!cancelled) setAttachments(data || []);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  if (attachments.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Материалы урока</h3>
      <div className="space-y-2">
        {attachments.map((a) => (
          <a
            key={a.id}
            href={a.file_url}
            download={a.file_name || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-input border border-border hover:border-accent transition-colors group"
          >
            <FileText className="w-4 h-4 text-accent shrink-0" />
            <span className="flex-1 min-w-0 text-sm text-foreground truncate">{a.title}</span>
            <Download className="w-4 h-4 text-muted group-hover:text-accent shrink-0 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );
}
