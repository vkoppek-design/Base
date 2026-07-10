"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { useCourses } from "@/hooks/use-courses";
import { calculateProgress } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/shared/toast-provider";
import {
  BookOpen,
  ArrowLeft,
  CheckCircle2,
  PlayCircle,
  MessageSquareText,
  Bot,
  Image as ImageIcon,
  Code,
  Layers,
  ArrowRight,
  Sparkles,
  Loader2,
  Lock,
  Clock,
} from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  MessageSquareText: <MessageSquareText className="w-6 h-6" />,
  Bot: <Bot className="w-6 h-6" />,
  Image: <ImageIcon className="w-6 h-6" />,
  Code: <Code className="w-6 h-6" />,
  BookOpen: <BookOpen className="w-6 h-6" />,
  Layers: <Layers className="w-6 h-6" />,
};

function TopicCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl skeleton" />
        <div className="flex-1">
          <div className="w-32 h-5 skeleton rounded mb-2" />
          <div className="w-48 h-4 skeleton rounded" />
        </div>
      </div>
      <div className="w-full h-2 skeleton rounded-full mb-3" />
      <div className="w-24 h-4 skeleton rounded" />
    </div>
  );
}

export default function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { user, profile } = useUser();
  const isAdmin = profile?.role === "admin";
  const { courses, loading } = useCourses(user?.id);
  const router = useRouter();
  const supabase = createClient();
  const { addToast } = useToast();

  const course = courses.find((c) => c.id === courseId);

  // All Hooks must be declared at the top level
  const [accessibleLessons, setAccessibleLessons] = useState<Set<string>>(new Set());
  const [accessLoading, setAccessLoading] = useState(false);

  useEffect(() => {
    if (!loading && !course) {
      router.push("/dashboard");
    }
  }, [loading, course, router]);

  useEffect(() => {
    if (course?.sequential_access && user?.id) {
      setAccessLoading(true);
      const fetchAccess = async () => {
        try {
          const { data, error } = await supabase
            .from("user_lesson_access")
            .select("lesson_id")
            .eq("user_id", user.id);

          if (error) throw error;
          const ids = (data || []).map((r: any) => r.lesson_id);
          setAccessibleLessons(new Set(ids));
        } catch (err) {
          console.error("Error loading lesson access:", err);
        } finally {
          setAccessLoading(false);
        }
      };
      fetchAccess();
    } else {
      setAccessLoading(false);
    }
  }, [course?.sequential_access, user?.id, supabase]);

  if (loading) {
    return (
      <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in">
        <div className="mb-8">
          <div className="w-24 h-4 skeleton rounded mb-4" />
          <div className="w-64 h-8 skeleton rounded mb-2" />
          <div className="w-96 h-4 skeleton rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <TopicCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!course) return null;

  const progress = calculateProgress(course.completedTopics, course.totalTopics);
  
  // Find first uncompleted lesson across all topics
  const nextLesson = course.topics
    .flatMap((t) =>
      t.lessons.map((l, i) => ({
        ...l,
        topicTitle: t.title,
        isCompleted: i < t.completedLessons,
      }))
    )
    .find((l) => {
      if (course.sequential_access && !isAdmin) {
        return accessibleLessons.has(l.id) && !l.isCompleted;
      }
      return !l.isCompleted;
    });

  // Flat list of lessons for sequential courses
  const allLessons = course.topics.flatMap(t => t.lessons);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Back link */}
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />
        К списку курсов
      </Link>

      {/* Course Header */}
      <div className="mb-8 relative overflow-hidden bg-card border border-border rounded-3xl p-8">
        <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br ${course.gradient} opacity-10 rounded-full blur-3xl -mr-20 -mt-20`} />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="px-3 py-1 bg-accent/10 text-accent rounded-full text-xs font-semibold uppercase tracking-wider">
                Программа обучения
              </div>
              <span className="text-sm font-medium text-muted flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-accent" />
                {progress}% пройдено
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-3">
              {course.title}
            </h1>
            <p className="text-muted max-w-2xl text-lg">
              {course.description}
            </p>
          </div>
          
          <div className="flex flex-col items-center justify-center p-6 bg-background rounded-2xl border border-border min-w-[160px]">
            <span className="text-3xl font-bold text-foreground mb-1">
              {course.sequential_access ? allLessons.length : course.totalTopics}
            </span>
            <span className="text-sm text-muted">
              {course.sequential_access ? "Занятий всего" : "Модулей всего"}
            </span>
          </div>
        </div>
      </div>

      {/* Continue Banner */}
      {nextLesson && (!course.sequential_access || isAdmin || accessibleLessons.has(nextLesson.id)) && (
        <Link
          href={`/lessons/${nextLesson.id}`}
          className="block mb-8 group"
        >
          <div className="bg-gradient-to-r from-accent/10 via-accent/5 to-transparent rounded-2xl border border-accent/20 p-6 hover:border-accent/40 transition-all duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                  <PlayCircle className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-xs text-accent font-medium mb-1">Продолжить обучение</p>
                  <p className="text-foreground font-semibold">{nextLesson.title}</p>
                  <p className="text-sm text-muted">{nextLesson.topicTitle}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-accent group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </Link>
      )}

      {course.sequential_access ? (
        // Sequential course lesson view (8 premium lesson tiles)
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-foreground mb-6">Программа курса</h2>
          {accessLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : allLessons.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-muted" />
              </div>
              <p className="text-foreground font-medium mb-1">Уроков пока нет</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allLessons.map((lesson, idx) => {
                const isUnlocked = idx === 0 || isAdmin || accessibleLessons.has(lesson.id);
                // Check if completed in course cache
                const topicForLesson = course.topics.find(t => t.id === lesson.topic_id);
                const lessonIdxInTopic = topicForLesson?.lessons.findIndex(l => l.id === lesson.id) ?? -1;
                const isCompleted = lessonIdxInTopic !== -1 && lessonIdxInTopic < (topicForLesson?.completedLessons ?? 0);

                const cardContent = (
                  <div className={`bg-card rounded-2xl border p-6 transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between ${
                    isUnlocked
                      ? "border-border hover:border-border-hover hover:bg-card-hover hover-lift cursor-pointer"
                      : "border-border/50 opacity-90 cursor-not-allowed"
                  }`}>
                    {/* Background glow overlay for premium feel */}
                    {isUnlocked && (
                      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${
                        isCompleted ? "from-success" : "from-accent"
                      } to-transparent opacity-5 rounded-full blur-2xl -mr-10 -mt-10`} />
                    )}

                    <div className="relative z-10 flex-1">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                          isCompleted
                            ? "bg-success/10 text-success"
                            : isUnlocked
                            ? "bg-accent/10 text-accent"
                            : "bg-success/10 text-success border border-success/20"
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="w-6 h-6" />
                          ) : isUnlocked ? (
                            <PlayCircle className="w-6 h-6" />
                          ) : (
                            <Lock className="w-6 h-6 text-success" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-semibold uppercase tracking-wider mb-1 block ${
                            isCompleted ? "text-success" : isUnlocked ? "text-accent" : "text-success"
                          }`}>
                            Урок {idx + 1}
                          </span>
                          <h3 className="font-semibold text-foreground whitespace-normal leading-snug">
                            {lesson.title}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end mt-4 pt-4 border-t border-border/50 relative z-10">
                      <span className={`text-xs font-semibold ${
                        isCompleted ? "text-success" : isUnlocked ? "text-accent" : "text-success"
                      }`}>
                        {isCompleted ? "Пройден" : isUnlocked ? "Доступен" : "Заблокирован"}
                      </span>
                    </div>
                  </div>
                );

                return isUnlocked ? (
                  <Link href={`/lessons/${lesson.id}`} key={lesson.id} className="block group h-full">
                    {cardContent}
                  </Link>
                ) : (
                  <div key={lesson.id} className="h-full" onClick={() => addToast("Урок заблокирован. Ожидайте открытия преподавателем.", "info")}>
                    {cardContent}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // Traditional Topics Grid
        <>
          <h2 className="text-xl font-semibold text-foreground mb-6">Модули программы</h2>
          
          {course.topics.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-muted" />
              </div>
              <p className="text-foreground font-medium mb-1">В этом курсе пока нет модулей</p>
              <p className="text-sm text-muted">Контент скоро появится</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(
                course.topics.reduce((acc, t) => {
                  const block = t.block_name || "";
                  if (!acc[block]) acc[block] = [];
                  acc[block].push(t);
                  return acc;
                }, {} as Record<string, typeof course.topics>)
              ).map(([blockName, blockTopics]) => (
                <div key={blockName} className="space-y-4">
                  {blockName && (
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-foreground/90 uppercase tracking-wide">
                        {blockName}
                      </h3>
                      <div className="h-px bg-border flex-1" />
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {blockTopics.map((topic) => {
                      const topicProgress = calculateProgress(
                        topic.completedLessons,
                        topic.totalLessons
                      );
                      const firstIncomplete = topic.lessons.find(
                        (_, i) => i >= topic.completedLessons
                      );

                      return (
                        <Link
                          key={topic.id}
                          href={
                            firstIncomplete
                              ? `/lessons/${firstIncomplete.id}`
                              : topic.lessons[0]
                              ? `/lessons/${topic.lessons[0].id}`
                              : `/courses/${course.id}`
                          }
                          className="group"
                        >
                          <div className="bg-card rounded-2xl border border-border p-6 hover:border-border-hover hover:bg-card-hover transition-all duration-300 hover-lift relative overflow-hidden">
                            <div className="flex items-start gap-4 mb-5 relative z-10">
                              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0 group-hover:scale-110 transition-transform duration-300">
                                {iconMap[topic.icon] || <BookOpen className="w-6 h-6" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-foreground mb-1 whitespace-normal">
                                  {topic.title}
                                </h3>
                                <p className="text-sm text-muted whitespace-normal">
                                  {topic.description}
                                </p>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-3 relative z-10">
                              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-accent rounded-full transition-all duration-500"
                                  style={{ width: `${topicProgress}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between relative z-10">
                              <div className="flex items-center gap-1.5 text-xs text-muted">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {topic.completedLessons} / {topic.totalLessons} уроков
                              </div>
                              <span className="text-xs font-medium text-accent">
                                {topicProgress}%
                              </span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
