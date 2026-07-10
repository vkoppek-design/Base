"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Course, Lesson, UserLessonAccess } from "@/types";
import { useToast } from "@/components/shared/toast-provider";
import { Loader2, KeyRound, Sparkles, CheckCircle2, Lock } from "lucide-react";

interface ProfileWithAccess extends Profile {
  openLessonsCount: number;
  unlockedLessons: Set<string>;
}

export default function AdminLessonAccessPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<ProfileWithAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null);

  const supabase = createClient();
  const { addToast } = useToast();

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchCourseData();
    }
  }, [selectedCourseId]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("sequential_access", true)
        .order("created_at");

      if (error) throw error;
      if (data && data.length > 0) {
        setCourses(data);
        setSelectedCourseId(data[0].id);
      } else {
        setCourses([]);
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      addToast("Ошибка при загрузке курсов", "error");
      setLoading(false);
    }
  };

  const fetchCourseData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all lessons in topics of selected course
      const { data: topicsData, error: topicsErr } = await supabase
        .from("topics")
        .select("id")
        .eq("course_id", selectedCourseId);

      if (topicsErr) throw topicsErr;

      let courseLessons: Lesson[] = [];
      if (topicsData && topicsData.length > 0) {
        const topicIds = topicsData.map((t: any) => t.id);
        const { data: lessonsData, error: lessonsErr } = await supabase
          .from("lessons")
          .select("*")
          .in("topic_id", topicIds)
          .order("sort_order");

        if (lessonsErr) throw lessonsErr;
        courseLessons = lessonsData || [];
      }
      // Sort lessons just in case
      courseLessons.sort((a, b) => a.sort_order - b.sort_order);
      setLessons(courseLessons);

      // 2. Fetch all users granted access to this course
      const { data: userCoursesData, error: ucErr } = await supabase
        .from("user_courses")
        .select("user_id")
        .eq("course_id", selectedCourseId);

      if (ucErr) throw ucErr;

      let courseStudents: Profile[] = [];
      if (userCoursesData && userCoursesData.length > 0) {
        const userIds = userCoursesData.map((uc: any) => uc.user_id);
        const { data: profilesData, error: profilesErr } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds)
          .eq("is_approved", true);

        if (profilesErr) throw profilesErr;
        courseStudents = profilesData || [];
      }

      // 3. Fetch user lesson accesses for all these users
      let accessData: UserLessonAccess[] = [];
      if (courseStudents.length > 0 && courseLessons.length > 0) {
        const userIds = courseStudents.map((s) => s.id);
        const lessonIds = courseLessons.map((l) => l.id);

        const { data: ulaData, error: ulaErr } = await supabase
          .from("user_lesson_access")
          .select("*")
          .in("user_id", userIds)
          .in("lesson_id", lessonIds);

        if (ulaErr) throw ulaErr;
        accessData = ulaData || [];
      }

      // Map access state to profiles
      const mappedStudents: ProfileWithAccess[] = courseStudents.map((student) => {
        const studentAccesses = accessData.filter((a) => a.user_id === student.id);
        const unlockedSet = new Set(studentAccesses.map((a) => a.lesson_id));
        // First lesson is unlocked by default
        const firstLesson = courseLessons.find((l) => l.sort_order === 1);
        if (firstLesson) {
          unlockedSet.add(firstLesson.id);
        }
        return {
          ...student,
          unlockedLessons: unlockedSet,
          openLessonsCount: unlockedSet.size,
        };
      });

      // Sort by full name
      mappedStudents.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
      setStudents(mappedStudents);

    } catch (err: any) {
      console.error(err);
      addToast("Ошибка при загрузке доступов", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNextLesson = async (student: ProfileWithAccess) => {
    if (lessons.length === 0) return;
    
    // Find first lesson that is NOT unlocked
    const nextLesson = lessons.find((l) => !student.unlockedLessons.has(l.id));
    if (!nextLesson) {
      addToast("Все уроки курса уже открыты этому студенту", "info");
      return;
    }

    setProcessingStudentId(student.id);
    try {
      const { error } = await supabase
        .from("user_lesson_access")
        .insert({
          user_id: student.id,
          lesson_id: nextLesson.id,
        });

      if (error) throw error;

      // Update state locally
      setStudents(
        students.map((s) => {
          if (s.id === student.id) {
            const updatedUnlocked = new Set(s.unlockedLessons);
            updatedUnlocked.add(nextLesson.id);
            return {
              ...s,
              unlockedLessons: updatedUnlocked,
              openLessonsCount: updatedUnlocked.size,
            };
          }
          return s;
        })
      );
      addToast(`Урок «${nextLesson.title}» успешно открыт`, "success");
    } catch (err: any) {
      console.error(err);
      addToast("Ошибка при открытии доступа к уроку", "error");
    } finally {
      setProcessingStudentId(null);
    }
  };

  const handleCloseLastLesson = async (student: ProfileWithAccess) => {
    // Find last unlocked lesson
    let lastUnlockedLesson: Lesson | null = null;
    for (let i = lessons.length - 1; i >= 0; i--) {
      if (student.unlockedLessons.has(lessons[i].id)) {
        lastUnlockedLesson = lessons[i];
        break;
      }
    }

    if (!lastUnlockedLesson || lastUnlockedLesson.sort_order === 1) {
      addToast("Первый урок открыт по умолчанию и не может быть закрыт", "info");
      return;
    }

    setProcessingStudentId(student.id);
    try {
      const { error } = await supabase
        .from("user_lesson_access")
        .delete()
        .match({
          user_id: student.id,
          lesson_id: lastUnlockedLesson.id,
        });

      if (error) throw error;

      // Update state locally
      setStudents(
        students.map((s) => {
          if (s.id === student.id) {
            const updatedUnlocked = new Set(s.unlockedLessons);
            updatedUnlocked.delete(lastUnlockedLesson!.id);
            return {
              ...s,
              unlockedLessons: updatedUnlocked,
              openLessonsCount: updatedUnlocked.size,
            };
          }
          return s;
        })
      );
      addToast(`Доступ к уроку «${lastUnlockedLesson.title}» закрыт`, "success");
    } catch (err: any) {
      console.error(err);
      addToast("Ошибка при закрытии доступа к уроку", "error");
    } finally {
      setProcessingStudentId(null);
    }
  };

  if (loading && courses.length === 0) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center">
        <KeyRound className="w-12 h-12 text-muted mx-auto mb-4" />
        <p className="font-semibold text-foreground mb-1">Нет последовательных курсов</p>
        <p className="text-sm text-muted">Курсы с поурочным доступом еще не созданы.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Управление доступом к урокам</h2>
          <p className="text-xs text-muted mt-1">Открывайте уроки студентам последовательно по одному</p>
        </div>

        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="bg-card border border-border text-foreground px-4 py-2 rounded-xl text-sm font-medium focus:outline-none focus:border-accent"
        >
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <p className="font-medium text-foreground mb-1">Нет студентов на курсе</p>
          <p className="text-sm text-muted">Сначала предоставьте студентам доступ к курсу в разделе «Пользователи».</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-card-hover/50 text-xs font-semibold text-muted uppercase tracking-wider">
                <th className="px-6 py-4">Студент</th>
                <th className="px-6 py-4">Открыто уроков</th>
                <th className="px-6 py-4">Прогресс уроков</th>
                <th className="px-6 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-card-hover/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-foreground">{student.full_name || "Без имени"}</div>
                    <div className="text-xs text-muted mt-0.5">{student.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                      <Sparkles className="w-4 h-4 text-accent" />
                      {student.openLessonsCount} / {lessons.length}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 max-w-[200px] flex-wrap">
                      {lessons.map((lesson, idx) => {
                        const isUnlocked = student.unlockedLessons.has(lesson.id);
                        return (
                          <div
                            key={lesson.id}
                            title={`${idx + 1}. ${lesson.title} (${isUnlocked ? "Открыт" : "Закрыт"})`}
                            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              isUnlocked
                                ? "bg-accent/15 text-accent border border-accent/25"
                                : "bg-muted/10 text-muted border border-muted/20"
                            }`}
                          >
                            {isUnlocked ? (
                              <CheckCircle2 className="w-3 h-3 text-accent" />
                            ) : (
                              idx + 1
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleCloseLastLesson(student)}
                        disabled={processingStudentId !== null || student.openLessonsCount === 0}
                        className="px-3 py-1.5 text-xs font-semibold bg-danger/10 hover:bg-danger/20 text-danger rounded-xl transition-colors disabled:opacity-50"
                      >
                        Закрыть урок
                      </button>
                      <button
                        onClick={() => handleOpenNextLesson(student)}
                        disabled={processingStudentId !== null || student.openLessonsCount === lessons.length}
                        className="px-3 py-1.5 text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl transition-colors disabled:opacity-50"
                      >
                        {processingStudentId === student.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Открыть следующий"
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
