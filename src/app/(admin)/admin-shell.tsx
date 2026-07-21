"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import {
  Shield,
  LayoutDashboard,
  FolderOpen,
  FileText,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  Layers,
  Users,
  ListChecks,
} from "lucide-react";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!loading && profile?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [loading, profile]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading || profile?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent/20 animate-pulse" />
          <div className="w-32 h-4 skeleton rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border h-16 flex items-center px-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-card-hover transition-colors text-foreground"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2 ml-3">
          <Shield className="w-5 h-5 text-accent" />
          <span className="font-semibold text-foreground">Админ-панель</span>
        </div>
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-accent" />
              </div>
              <span className="text-lg font-bold text-foreground">Админ</span>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors" onClick={() => setSidebarOpen(false)}>
              <ArrowLeft className="w-4 h-4" />
              К дашборду
            </Link>

            <div className="h-px bg-border my-3" />

            <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors" onClick={() => setSidebarOpen(false)}>
              <LayoutDashboard className="w-4 h-4" />
              Обзор
            </Link>
            <Link href="/admin/topics" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors" onClick={() => setSidebarOpen(false)}>
              <FolderOpen className="w-4 h-4" />
              Темы
            </Link>
            <Link href="/admin/lessons" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors" onClick={() => setSidebarOpen(false)}>
              <FileText className="w-4 h-4" />
              Уроки
            </Link>
            <Link href="/admin/tests" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors" onClick={() => setSidebarOpen(false)}>
              <ListChecks className="w-4 h-4" />
              Тесты
            </Link>

            <div className="h-px bg-border my-3" />

            <Link href="/admin/courses" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors" onClick={() => setSidebarOpen(false)}>
              <Layers className="w-4 h-4" />
              Курсы
            </Link>
            <Link href="/admin/users" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors" onClick={() => setSidebarOpen(false)}>
              <Users className="w-4 h-4" />
              Пользователи
            </Link>
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent text-sm font-semibold">
                {getInitials(profile?.full_name || "A")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{profile?.full_name}</p>
                <p className="text-xs text-accent">Администратор</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </div>
      </aside>

      <main className="lg:pl-64 pt-16 lg:pt-0 min-h-screen">{children}</main>
    </div>
  );
}
