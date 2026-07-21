"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildCourseTree } from "@/lib/course-structure";
import type { CourseWithTopics } from "@/types";

export function useCourses(userId?: string) {
  const [courses, setCourses] = useState<CourseWithTopics[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Load from cache first
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("lms-courses-cache");
      if (cached) {
        try {
          setCourses(JSON.parse(cached));
          setLoading(false);
        } catch (e) {
          console.error("Error reading lms-courses-cache:", e);
        }
      }
    }

    const fetchCourses = async () => {
      try {
        // RLS filters everything down to what the user is enrolled in.
        const [coursesRes, courseTopicsRes, ctlRes, topicsRes, lessonsRes] = await Promise.all([
          supabase.from("courses").select("*").eq("is_published", true).order("created_at"),
          supabase.from("course_topics").select("*"),
          supabase.from("course_topic_lessons").select("*"),
          supabase.from("topics").select("*").eq("is_published", true),
          supabase.from("lessons").select("*").eq("is_published", true),
        ]);

        if (coursesRes.error) throw coursesRes.error;

        const coursesData = coursesRes.data || [];
        if (coursesData.length === 0) {
          setCourses([]);
          return;
        }

        // Fetch completed progress if user is logged in
        let completedIds = new Set<string>();
        if (userId) {
          const { data } = await supabase
            .from("progress")
            .select("lesson_id")
            .eq("user_id", userId)
            .eq("completed", true);
          completedIds = new Set((data || []).map((p: { lesson_id: string }) => p.lesson_id));
        }

        const coursesWithTopics = buildCourseTree({
          courses: coursesData,
          courseTopics: courseTopicsRes.data || [],
          courseTopicLessons: ctlRes.data || [],
          topics: topicsRes.data || [],
          lessons: lessonsRes.data || [],
          completedIds,
        });

        setCourses(coursesWithTopics);

        // Save to cache
        if (typeof window !== "undefined") {
          localStorage.setItem("lms-courses-cache", JSON.stringify(coursesWithTopics));
        }
      } catch (error) {
        console.error("Error fetching courses:", error instanceof Error ? error.message : error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [userId]);

  return { courses, loading };
}
