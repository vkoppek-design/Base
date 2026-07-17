"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";
import { LessonContentRenderer } from "@/components/lesson/lesson-content-renderer";
import { formatDuration } from "@/lib/utils";
import type { Lesson } from "@/types";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function LessonPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile, loading: userLoading } = useUser();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (userLoading) return;
    if (profile && profile.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    supabase
      .from("lessons")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }: { data: Lesson | null }) => {
        setLesson(data);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userLoading, profile]);

  if (userLoading || loading || profile?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted">Урок не найден</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-accent text-accent-foreground px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium">Черновик — предпросмотр (так урок увидит студент)</span>
        <Link href={`/admin/lessons/new?edit=${id}`} className="flex items-center gap-1.5 text-sm font-medium hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Назад к редактированию
        </Link>
      </div>

      <div className="max-w-3xl mx-auto p-4 lg:p-8">
        <p className="text-sm text-muted mb-2">{formatDuration(lesson.duration_minutes)}</p>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-8">{lesson.title}</h1>
        <LessonContentRenderer content={lesson.content} lessonId={lesson.id} />
      </div>
    </div>
  );
}
