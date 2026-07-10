"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useToast } from "@/components/shared/toast-provider";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/hooks/use-user";

interface PwaContextType {
  isOnline: boolean;
}

const PwaContext = createContext<PwaContextType>({ isOnline: true });

export function usePwa() {
  return useContext(PwaContext);
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const { addToast } = useToast();
  const supabase = createClient();
  const { user } = useUser();

  // 0. Prefetch App Shell HTML pages when online and logged in
  useEffect(() => {
    if (user && isOnline) {
      const prefetchShells = async () => {
        try {
          console.log("[PWA] Prefetching offline HTML shells...");
          await Promise.all([
            fetch("/dashboard", { headers: { "Accept": "text/html" } }),
          ]);
          console.log("[PWA] Offline HTML shells prefetched successfully");
        } catch (e) {
          console.warn("[PWA] Failed to prefetch offline HTML shells:", e);
        }
      };
      // Delay prefetching slightly to not interfere with initial page load
      const timer = setTimeout(prefetchShells, 3000);
      return () => clearTimeout(timer);
    }
  }, [user, isOnline]);

  // 1. Service Worker registration
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      (window as any).workbox === undefined // Avoid registering during SSR or hot reloads if using workbox
    ) {
      const handleRegister = async () => {
        try {
          const registration = await navigator.serviceWorker.register("/sw.js");
          console.log("[PWA] Service Worker registered with scope:", registration.scope);
        } catch (error) {
          console.error("[PWA] Service Worker registration failed:", error);
        }
      };
      
      // Delay registration slightly to prevent impacting page load performance
      if (document.readyState === "complete") {
        handleRegister();
      } else {
        window.addEventListener("load", handleRegister);
        return () => window.removeEventListener("load", handleRegister);
      }
    }
  }, []);

  // 2. Synchronize offline queue to Supabase
  const syncOfflineQueue = async () => {
    if (typeof window === "undefined") return;
    
    const queueStr = localStorage.getItem("lms-offline-progress-queue");
    if (!queueStr) return;

    try {
      const queue = JSON.parse(queueStr);
      if (!Array.isArray(queue) || queue.length === 0) return;

      console.log(`[PWA] Syncing ${queue.length} offline progress actions...`);
      addToast(`Синхронизация прогресса (${queue.length})...`, "info");

      // Process each item in order
      const remainingItems = [...queue];
      for (const item of queue) {
        try {
          if (item.completed) {
            // Sync completion
            const { error } = await supabase.from("progress").upsert(
              {
                user_id: item.userId,
                lesson_id: item.lessonId,
                completed: true,
                completed_at: item.timestamp,
              },
              { onConflict: "user_id,lesson_id" }
            );
            if (error) throw error;
          } else {
            // Sync deletion
            const { error } = await supabase
              .from("progress")
              .delete()
              .eq("user_id", item.userId)
              .eq("lesson_id", item.lessonId);
            if (error) throw error;
          }
          // Remove processed item
          remainingItems.shift();
        } catch (err) {
          console.error("[PWA] Error syncing item, stopping sync batch:", err);
          break; // Stop syncing remaining items if one fails
        }
      }

      // Update queue in localStorage
      if (remainingItems.length === 0) {
        localStorage.removeItem("lms-offline-progress-queue");
        addToast("Прогресс успешно синхронизирован с сервером", "success");
      } else {
        localStorage.setItem("lms-offline-progress-queue", JSON.stringify(remainingItems));
      }
    } catch (e) {
      console.error("[PWA] Failed to parse or process offline progress queue:", e);
    }
  };

  // 3. Monitor Network Status
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      addToast("Соединение восстановлено. Вы снова в сети", "success");
      syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      addToast("Соединение потеряно. Платформа работает в офлайн-режиме", "info");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial sync if online on mount
    if (navigator.onLine) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [addToast]);

  return (
    <PwaContext.Provider value={{ isOnline }}>
      {children}
    </PwaContext.Provider>
  );
}
