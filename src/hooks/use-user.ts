"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";
import type { User } from "@supabase/supabase-js";

interface UserContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType>({
  user: null,
  profile: null,
  loading: true,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [profile, setProfileState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const lastTokenRef = useRef<string | null>(null);
  const currentUserRef = useRef<User | null>(null);
  const currentProfileRef = useRef<Profile | null>(null);

  const setUser = (u: User | null) => {
    currentUserRef.current = u;
    setUserState(u);
  };

  const setProfile = (p: Profile | null) => {
    currentProfileRef.current = p;
    setProfileState(p);
  };

  const supabase = createClient();
  const router = useRouter();

  // Load from local cache first on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cachedUser = localStorage.getItem("lms-user-cache");
      const cachedProfile = localStorage.getItem("lms-profile-cache");
      if (cachedUser && cachedProfile) {
        try {
          setUserState(JSON.parse(cachedUser));
          setProfileState(JSON.parse(cachedProfile));
          setLoading(false);
          console.log("UserProvider: Initialized from local cache");
        } catch (e) {
          console.error("Error loading cached user/profile:", e);
        }
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadUserAndProfile = async () => {
      console.log("UserProvider: Starting initial load...");
      
      // If offline on mount, rely purely on local cache
      if (typeof window !== "undefined" && !navigator.onLine) {
        console.log("UserProvider: Offline on mount, loading from cache...");
        const cachedUser = localStorage.getItem("lms-user-cache");
        const cachedProfile = localStorage.getItem("lms-profile-cache");
        if (cachedUser && cachedProfile) {
          try {
            setUser(JSON.parse(cachedUser));
            setProfile(JSON.parse(cachedProfile));
          } catch (e) {
            console.error("Error parsing user/profile cache", e);
          }
        }
        if (mounted) setLoading(false);
        return;
      }

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn("UserProvider: Session error, trying cache fallback:", sessionError);
          if (typeof window !== "undefined") {
            const cachedUser = localStorage.getItem("lms-user-cache");
            const cachedProfile = localStorage.getItem("lms-profile-cache");
            if (cachedUser && cachedProfile) {
              try {
                setUser(JSON.parse(cachedUser));
                setProfile(JSON.parse(cachedProfile));
                if (mounted) setLoading(false);
                return;
              } catch (e) {
                console.error(e);
              }
            }
          }
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        const currentUser = session?.user ?? null;
        const currentToken = session?.access_token ?? null;
        
        lastTokenRef.current = currentToken;
        if (mounted) setUser(currentUser);

        if (currentUser) {
          console.log("UserProvider: Fetching profile for user:", currentUser.id);
          
          if (typeof window !== "undefined") {
            localStorage.setItem("lms-user-cache", JSON.stringify(currentUser));
          }

          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .single();

          if (profileError) {
            console.warn("UserProvider: Profile query error, trying cache fallback:", profileError);
            if (typeof window !== "undefined") {
              const cachedProfile = localStorage.getItem("lms-profile-cache");
              if (cachedProfile) {
                try {
                  setProfile(JSON.parse(cachedProfile));
                } catch (e) {
                  console.error(e);
                }
              }
            }
          } else if (mounted) {
            setProfile(profileData);
            if (typeof window !== "undefined") {
              localStorage.setItem("lms-profile-cache", JSON.stringify(profileData));
            }
          }
        } else {
          // Only remove cache if we are online and confirmed to have no session
          if (typeof window !== "undefined" && navigator.onLine) {
            localStorage.removeItem("lms-user-cache");
            localStorage.removeItem("lms-profile-cache");
            if (mounted) {
              setUser(null);
              setProfile(null);
            }
          }
        }
      } catch (err) {
        console.error("UserProvider: Critical error loading user:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadUserAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        console.log("UserProvider: Auth state changed:", event);
        
        if (event === 'SIGNED_OUT') {
          lastTokenRef.current = null;
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
            if (typeof window !== "undefined") {
              localStorage.removeItem("lms-user-cache");
              localStorage.removeItem("lms-profile-cache");
            }
          }
          router.push("/login");
          return;
        }

        const currentUser = session?.user ?? null;
        const currentToken = session?.access_token ?? null;

        // Skip redundant profile fetches if the session token hasn't changed and profile exists
        if (
          currentToken === lastTokenRef.current &&
          currentUserRef.current !== null &&
          currentProfileRef.current !== null
        ) {
          console.log("UserProvider: Token has not changed. Skipping profile fetch.");
          return;
        }

        lastTokenRef.current = currentToken;
        if (mounted) setUser(currentUser);

        if (currentUser) {
          console.log("UserProvider: Fetching profile for user on auth change (deferred):", currentUser.id);
          // Defer the database query to the next tick of the event loop to release Supabase auth lock first
          setTimeout(async () => {
            if (!mounted) return;
            try {
              const { data: profileData, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", currentUser.id)
                .single();
              if (error) {
                console.warn("UserProvider: Deferred profile fetch error:", error);
              } else if (mounted) {
                setProfile(profileData);
                if (typeof window !== "undefined") {
                  localStorage.setItem("lms-profile-cache", JSON.stringify(profileData));
                }
              }
            } catch (err) {
              console.error("UserProvider: Deferred profile fetch critical error:", err);
            }
          }, 0);
        } else {
          if (mounted) setProfile(null);
        }
      }
    );

    // Re-validate auth session when the user returns to this browser tab.
    // When the tab is backgrounded, the JS event loop freezes and the auth
    // token may silently expire. Calling getSession() on visibility change
    // forces Supabase to refresh the token if needed.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible" || !mounted) return;

      // If offline, do NOT re-validate session with the server
      if (typeof window !== "undefined" && !navigator.onLine) {
        console.log("UserProvider: Tab became visible but offline, skipping session re-validation");
        return;
      }

      console.log("UserProvider: Tab became visible, re-validating session...");
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("UserProvider: Visibility re-validation error:", error);
          return;
        }

        const newToken = session?.access_token ?? null;
        const newUser = session?.user ?? null;

        // If the token changed while we were away, update state
        if (newToken !== lastTokenRef.current) {
          console.log("UserProvider: Token changed while tab was hidden, updating...");
          lastTokenRef.current = newToken;
          if (mounted) setUser(newUser);

          if (newUser) {
            const { data: profileData, error: profileError } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", newUser.id)
              .single();
            if (!profileError && mounted) {
              setProfile(profileData);
              if (typeof window !== "undefined") {
                localStorage.setItem("lms-profile-cache", JSON.stringify(profileData));
              }
            }
          } else if (mounted) {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error("UserProvider: Visibility re-validation critical error:", err);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return React.createElement(UserContext.Provider, { value: { user, profile, loading } }, children);
}

export function useUser() {
  return useContext(UserContext);
}
