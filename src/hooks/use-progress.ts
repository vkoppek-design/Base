"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useProgress(userId: string) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const markComplete = async (lessonId: string) => {
    setLoading(true);

    if (typeof window !== "undefined" && !navigator.onLine) {
      console.log("[PWA] Offline: Queueing markComplete action");

      // 1. Update local completed ids cache
      const completedIdsStr = localStorage.getItem("lms-progress-completed-ids") || "[]";
      try {
        const completedIds = JSON.parse(completedIdsStr);
        if (!completedIds.includes(lessonId)) {
          completedIds.push(lessonId);
          localStorage.setItem("lms-progress-completed-ids", JSON.stringify(completedIds));
        }
      } catch (e) {
        console.error(e);
      }

      // 2. Queue action for background sync
      const queueStr = localStorage.getItem("lms-offline-progress-queue") || "[]";
      try {
        const queue = JSON.parse(queueStr);
        queue.push({
          id: crypto.randomUUID(),
          userId,
          lessonId,
          completed: true,
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem("lms-offline-progress-queue", JSON.stringify(queue));
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
      return { error: null }; // Mock success
    }

    const { error } = await supabase.from("progress").upsert(
      {
        user_id: userId,
        lesson_id: lessonId,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" }
    );

    if (!error && typeof window !== "undefined") {
      const completedIdsStr = localStorage.getItem("lms-progress-completed-ids") || "[]";
      try {
        const completedIds = JSON.parse(completedIdsStr);
        if (!completedIds.includes(lessonId)) {
          completedIds.push(lessonId);
          localStorage.setItem("lms-progress-completed-ids", JSON.stringify(completedIds));
        }
      } catch (e) {
        console.error(e);
      }
    }

    setLoading(false);
    return { error };
  };

  const markIncomplete = async (lessonId: string) => {
    setLoading(true);

    if (typeof window !== "undefined" && !navigator.onLine) {
      console.log("[PWA] Offline: Queueing markIncomplete action");

      // 1. Remove from local completed ids cache
      const completedIdsStr = localStorage.getItem("lms-progress-completed-ids") || "[]";
      try {
        const completedIds = JSON.parse(completedIdsStr);
        const filtered = completedIds.filter((id: string) => id !== lessonId);
        localStorage.setItem("lms-progress-completed-ids", JSON.stringify(filtered));
      } catch (e) {
        console.error(e);
      }

      // 2. Queue action for background sync
      const queueStr = localStorage.getItem("lms-offline-progress-queue") || "[]";
      try {
        const queue = JSON.parse(queueStr);
        queue.push({
          id: crypto.randomUUID(),
          userId,
          lessonId,
          completed: false,
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem("lms-offline-progress-queue", JSON.stringify(queue));
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
      return { error: null }; // Mock success
    }

    const { error } = await supabase
      .from("progress")
      .delete()
      .eq("user_id", userId)
      .eq("lesson_id", lessonId);

    if (!error && typeof window !== "undefined") {
      const completedIdsStr = localStorage.getItem("lms-progress-completed-ids") || "[]";
      try {
        const completedIds = JSON.parse(completedIdsStr);
        const filtered = completedIds.filter((id: string) => id !== lessonId);
        localStorage.setItem("lms-progress-completed-ids", JSON.stringify(filtered));
      } catch (e) {
        console.error(e);
      }
    }

    setLoading(false);
    return { error };
  };

  return { markComplete, markIncomplete, loading };
}
