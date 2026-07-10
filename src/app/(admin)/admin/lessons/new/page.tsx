"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Topic } from "@/types";
import { ArrowLeft, Save, Loader2, Eye, Code, ImagePlus } from "lucide-react";
import Link from "next/link";
import LessonAttachments from "@/components/admin/lesson-attachments";
import QuizBuilder from "@/components/admin/quiz-builder";

export default function NewLessonPage() {
  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState("");
  const [content, setContent] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const editId = searchParams.get("edit");

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки");

      const snippet = `\n![Скриншот](${json.url})\n`;
      const ta = textareaRef.current;
      if (ta) {
        const start = ta.selectionStart ?? content.length;
        const end = ta.selectionEnd ?? content.length;
        setContent(content.slice(0, start) + snippet + content.slice(end));
      } else {
        setContent((c) => c + snippet);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось загрузить изображение");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: topicsData } = await supabase.from("topics").select("*").order("sort_order");
      if (topicsData) {
        setTopics(topicsData);
        if (topicsData.length > 0 && !topicId) {
          setTopicId(topicsData[0].id);
        }
      }

      if (editId) {
        setIsEditing(true);
        const { data: lessonData } = await supabase.from("lessons").select("*").eq("id", editId).single();
        if (lessonData) {
          setTitle(lessonData.title);
          setTopicId(lessonData.topic_id);
          setContent(lessonData.content || "");
          setVideoUrl(lessonData.video_url || "");
          setSortOrder(lessonData.sort_order);
          setDurationMinutes(lessonData.duration_minutes);
          setIsPublished(lessonData.is_published);
        }
      }
    };

    fetchData();
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const data = {
      title,
      topic_id: topicId,
      content,
      video_url: videoUrl || null,
      sort_order: sortOrder,
      duration_minutes: durationMinutes,
      is_published: isPublished,
    };

    if (isEditing && editId) {
      await supabase.from("lessons").update(data).eq("id", editId);
    } else {
      await supabase.from("lessons").insert(data);
    }

    router.push("/admin/lessons");
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <Link href="/admin/lessons" className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />Назад к урокам
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-8">{isEditing ? 'Редактировать урок' : 'Новый урок'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Название</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Название урока" required className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Тема</label>
            <select value={topicId} onChange={e => setTopicId(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground transition-colors">
              {topics.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Видео URL (YouTube embed)</label>
          <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/embed/..." className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-foreground">Содержание (Markdown)</label>
            <div className="flex items-center gap-4">
              <label className={`flex items-center gap-1.5 text-xs transition-colors ${uploading ? "text-muted cursor-wait" : "text-muted hover:text-foreground cursor-pointer"}`}>
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                {uploading ? "Загрузка…" : "Загрузить скрин"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <button type="button" onClick={() => setShowPreview(!showPreview)} className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors cursor-pointer">
                {showPreview ? <><Code className="w-3.5 h-3.5" />Редактор</> : <><Eye className="w-3.5 h-3.5" />Превью</>}
              </button>
            </div>
          </div>
          {showPreview ? (
            <div className="min-h-[300px] p-4 rounded-xl bg-input border border-border prose-dark">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || '*Нет содержания*'}</ReactMarkdown>
            </div>
          ) : (
            <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} placeholder="# Заголовок\n\nТекст урока в формате Markdown..." rows={12} className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors resize-y font-mono" />
          )}
        </div>

        {isEditing && editId ? (
          <>
            <LessonAttachments lessonId={editId} />
            <QuizBuilder lessonId={editId} />
          </>
        ) : (
          <p className="text-sm text-muted bg-input border border-border rounded-xl px-4 py-3">
            Прикреплённые файлы и тест можно будет добавить после первого сохранения урока.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Порядок</label>
            <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Длительность (мин)</label>
            <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground transition-colors" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setIsPublished(!isPublished)} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${isPublished ? 'bg-accent' : 'bg-border'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isPublished ? 'translate-x-5' : ''}`} />
          </button>
          <label className="text-sm text-foreground">Опубликовать</label>
        </div>

        <button type="submit" disabled={loading || !title || !topicId} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer glow-accent">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEditing ? 'Сохранить' : 'Создать'}
        </button>
      </form>
    </div>
  );
}
