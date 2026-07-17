import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lessonReferencesQuiz } from "@/lib/lesson-content";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string; quizId: string }> }) {
  try {
    const { lessonId, quizId } = await params;

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

    // 2. Verify lesson access by re-using the real lessons RLS policy, and
    // that this quiz is actually embedded in that lesson's content — quizzes
    // have no FK to a lesson (they're a reusable library), so the marker
    // itself is the access-control anchor.
    const { data: lessonRow } = await supabase
      .from("lessons")
      .select("id, content")
      .eq("id", lessonId)
      .maybeSingle();

    if (!lessonRow || !lessonReferencesQuiz(lessonRow.content, quizId)) {
      return NextResponse.json({ error: "Тест недоступен" }, { status: 403 });
    }

    // 3. Load the quiz via the admin client, stripping is_correct before it
    // ever reaches the response.
    const adminClient = createAdminClient();
    const { data: quiz } = await adminClient
      .from("quizzes")
      .select("id, title, created_at")
      .eq("id", quizId)
      .maybeSingle();

    if (!quiz) {
      return NextResponse.json({ quiz: null });
    }

    const { data: questions } = await adminClient
      .from("quiz_questions")
      .select("id, quiz_id, question, question_type, sort_order")
      .eq("quiz_id", quiz.id)
      .order("sort_order");

    const questionIds = (questions || []).map((q) => q.id);
    const { data: options } = questionIds.length
      ? await adminClient
          .from("quiz_options")
          .select("id, question_id, option_text, sort_order")
          .in("question_id", questionIds)
          .order("sort_order")
      : { data: [] };

    const questionsWithOptions = (questions || []).map((q) => ({
      ...q,
      options: (options || []).filter((o) => o.question_id === q.id),
    }));

    const { data: previousAttempt } = await adminClient
      .from("quiz_attempts")
      .select("id, quiz_id, user_id, score, total, answers, completed_at")
      .eq("quiz_id", quiz.id)
      .eq("user_id", user.id)
      .maybeSingle();

    return NextResponse.json({ quiz, questions: questionsWithOptions, previousAttempt: previousAttempt || null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Внутренняя ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
