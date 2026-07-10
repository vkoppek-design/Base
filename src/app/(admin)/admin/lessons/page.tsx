"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { Lesson, Topic } from "@/types";
import { Plus, Edit, Trash2, Eye, EyeOff, FileText } from "lucide-react";

export default function LessonsListPage() {
  const [lessons, setLessons] = useState<(Lesson & { topic: Topic })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchLessons = async () => {
    const { data } = await supabase
      .from("lessons")
      .select("*, topic:topics(*)")
      .order("sort_order");
    
    const mapped = (data || []).map((d: any) => ({
      ...d,
      topic: Array.isArray(d.topic) ? d.topic[0] : d.topic,
    }));
    
    setLessons(mapped as (Lesson & { topic: Topic })[]);
    setLoading(false);
  };

  useEffect(() => { fetchLessons(); }, []);

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from("lessons").update({ is_published: !current }).eq("id", id);
    fetchLessons();
  };

  const deleteLesson = async (id: string) => {
    if (!confirm("Удалить урок?")) return;
    await supabase.from("lessons").delete().eq("id", id);
    fetchLessons();
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Уроки</h1>
          <p className="text-sm text-muted">Управление уроками платформы</p>
        </div>
        <Link href="/admin/lessons/new" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover transition-colors">
          <Plus className="w-4 h-4" />
          Новый урок
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-foreground font-medium mb-1">Уроков пока нет</p>
          <p className="text-sm text-muted mb-4">Сначала создайте тему, затем добавьте уроки</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lessons.map(lesson => (
            <div key={lesson.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4 hover:border-border-hover transition-colors">
              <FileText className="w-4 h-4 text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground whitespace-normal">{lesson.title}</p>
                <p className="text-xs text-muted whitespace-normal">{lesson.topic?.title || 'Без темы'}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => togglePublish(lesson.id, lesson.is_published)} className={`p-2 rounded-lg transition-colors cursor-pointer ${lesson.is_published ? 'text-success hover:bg-success/10' : 'text-muted hover:bg-card-hover'}`}>
                  {lesson.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <Link href={`/admin/lessons/new?edit=${lesson.id}`} className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors">
                  <Edit className="w-4 h-4" />
                </Link>
                <button onClick={() => deleteLesson(lesson.id)} className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
