import type { Metadata } from "next";
import DashboardShell from "./dashboard-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Дашборд",
  description:
    "Ваш прогресс обучения искусственному интеллекту — темы, уроки и статистика",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
