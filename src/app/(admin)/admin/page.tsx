"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FolderOpen, FileText, Users, Plus, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ topics: 0, lessons: 0, users: 0 });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchStats = async () => {
      const [topicsRes, lessonsRes, usersRes] = await Promise.all([
        supabase.from("topics").select("id", { count: "exact", head: true }),
        supabase.from("lessons").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        topics: topicsRes.count || 0,
        lessons: lessonsRes.count || 0,
        users: usersRes.count || 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">Админ-панель</h1>
        <p className="text-muted">Управление контентом платформы</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{loading ? '-' : stats.topics}</p>
            <p className="text-xs text-muted">Тем</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{loading ? '-' : stats.lessons}</p>
            <p className="text-xs text-muted">Уроков</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{loading ? '-' : stats.users}</p>
            <p className="text-xs text-muted">Пользователей</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold text-foreground mb-4">Быстрые действия</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/admin/topics/new" className="group">
          <div className="bg-card rounded-2xl border border-border p-6 hover:border-accent/30 hover:bg-card-hover transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Создать тему</p>
                <p className="text-sm text-muted">Добавить новый модуль обучения</p>
              </div>
            </div>
          </div>
        </Link>
        <Link href="/admin/lessons/new" className="group">
          <div className="bg-card rounded-2xl border border-border p-6 hover:border-accent/30 hover:bg-card-hover transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Создать урок</p>
                <p className="text-sm text-muted">Добавить новый урок в тему</p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
