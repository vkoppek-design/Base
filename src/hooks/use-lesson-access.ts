"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function useLessonAccess(userId?: string) {
  const [accessibleLessonIds, setAccessibleLessonIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchAccess = useCallback(async () => {
    if (!userId) {
      setAccessibleLessonIds(new Set());
      setLoading(false);
      return;
    }

    // Load from cache first
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("lms-lesson-access-cache");
      if (cached) {
        try {
          setAccessibleLessonIds(new Set(JSON.parse(cached)));
          setLoading(false);
        } catch (e) {
          console.error("Error reading lms-lesson-access-cache:", e);
        }
      }
    }

    try {
      const { data, error } = await supabase
        .from("user_lesson_access")
        .select("lesson_id")
        .eq("user_id", userId);

      if (error) throw error;

      const ids = (data || []).map((r: any) => r.lesson_id);
      setAccessibleLessonIds(new Set(ids));

      // Save to cache
      if (typeof window !== "undefined") {
        localStorage.setItem("lms-lesson-access-cache", JSON.stringify(ids));
      }
    } catch (error: any) {
      console.error("Error fetching lesson access:", error.message, error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  return { accessibleLessonIds, loading, refetch: fetchAccess };
}
