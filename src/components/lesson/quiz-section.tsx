"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { QuizQuestionPublic } from "@/types";
import { CheckCircle2, XCircle, Loader2, ListChecks, RotateCcw } from "lucide-react";

interface SubmitResult {
  score: number;
  total: number;
  results: Record<string, { correctOptionIds: string[]; isCorrect: boolean }>;
}

export function QuizSection({ lessonId }: { lessonId: string }) {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuizQuestionPublic[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const supabase = createClient();

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/quiz/${lessonId}`, {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
    const json = await res.json();
    if (json.quiz) {
      setQuestions(json.questions || []);
      if (json.previousAttempt) {
        setResult({
          score: json.previousAttempt.score,
          total: json.previousAttempt.total,
          results: {},
        });
        setAnswers(json.previousAttempt.answers || {});
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [lessonId]);

  const toggleAnswer = (questionId: string, optionId: string, type: "single" | "multiple") => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (type === "single") {
        return { ...prev, [questionId]: [optionId] };
      }
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [questionId]: next };
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ lessonId, answers }),
      });
      const json = await res.json();
      if (res.ok) setResult(json);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setResult(null);
    setAnswers({});
  };

  if (loading) {
    return (
      <div className="mb-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  }

  if (questions.length === 0) return null;

  const showFeedback = result && Object.keys(result.results).length > 0;
  const allAnswered = questions.every((q) => (answers[q.id] || []).length > 0);

  return (
    <div className="mb-8 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <ListChecks className="w-5 h-5 text-accent" />
        <h3 className="text-base font-semibold text-foreground">Тест по уроку</h3>
      </div>

      {result && !showFeedback && (
        <div className="mb-4 flex items-center justify-between px-4 py-3 rounded-xl bg-input border border-border">
          <p className="text-sm text-foreground">
            Ваш результат: <span className="font-semibold text-accent">{result.score} / {result.total}</span>
          </p>
          <button onClick={handleRetake} className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
            Пройти заново
          </button>
        </div>
      )}

      <div className="space-y-5">
        {questions.map((q, qi) => {
          const selected = answers[q.id] || [];
          const feedback = result?.results[q.id];
          return (
            <div key={q.id}>
              <p className="text-sm font-medium text-foreground mb-2">
                {qi + 1}. {q.question}
              </p>
              <div className="space-y-1.5">
                {q.options.map((o) => {
                  const isSelected = selected.includes(o.id);
                  const isCorrectOption = feedback?.correctOptionIds.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                        feedback
                          ? isCorrectOption
                            ? "border-success/40 bg-success/10 text-success"
                            : isSelected
                            ? "border-error/40 bg-error/10 text-error"
                            : "border-border text-muted"
                          : isSelected
                          ? "border-accent bg-accent/10 text-foreground"
                          : "border-border text-foreground hover:border-border-hover"
                      }`}
                    >
                      <input
                        type={q.question_type === "single" ? "radio" : "checkbox"}
                        name={`quiz-${q.id}`}
                        checked={isSelected}
                        disabled={!!feedback}
                        onChange={() => toggleAnswer(q.id, o.id, q.question_type)}
                        className="accent-accent shrink-0"
                      />
                      <span className="flex-1">{o.option_text}</span>
                      {feedback && isCorrectOption && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                      {feedback && isSelected && !isCorrectOption && <XCircle className="w-4 h-4 shrink-0" />}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!showFeedback && (
        <button
          onClick={handleSubmit}
          disabled={submitting || !allAnswered}
          className="mt-5 flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent text-accent-foreground font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer glow-accent"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Отправить
        </button>
      )}

      {showFeedback && (
        <div className="mt-5 flex items-center justify-between px-4 py-3 rounded-xl bg-input border border-border">
          <p className="text-sm text-foreground">
            Результат: <span className="font-semibold text-accent">{result!.score} / {result!.total}</span>
          </p>
          <button onClick={handleRetake} className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" />
            Пройти заново
          </button>
        </div>
      )}
    </div>
  );
}
