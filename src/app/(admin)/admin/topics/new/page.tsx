"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TOPIC_GRADIENTS } from "@/lib/constants";
import type { Course } from "@/types";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";

const ICONS = ["MessageSquareText", "Bot", "Image", "Code", "BookOpen", "Layers", "Brain", "Sparkles", "Lightbulb", "Palette"];

export default function NewTopicPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("BookOpen");
  const [gradient, setGradient] = useState(TOPIC_GRADIENTS[0]);
  const [courseId, setCourseId] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [sortOrder, setSortOrder] = useState(0);
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const editId = searchParams.get("edit");

  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase.from("courses").select("*").order("created_at");
      if (data) {
        setCourses(data);
        if (data.length > 0 && !courseId) {
          setCourseId(data[0].id);
        }
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    if (editId) {
      setIsEditing(true);
      const fetchData = async () => {
        const { data } = await supabase.from("topics").select("*").eq("id", editId).single();
        if (data) {
          setTitle(data.title);
          setDescription(data.description || "");
          setIcon(data.icon);
          setGradient(data.gradient);
          setCourseId(data.course_id);
          setSortOrder(data.sort_order);
          setIsPublished(data.is_published);
        }
      };
      fetchData();
    }
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setLoading(true);

    const data = { title, description, icon, gradient, course_id: courseId, sort_order: sortOrder, is_published: isPublished };

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
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Например: Промпт-инжиниринг" required className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Описание</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Краткое описание темы..." rows={3} className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-colors resize-none" />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Курс</label>
          {courses.length === 0 ? (
            <p className="text-sm text-muted">
              Курсов пока нет.{" "}
              <Link href="/admin/courses/new" className="text-accent hover:underline">
                Сначала создайте курс
              </Link>
              .
            </p>
          ) : (
            <select value={courseId} onChange={e => setCourseId(e.target.value)} required className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground transition-colors">
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          )}
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

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Порядок сортировки</label>
          <input type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} className="w-24 px-4 py-3 rounded-xl bg-input border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none text-sm text-foreground transition-colors" />
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setIsPublished(!isPublished)} className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${isPublished ? 'bg-accent' : 'bg-border'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isPublished ? 'translate-x-5' : ''}`} />
          </button>
          <label className="text-sm text-foreground">Опубликовать</label>
        </div>

        <button type="submit" disabled={loading || !title || !courseId} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-accent-foreground font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer glow-accent">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEditing ? 'Сохранить' : 'Создать'}
        </button>
      </form>
    </div>
  );
}
