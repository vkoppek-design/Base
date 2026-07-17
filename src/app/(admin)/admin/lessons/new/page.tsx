"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Topic } from "@/types";
import { ArrowLeft, Save, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import RichLessonEditor from "@/components/admin/rich-lesson-editor";

export default function NewLessonPage() {
  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState("");
  const [content, setContent] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentLessonId, setCurrentLessonId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const editId = searchParams.get("edit");

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
        setCurrentLessonId(editId);
        const { data: lessonData } = await supabase.from("lessons").select("*").eq("id", editId).single();
        if (lessonData) {
          setTitle(lessonData.title);
          setTopicId(lessonData.topic_id);
          setContent(lessonData.content || "");
          setSortOrder(lessonData.sort_order);
          setDurationMinutes(lessonData.duration_minutes);
          setIsPublished(lessonData.is_published);
        }
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const data = {
      title,
      topic_id: topicId,
      content,
      sort_order: sortOrder,
      duration_minutes: durationMinutes,
      is_published: isPublished,
    };

    if (isEditing && currentLessonId) {
      await supabase.from("lessons").update(data).eq("id", currentLessonId);
      setLoading(false);
    } else {
      const { data: created, error } = await supabase.from("lessons").insert(data).select("id").single();
      setLoading(false);
      if (error || !created) return;
      // Stay on the page (instead of leaving to the list) so attachments,
      // tests, and preview unlock immediately without a second save.
      setIsEditing(true);
      setCurrentLessonId(created.id);
      router.replace(`/admin/lessons/new?edit=${created.id}`);
    }
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-foreground">Содержание урока</label>
            {currentLessonId && (
              <Link
                href={`/admin/lessons/${currentLessonId}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Предпросмотр
              </Link>
            )}
          </div>
          <RichLessonEditor value={content} onChange={setContent} lessonId={currentLessonId} />
          {!currentLessonId && (
            <p className="text-xs text-muted mt-2">Сохраните урок, чтобы прикреплять файлы и тесты, и открыть предпросмотр.</p>
          )}
        </div>

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

        <div className="flex items-center gap-3">
          <button type="submit" disabled={loading || !title || !topicId} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer glow-accent">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditing ? 'Сохранить' : 'Создать'}
          </button>
          {isEditing && (
            <Link href="/admin/lessons" className="px-6 py-3 rounded-xl border border-border text-sm text-muted hover:text-foreground transition-colors">
              Готово
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
