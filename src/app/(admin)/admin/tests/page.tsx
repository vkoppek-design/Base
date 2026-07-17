"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Plus, Edit, Trash2, ListChecks } from "lucide-react";

interface QuizRow {
  id: string;
  title: string | null;
  created_at: string;
  questionCount: number;
}

export default function TestsListPage() {
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchQuizzes = async () => {
    const { data: quizRows } = await supabase.from("quizzes").select("id,title,created_at").order("created_at", { ascending: false });
    const { data: questionRows } = await supabase.from("quiz_questions").select("id,quiz_id");

    const counts = new Map<string, number>();
    (questionRows || []).forEach((q: { quiz_id: string }) => counts.set(q.quiz_id, (counts.get(q.quiz_id) || 0) + 1));

    setQuizzes((quizRows || []).map((q: { id: string; title: string | null; created_at: string }) => ({ ...q, questionCount: counts.get(q.id) || 0 })));
    setLoading(false);
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const deleteQuiz = async (id: string) => {
    if (!confirm("Удалить тест? Он также исчезнет из всех уроков, где был вставлен.")) return;
    await supabase.from("quizzes").delete().eq("id", id);
    fetchQuizzes();
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Тесты</h1>
          <p className="text-sm text-muted">Библиотека тестов — создавайте здесь, вставляйте в любые уроки</p>
        </div>
        <Link href="/admin/tests/new" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-hover transition-colors">
          <Plus className="w-4 h-4" />
          Новый тест
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-foreground font-medium mb-1">Тестов пока нет</p>
          <p className="text-sm text-muted mb-4">Создайте первый тест, чтобы вставлять его в уроки</p>
          <Link href="/admin/tests/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium">
            <Plus className="w-4 h-4" />Создать
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4 hover:border-border-hover transition-colors">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-accent shrink-0">
                <ListChecks className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{quiz.title || "Без названия"}</p>
                <p className="text-xs text-muted">{quiz.questionCount} {quiz.questionCount === 1 ? "вопрос" : "вопросов"}</p>
              </div>
              <div className="flex items-center gap-1">
                <Link href={`/admin/tests/new?edit=${quiz.id}`} className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors">
                  <Edit className="w-4 h-4" />
                </Link>
                <button onClick={() => deleteQuiz(quiz.id)} className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer">
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
