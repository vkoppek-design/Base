"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CourseWithTopics, TopicWithProgress } from "@/types";

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
        console.log("Fetching courses...");
        // Fetch published courses. RLS automatically filters those the user has access to!
        const { data: coursesData, error: coursesError } = await supabase
          .from("courses")
          .select("*")
          .eq("is_published", true)
          .order("created_at");

        console.log("Courses fetched:", coursesData, coursesError);
        if (coursesError) throw coursesError;

        if (!coursesData || coursesData.length === 0) {
          console.log("No courses found. Returning.");
          setCourses([]);
          return;
        }

        console.log("Fetching topics...");
        // Fetch published topics. RLS handles access control.
        const { data: topicsData, error: topicsError } = await supabase
          .from("topics")
          .select("*")
          .eq("is_published", true)
          .order("sort_order");

        console.log("Topics fetched:", topicsData, topicsError);
        if (topicsError) throw topicsError;

        console.log("Fetching lessons...");
        // Fetch published lessons. RLS handles access control.
        const { data: lessonsData, error: lessonsError } = await supabase
          .from("lessons")
          .select("*")
          .eq("is_published", true)
          .order("sort_order");
          
        console.log("Lessons fetched:", lessonsData, lessonsError);

        // Fetch progress if user is logged in
        let progressData: { lesson_id: string }[] = [];
        if (userId) {
          const { data } = await supabase
            .from("progress")
            .select("lesson_id")
            .eq("user_id", userId)
            .eq("completed", true);
          progressData = data || [];
        }

        const completedLessonIds = new Set(progressData.map((p) => p.lesson_id));

        // Group into topics with progress
        const topicsWithProgress: TopicWithProgress[] = (topicsData || []).map((topic: any) => {
          const topicLessons = (lessonsData || []).filter(
            (l: any) => l.topic_id === topic.id
          );
          return {
            ...topic,
            lessons: topicLessons,
            totalLessons: topicLessons.length,
            completedLessons: topicLessons.filter((l: any) =>
              completedLessonIds.has(l.id)
            ).length,
          };
        });

        // Group into courses
        const coursesWithTopics: CourseWithTopics[] = coursesData.map((course: any) => {
          const courseTopics = topicsWithProgress.filter((t: any) => t.course_id === course.id);
          const totalTopics = courseTopics.length;
          const completedTopics = courseTopics.filter(
            (t: any) => t.totalLessons > 0 && t.completedLessons === t.totalLessons
          ).length;

          return {
            ...course,
            topics: courseTopics,
            totalTopics,
            completedTopics,
          };
        });

        setCourses(coursesWithTopics);
        
        // Save to cache
        if (typeof window !== "undefined") {
          localStorage.setItem("lms-courses-cache", JSON.stringify(coursesWithTopics));
        }
      } catch (error: any) {
        console.error("Error fetching courses:", error.message, error);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [userId]);

  return { courses, loading };
}
