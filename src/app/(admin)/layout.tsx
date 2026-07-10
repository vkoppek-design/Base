import type { Metadata } from "next";
import AdminShell from "./admin-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Админ-панель",
  description: "Управление темами, уроками и пользователями платформы Veronika Koppek",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
