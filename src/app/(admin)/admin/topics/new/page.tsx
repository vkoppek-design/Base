"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TOPIC_GRADIENTS } from "@/lib/constants";
import { useToast } from "@/components/shared/toast-provider";
import type { Lesson, Topic } from "@/types";
import { ArrowLeft, Save, Loader2, X, Plus } from "lucide-react";
import Link from "next/link";

// A topic is just a bag of lessons — no ordering here. Which lessons a course
// includes and in what order is decided in the course editor.
function TopicLessons({ topicId }: { topicId: string }) {
  const [assigned, setAssigned] = useState<Lesson[]>([]);
  const [available, setAvailable] = useState<Lesson[]>([]);
  const [pickedId, setPickedId] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { addToast } = useToast();

  const fetchLessons = async () => {
    const [assignedRes, availableRes] = await Promise.all([
      supabase.from("lessons").select("*").eq("topic_id", topicId).order("title"),
      supabase.from("lessons").select("*").or(`topic_id.is.null,topic_id.neq.${topicId}`).order("title"),
    ]);
    setAssigned(assignedRes.data || []);
    setAvailable(availableRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  const addLesson = async () => {
    if (!pickedId) return;
    const { error } = await supabase.from("lessons").update({ topic_id: topicId }).eq("id", pickedId);
    if (error) {
      addToast("Не удалось добавить урок", "error");
      return;
    }
    setPickedId("");
    fetchLessons();
  };

  const removeLesson = async (id: string) => {
    await supabase.from("lessons").update({ topic_id: null }).eq("id", id);
    fetchLessons();
  };

  if (loading) return <Loader2 className="w-4 h-4 animate-spin text-muted" />;

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">Уроки темы</label>
      <p className="text-xs text-muted mb-3">Отметьте, какие уроки относятся к теме. Порядок и выбор для конкретного курса задаётся в настройках курса.</p>
      <div className="space-y-2 mb-3">
        {assigned.length === 0 ? (
          <p className="text-sm text-muted">В этой теме пока нет уроков</p>
        ) : (
          assigned.map((lesson) => (
            <div key={lesson.id} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-input border border-border">
              <span className="flex-1 text-sm text-foreground truncate">{lesson.title}</span>
              <button type="button" onClick={() => removeLesson(lesson.id)} className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {available.length > 0 && (
        <div className="flex gap-2">
          <select value={pickedId} onChange={(e) => setPickedId(e.target.value)} className="flex-1 px-4 py-2.5 rounded-xl bg-input border border-border focus:border-accent outline-none text-sm text-foreground">
            <option value="">Выберите урок для добавления…</option>
            {available.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <button type="button" onClick={addLesson} disabled={!pickedId} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-input border border-border text-sm text-foreground hover:border-accent transition-colors disabled:opacity-50 cursor-pointer">
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      )}
    </div>
  );
}

const ICONS = ["MessageSquareText", "Bot", "Image", "Code", "BookOpen", "Layers", "Brain", "Sparkles", "Lightbulb", "Palette"];

export default function NewTopicPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("BookOpen");
  const [gradient, setGradient] = useState<string>(TOPIC_GRADIENTS[0]);
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const editId = searchParams.get("edit");

  useEffect(() => {
    if (!editId) return;
    setIsEditing(true);
    supabase.from("topics").select("*").eq("id", editId).single().then(({ data }: { data: Topic | null }) => {
      if (data) {
        setTitle(data.title);
        setDescription(data.description || "");
        setIcon(data.icon);
        setGradient(data.gradient);
        setIsPublished(data.is_published);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const data = { title, description, icon, gradient, is_published: isPublished };

    if (isEditing && editId) {
      await supabase.from("topics").update(data).eq("id", editId);
    } else {
      await supabase.from("topics").insert(data);
    }

    router.push("/admin/topics");
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <Link href="/admin/topics" className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />Назад к темам
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-8">{isEditing ? 'Редактировать тему' : 'Новая тема'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Название</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Например: Работа с командой" required className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Описание</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Краткое описание темы..." rows={3} className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Иконка</label>
          <div className="flex flex-wrap gap-2">
            {ICONS.map(i => (
              <button key={i} type="button" onClick={() => setIcon(i)} className={`px-3 py-2 rounded-lg text-xs font-mono transition-colors cursor-pointer ${icon === i ? 'bg-accent text-accent-foreground' : 'bg-input border border-border text-muted hover:text-foreground'}`}>
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setIsPublished(!isPublished)} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${isPublished ? 'bg-accent' : 'bg-border'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isPublished ? 'translate-x-5' : ''}`} />
          </button>
          <label className="text-sm text-foreground">Опубликовать</label>
        </div>

        <button type="submit" disabled={loading || !title} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer glow-accent">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEditing ? 'Сохранить' : 'Создать'}
        </button>
      </form>

      {isEditing && editId && (
        <div className="mt-8 pt-8 border-t border-border">
          <TopicLessons topicId={editId} />
        </div>
      )}
    </div>
  );
}
