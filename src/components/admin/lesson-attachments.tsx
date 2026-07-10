"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LessonAttachment } from "@/types";
import { useToast } from "@/components/shared/toast-provider";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";

export default function LessonAttachments({ lessonId }: { lessonId: string }) {
  const [attachments, setAttachments] = useState<LessonAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const supabase = createClient();
  const { addToast } = useToast();

  const fetchAttachments = async () => {
    const { data } = await supabase
      .from("lesson_attachments")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("sort_order");
    setAttachments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAttachments();
  }, [lessonId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!title.trim()) {
      addToast("Сначала укажите название файла", "error");
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload-file", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки");

      const { error } = await supabase.from("lesson_attachments").insert({
        lesson_id: lessonId,
        title: title.trim(),
        file_url: json.url,
        file_name: json.name,
        sort_order: attachments.length,
      });
      if (error) throw error;

      setTitle("");
      await fetchAttachments();
      addToast("Файл прикреплён", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Не удалось загрузить файл", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить файл?")) return;
    await supabase.from("lesson_attachments").delete().eq("id", id);
    fetchAttachments();
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">Прикреплённые файлы</label>
      <div className="space-y-2 mb-3">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted" />
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted">Файлов пока нет</p>
        ) : (
          attachments.map(a => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-input border border-border">
              <FileText className="w-4 h-4 text-accent shrink-0" />
              <span className="flex-1 min-w-0 text-sm text-foreground truncate">{a.title}</span>
              <button type="button" onClick={() => handleDelete(a.id)} className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Название файла (например: Тест по теме)"
          className="flex-1 px-4 py-2.5 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors"
        />
        <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors shrink-0 ${uploading ? "bg-input text-muted cursor-wait" : "bg-input border border-border text-foreground hover:border-accent cursor-pointer"}`}>
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Загрузка…" : "Загрузить файл"}
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
