"use client";

import { useUser } from "@/hooks/use-user";
import { useCourses } from "@/hooks/use-courses";
import { calculateProgress } from "@/lib/utils";
import Link from "next/link";
import {
  BookOpen,
  Trophy,
  ArrowRight,
  Sparkles,
  PlayCircle,
  GraduationCap,
  Layers,
  CheckCircle2,
} from "lucide-react";

function CourseCardSkeleton() {
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

export default function DashboardPage() {
  const { user, profile } = useUser();
  const { courses, loading } = useCourses(user?.id);

  const totalTopics = courses.reduce((sum, c) => sum + c.totalTopics, 0);
  const completedTopics = courses.reduce((sum, c) => sum + c.completedTopics, 0);
  const overallProgress = calculateProgress(completedTopics, totalTopics);

  // Find next lesson to continue across all accessible courses
  const nextLesson = courses
    .flatMap((c) => c.topics)
    .flatMap((t) =>
      t.lessons.map((l, i) => ({
        ...l,
        topicTitle: t.title,
        isCompleted: i < t.completedLessons,
      }))
    )
    .find((l) => !l.isCompleted);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
          Привет, {profile?.full_name || "Студент"} 👋
        </h1>
        <p className="text-muted">
          Добро пожаловать в центр обучения
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{courses.length}</p>
            <p className="text-xs text-muted">Доступных курсов</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{completedTopics}</p>
            <p className="text-xs text-muted">Пройдено модулей</p>
          </div>
        </div>
        <div className="bg-card rounded-2xl border border-border p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{overallProgress}%</p>
            <p className="text-xs text-muted">Общий прогресс</p>
          </div>
        </div>
      </div>

      {/* Continue Banner */}
      {nextLesson && (
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

      {/* Courses Grid */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Ваши программы обучения</h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <CourseCardSkeleton key={i} />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-card flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-muted" />
          </div>
          <p className="text-foreground font-medium mb-1">У вас пока нет доступных курсов</p>
          <p className="text-sm text-muted">Администратор скоро откроет вам доступ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course) => {
            const totalLessons = course.topics.flatMap((t) => t.lessons).length;
            const completedLessons = course.topics.reduce((sum, t) => sum + t.completedLessons, 0);
            const progress = course.sequential_access
              ? calculateProgress(completedLessons, totalLessons)
              : calculateProgress(course.completedTopics, course.totalTopics);

            return (
              <Link
                key={course.id}
                href={`/courses/${course.id}`}
                className="group"
              >
                <div className="bg-card rounded-2xl border border-border p-6 hover:border-border-hover hover:bg-card-hover transition-all duration-300 hover-lift relative overflow-hidden">
                  
                  {/* Subtle gradient background based on course.gradient */}
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${course.gradient} opacity-5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:opacity-10 transition-opacity`} />
                  
                  <div className="flex items-start gap-4 mb-5 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0 group-hover:scale-110 transition-transform duration-300">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground mb-1 whitespace-normal">
                        {course.title}
                      </h3>
                      <p className="text-sm text-muted whitespace-normal">
                        {course.description}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3 relative z-10">
                    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {course.sequential_access ? (
                        `${completedLessons} / ${totalLessons} уроков`
                      ) : (
                        `${course.completedTopics} / ${course.totalTopics} модулей`
                      )}
                    </div>
                    <span className="text-xs font-medium text-accent">
                      {progress}%
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
