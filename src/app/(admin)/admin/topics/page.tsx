"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { Topic } from "@/types";
import { Plus, Edit, Trash2, Eye, EyeOff, GripVertical } from "lucide-react";

export default function TopicsListPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchTopics = async () => {
    const { data } = await supabase
      .from("topics")
      .select("*")
      .order("sort_order");
    setTopics(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTopics(); }, []);

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from("topics").update({ is_published: !current }).eq("id", id);
    fetchTopics();
  };

  const deleteTopic = async (id: string) => {
    if (!confirm("Удалить тему и все её уроки?")) return;
    await supabase.from("topics").delete().eq("id", id);
    fetchTopics();
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Темы</h1>
          <p className="text-sm text-muted">Управление модулями обучения</p>
        </div>
        <Link href="/admin/topics/new" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover transition-colors">
          <Plus className="w-4 h-4" />
          Новая тема
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : topics.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-foreground font-medium mb-1">Тем пока нет</p>
          <p className="text-sm text-muted mb-4">Создайте первую тему для начала</p>
          <Link href="/admin/topics/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium">
            <Plus className="w-4 h-4" />Создать
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {topics.map(topic => (
            <div key={topic.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4 hover:border-border-hover transition-colors">
              <GripVertical className="w-4 h-4 text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground whitespace-normal">{topic.title}</p>
                <p className="text-xs text-muted whitespace-normal">{topic.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => togglePublish(topic.id, topic.is_published)} className={`p-2 rounded-lg transition-colors cursor-pointer ${topic.is_published ? 'text-success hover:bg-success/10' : 'text-muted hover:bg-card-hover'}`} title={topic.is_published ? 'Скрыть' : 'Опубликовать'}>
                  {topic.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <Link href={`/admin/topics/new?edit=${topic.id}`} className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors">
                  <Edit className="w-4 h-4" />
                </Link>
                <button onClick={() => deleteTopic(topic.id)} className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
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
