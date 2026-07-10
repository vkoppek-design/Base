"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/shared/toast-provider";
import type { QuizQuestionType } from "@/types";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";

interface OptionDraft {
  id: string; // local-only id, not a DB id, used as React key
  text: string;
  isCorrect: boolean;
}

interface QuestionDraft {
  id: string; // local-only id
  question: string;
  type: QuizQuestionType;
  options: OptionDraft[];
}

let localIdCounter = 0;
const nextLocalId = () => `local-${++localIdCounter}`;

export default function QuizBuilder({ lessonId }: { lessonId: string }) {
  const [hasQuiz, setHasQuiz] = useState(false);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const { addToast } = useToast();

  useEffect(() => {
    const fetchQuiz = async () => {
      const { data: quiz } = await supabase
        .from("quizzes")
        .select("id")
        .eq("lesson_id", lessonId)
        .maybeSingle();

      if (!quiz) {
        setLoading(false);
        return;
      }

      setHasQuiz(true);
      setQuizId(quiz.id);

      const { data: dbQuestions } = await supabase
        .from("quiz_questions")
        .select("id, question, question_type, sort_order, quiz_options(id, option_text, is_correct, sort_order)")
        .eq("quiz_id", quiz.id)
        .order("sort_order");

      const drafts: QuestionDraft[] = (dbQuestions || []).map((q: any) => ({
        id: nextLocalId(),
        question: q.question,
        type: q.question_type as QuizQuestionType,
        options: [...(q.quiz_options || [])]
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((o: any) => ({ id: nextLocalId(), text: o.option_text, isCorrect: o.is_correct })),
      }));
      setQuestions(drafts);
      setLoading(false);
    };
    fetchQuiz();
  }, [lessonId]);

  const addQuestion = () => {
    setQuestions((qs) => [
      ...qs,
      {
        id: nextLocalId(),
        question: "",
        type: "single",
        options: [
          { id: nextLocalId(), text: "", isCorrect: true },
          { id: nextLocalId(), text: "", isCorrect: false },
        ],
      },
    ]);
  };

  const removeQuestion = (qId: string) => {
    setQuestions((qs) => qs.filter((q) => q.id !== qId));
  };

  const updateQuestion = (qId: string, patch: Partial<QuestionDraft>) => {
    setQuestions((qs) => qs.map((q) => (q.id === qId ? { ...q, ...patch } : q)));
  };

  const addOption = (qId: string) => {
    setQuestions((qs) =>
      qs.map((q) => (q.id === qId ? { ...q, options: [...q.options, { id: nextLocalId(), text: "", isCorrect: false }] } : q))
    );
  };

  const removeOption = (qId: string, oId: string) => {
    setQuestions((qs) =>
      qs.map((q) => (q.id === qId ? { ...q, options: q.options.filter((o) => o.id !== oId) } : q))
    );
  };

  const updateOption = (qId: string, oId: string, patch: Partial<OptionDraft>) => {
    setQuestions((qs) =>
      qs.map((q) =>
        q.id === qId
          ? {
              ...q,
              options: q.options.map((o) => {
                if (o.id !== oId) {
                  // For single-choice questions, selecting a new correct
                  // answer clears the others (radio-like behavior).
                  return patch.isCorrect && q.type === "single" ? { ...o, isCorrect: false } : o;
                }
                return { ...o, ...patch };
              }),
            }
          : q
      )
    );
  };

  const enableQuiz = () => {
    setHasQuiz(true);
    if (questions.length === 0) addQuestion();
  };

  const handleSave = async () => {
    if (questions.some((q) => !q.question.trim() || q.options.length < 2 || !q.options.some((o) => o.isCorrect))) {
      addToast("Каждый вопрос должен иметь текст, минимум 2 варианта и хотя бы один правильный ответ", "error");
      return;
    }

    setSaving(true);
    try {
      let currentQuizId = quizId;
      if (!currentQuizId) {
        const { data, error } = await supabase.from("quizzes").insert({ lesson_id: lessonId }).select("id").single();
        if (error) throw error;
        currentQuizId = data.id;
        setQuizId(currentQuizId);
      }

      // Simplest correct strategy for a low-frequency admin action: replace
      // all questions/options on every save instead of diffing UUIDs.
      // Note: this can orphan option-id references inside older
      // quiz_attempts.answers JSON — harmless, that column has no FK and
      // score/total remain valid.
      await supabase.from("quiz_questions").delete().eq("quiz_id", currentQuizId);

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const { data: questionRow, error: qError } = await supabase
          .from("quiz_questions")
          .insert({ quiz_id: currentQuizId, question: q.question.trim(), question_type: q.type, sort_order: i })
          .select("id")
          .single();
        if (qError) throw qError;

        const optionsPayload = q.options.map((o, j) => ({
          question_id: questionRow.id,
          option_text: o.text.trim(),
          is_correct: o.isCorrect,
          sort_order: j,
        }));
        const { error: oError } = await supabase.from("quiz_options").insert(optionsPayload);
        if (oError) throw oError;
      }

      addToast("Тест сохранён", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Не удалось сохранить тест", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuiz = async () => {
    if (!quizId || !confirm("Удалить тест целиком?")) return;
    await supabase.from("quizzes").delete().eq("id", quizId);
    setQuizId(null);
    setHasQuiz(false);
    setQuestions([]);
  };

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-medium text-foreground">Тест</label>
        {hasQuiz && (
          <button type="button" onClick={handleDeleteQuiz} className="text-xs text-error hover:underline cursor-pointer">
            Удалить тест
          </button>
        )}
      </div>

      {!hasQuiz ? (
        <button
          type="button"
          onClick={enableQuiz}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-input border border-border text-sm text-foreground hover:border-accent transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Добавить тест к уроку
        </button>
      ) : (
        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={q.id} className="p-4 rounded-xl bg-input border border-border space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted mt-3 shrink-0">{qi + 1}.</span>
                <input
                  type="text"
                  value={q.question}
                  onChange={(e) => updateQuestion(q.id, { question: e.target.value })}
                  placeholder="Текст вопроса"
                  className="flex-1 px-3 py-2 rounded-lg bg-card border border-border focus:border-accent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                />
                <select
                  value={q.type}
                  onChange={(e) => updateQuestion(q.id, { type: e.target.value as QuizQuestionType })}
                  className="px-2 py-2 rounded-lg bg-card border border-border text-xs text-foreground outline-none"
                >
                  <option value="single">Один ответ</option>
                  <option value="multiple">Несколько ответов</option>
                </select>
                <button type="button" onClick={() => removeQuestion(q.id)} className="p-2 text-muted hover:text-error cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 pl-5">
                {q.options.map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <input
                      type={q.type === "single" ? "radio" : "checkbox"}
                      name={`correct-${q.id}`}
                      checked={o.isCorrect}
                      onChange={(e) => updateOption(q.id, o.id, { isCorrect: e.target.checked })}
                      className="accent-accent shrink-0"
                    />
                    <input
                      type="text"
                      value={o.text}
                      onChange={(e) => updateOption(q.id, o.id, { text: e.target.value })}
                      placeholder="Вариант ответа"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-card border border-border focus:border-accent outline-none text-sm text-foreground placeholder:text-muted-foreground"
                    />
                    <button type="button" onClick={() => removeOption(q.id, o.id)} className="p-1 text-muted hover:text-error cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addOption(q.id)} className="text-xs text-accent hover:underline cursor-pointer">
                  + Добавить вариант
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3">
            <button type="button" onClick={addQuestion} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-input border border-border text-xs text-foreground hover:border-accent transition-colors cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              Добавить вопрос
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || questions.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Сохранить тест
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
