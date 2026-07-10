"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { ShieldAlert, LogOut, Loader2 } from "lucide-react";

export default function PendingPage() {
  const { user, profile, loading } = useUser();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!loading && profile?.is_approved) {
      router.push("/dashboard");
    }
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, profile, loading, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-warning/10 text-warning rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground">Заявка на рассмотрении</h1>
        
        <p className="text-muted text-sm leading-relaxed">
          Ваш аккаунт успешно создан, но доступ к курсам выдаётся индивидуально. 
          Пожалуйста, подождите, пока администратор проверит вашу заявку и откроет доступ.
        </p>

        <div className="pt-6 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
}
