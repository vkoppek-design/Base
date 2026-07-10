"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TopicWithProgress } from "@/types";

export function useTopics(userId?: string) {
  const [topics, setTopics] = useState<TopicWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        // Fetch all published topics
        const { data: topicsData, error: topicsError } = await supabase
          .from("topics")
          .select("*")
          .eq("is_published", true)
          .order("sort_order");

        if (topicsError) throw topicsError;

        if (!topicsData) {
          setTopics([]);
          return;
        }

        // Fetch all published lessons
        const { data: lessonsData, error: lessonsError } = await supabase
          .from("lessons")
          .select("*")
          .eq("is_published", true)
          .order("sort_order");

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

        const topicsWithProgress: TopicWithProgress[] = topicsData.map((topic: any) => {
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

        setTopics(topicsWithProgress);
      } catch (error: any) {
        console.error("Error fetching topics:", error.message, error.details, error.hint, error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, [userId]);

  return { topics, loading };
}
