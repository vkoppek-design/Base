import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

interface SubmitBody {
  lessonId: string;
  answers: Record<string, string[]>;
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate the caller (cookie session, or Bearer token fallback)
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    const supabase = await createClient();
    const { data: userData, error: authError } = token
      ? await supabase.auth.getUser(token)
      : await supabase.auth.getUser();
    const user = userData?.user;

    if (authError || !user) {
      return NextResponse.json({ error: "Неавторизован" }, { status: 401 });
    }

    const body = (await request.json()) as SubmitBody;
    const { lessonId, answers } = body;
    if (!lessonId || !answers) {
      return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    }

    // 2. Verify lesson access by re-using the real lessons RLS policy.
    const { data: lessonRow } = await supabase
      .from("lessons")
      .select("id")
      .eq("id", lessonId)
      .maybeSingle();

    if (!lessonRow) {
      return NextResponse.json({ error: "Урок недоступен" }, { status: 403 });
    }

    // 3. Grade server-side against the real is_correct values — never trust
    // a client-submitted score.
    const adminClient = createAdminClient();
    const { data: quiz } = await adminClient
      .from("quizzes")
      .select("id")
      .eq("lesson_id", lessonId)
      .maybeSingle();

    if (!quiz) {
      return NextResponse.json({ error: "Тест не найден" }, { status: 404 });
    }

    const { data: questions } = await adminClient
      .from("quiz_questions")
      .select("id")
      .eq("quiz_id", quiz.id);

    const questionIds = (questions || []).map((q) => q.id);
    const { data: options } = questionIds.length
      ? await adminClient
          .from("quiz_options")
          .select("id, question_id, is_correct")
          .in("question_id", questionIds)
      : { data: [] };

    const results: Record<string, { correctOptionIds: string[]; isCorrect: boolean }> = {};
    let score = 0;

    for (const questionId of questionIds) {
      const correctOptionIds = (options || [])
        .filter((o) => o.question_id === questionId && o.is_correct)
        .map((o) => o.id)
        .sort();
      const submitted = [...(answers[questionId] || [])].sort();
      const isCorrect =
        submitted.length === correctOptionIds.length &&
        submitted.every((id, i) => id === correctOptionIds[i]);
      if (isCorrect) score += 1;
      results[questionId] = { correctOptionIds, isCorrect };
    }

    const total = questionIds.length;

    const { error: upsertError } = await adminClient.from("quiz_attempts").upsert(
      {
        quiz_id: quiz.id,
        user_id: user.id,
        score,
        total,
        answers,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "quiz_id,user_id" }
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ score, total, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Внутренняя ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
