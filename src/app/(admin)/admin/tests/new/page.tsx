"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import QuizBuilder from "@/components/admin/quiz-builder";

export default function NewTestPage() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit") || undefined;

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <Link href="/admin/tests" className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />Назад к тестам
      </Link>

      <h1 className="text-2xl font-bold text-foreground mb-8">{editId ? "Редактировать тест" : "Новый тест"}</h1>

      <QuizBuilder quizId={editId} />
    </div>
  );
}
