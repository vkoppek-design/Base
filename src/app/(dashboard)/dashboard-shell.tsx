"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // Restore collapsed state from previous session (desktop only)
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("lms-sidebar-collapsed") === "true") {
      setCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("lms-sidebar-collapsed", String(next));
      }
      return next;
    });
  };

  // Redirect to pending if not approved
  useEffect(() => {
    if (!loading && user && profile && profile.role !== "admin" && !profile.is_approved) {
      router.push("/pending");
    }
  }, [user, profile, loading, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent/20 animate-pulse" />
          <div className="w-32 h-4 skeleton rounded" />
        </div>
      </div>
    );
  }

  // Helper: nav link label is hidden on desktop when collapsed (always visible on mobile drawer)
  const labelClass = collapsed ? "lg:hidden" : "";
  const linkClass = `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
    collapsed ? "lg:justify-center lg:px-0" : ""
  }`;

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
          <img src="/logo.png" alt="Veronika Koppek" className="w-7 h-7 rounded-full shrink-0" />
          <span className="font-semibold text-foreground">Veronika Koppek</span>
        </div>
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-border transform transition-all duration-300 ease-in-out lg:translate-x-0 ${
          collapsed ? "lg:w-20" : "lg:w-64"
        } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div
            className={`p-6 border-b border-border flex items-center ${
              collapsed ? "lg:px-2 lg:justify-center" : ""
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <img src="/logo.png" alt="Veronika Koppek" className="w-9 h-9 rounded-full shrink-0" />
              <span className={`text-lg font-bold text-foreground whitespace-nowrap ${labelClass}`}>
                Veronika Koppek
              </span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1">
            <Link
              href="/dashboard"
              title={collapsed ? "Дашборд" : undefined}
              className={`${linkClass} ${
                pathname === "/dashboard" || pathname?.startsWith("/courses")
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-foreground hover:bg-sidebar-hover"
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              <span className={labelClass}>Дашборд</span>
            </Link>

            {profile?.role === "admin" && (
              <Link
                href="/admin/users"
                title={collapsed ? "Админ-панель" : undefined}
                className={`${linkClass} ${
                  pathname?.startsWith("/admin")
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:text-foreground hover:bg-sidebar-hover"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span className={labelClass}>Админ-панель</span>
              </Link>
            )}
          </nav>

          {/* Collapse toggle (desktop only) */}
          <div className="hidden lg:block px-4 pb-2">
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Развернуть меню" : "Свернуть меню"}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer ${
                collapsed ? "lg:justify-center lg:px-0" : ""
              }`}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4 shrink-0" />
              ) : (
                <ChevronLeft className="w-4 h-4 shrink-0" />
              )}
              <span className={labelClass}>Свернуть</span>
            </button>
          </div>

          {/* User section */}
          <div className="p-4 border-t border-border">
            <div className={`flex items-center gap-3 mb-3 ${collapsed ? "lg:justify-center" : ""}`}>
              <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent text-sm font-semibold shrink-0">
                {getInitials(profile?.full_name || user?.email || "U")}
              </div>
              <div className={`flex-1 min-w-0 ${labelClass}`}>
                <p className="text-sm font-medium text-foreground truncate">
                  {profile?.full_name || "Пользователь"}
                </p>
                <p className="text-xs text-muted truncate">
                  {user?.email} (Роль: {profile?.role || "none"})
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title={collapsed ? "Выйти" : undefined}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer ${
                collapsed ? "lg:justify-center lg:px-0" : ""
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className={labelClass}>Выйти</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={`pt-16 lg:pt-0 min-h-screen transition-all duration-300 ${
          collapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
