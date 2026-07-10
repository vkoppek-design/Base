"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Course } from "@/types";
import { useToast } from "@/components/shared/toast-provider";
import { Layers, Loader2, Plus, Edit2, CheckCircle2, XCircle } from "lucide-react";

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const { addToast } = useToast();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("created_at");

      if (error) throw error;
      if (data) setCourses(data);
    } catch (error) {
      addToast("Ошибка загрузки курсов", "error");
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (courseId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("courses")
        .update({ is_published: !currentStatus })
        .eq("id", courseId);

      if (error) throw error;
      setCourses(courses.map(c => c.id === courseId ? { ...c, is_published: !currentStatus } : c));
      addToast("Статус курса обновлен", "success");
    } catch (error) {
      addToast("Ошибка обновления", "error");
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Программы обучения</h2>
        <Link
          href="/admin/courses/new"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-xl text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Создать курс
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map((course) => (
          <div key={course.id} className="bg-card rounded-2xl border border-border p-6 flex flex-col relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${course.gradient} opacity-10 rounded-full blur-2xl -mr-10 -mt-10`} />
            
            <div className="relative z-10 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{course.title}</h3>
                    <p className="text-xs text-muted font-mono">{course.id.slice(0,8)}...</p>
                  </div>
                </div>
                
                <button
                  onClick={() => togglePublish(course.id, course.is_published)}
                  className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    course.is_published 
                      ? "bg-success/10 text-success hover:bg-success/20" 
                      : "bg-warning/10 text-warning hover:bg-warning/20"
                  }`}
                >
                  {course.is_published ? (
                    <><CheckCircle2 className="w-3.5 h-3.5" /> Опубликован</>
                  ) : (
                    <><XCircle className="w-3.5 h-3.5" /> Скрыт</>
                  )}
                </button>
              </div>
              
              <p className="text-sm text-muted line-clamp-2 mb-6">
                {course.description}
              </p>
            </div>
            
            <div className="relative z-10 pt-4 border-t border-border flex justify-end">
              <Link
                href={`/admin/courses/new?edit=${course.id}`}
                className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Редактировать
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
