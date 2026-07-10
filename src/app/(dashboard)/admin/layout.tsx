"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { Users, Layers, KeyRound, FolderOpen, FileText } from "lucide-react";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && profile?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [profile, loading, router]);

  if (loading || profile?.role !== "admin") {
    return null;
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">Админ-панель</h1>
        <p className="text-muted">Управление пользователями и программами обучения</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64 shrink-0">
          <nav className="flex flex-col gap-2">
            <Link
              href="/admin/users"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                pathname === "/admin/users"
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-muted hover:text-foreground hover:bg-card-hover border border-transparent"
              }`}
            >
              <Users className="w-4 h-4" />
              Пользователи
            </Link>
            <Link
              href="/admin/courses"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                pathname === "/admin/courses"
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-muted hover:text-foreground hover:bg-card-hover border border-transparent"
              }`}
            >
              <Layers className="w-4 h-4" />
              Курсы и доступы
            </Link>
            <Link
              href="/admin/lesson-access"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                pathname === "/admin/lesson-access"
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-muted hover:text-foreground hover:bg-card-hover border border-transparent"
              }`}
            >
              <KeyRound className="w-4 h-4" />
              Доступ к урокам
            </Link>

            <div className="h-px bg-border my-2" />

            <Link
              href="/admin/topics"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover border border-transparent transition-colors"
            >
              <FolderOpen className="w-4 h-4" />
              Темы
            </Link>
            <Link
              href="/admin/lessons"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover border border-transparent transition-colors"
            >
              <FileText className="w-4 h-4" />
              Уроки
            </Link>
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
