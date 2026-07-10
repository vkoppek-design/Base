import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Вход",
  description: "Войдите в платформу Veronika Koppek для продолжения обучения",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src="/logo.png" alt="Veronika Koppek" className="w-10 h-10 rounded-full" />
            <span className="text-2xl font-bold text-foreground">
              Veronika Koppek
            </span>
          </div>
          <p className="text-muted text-sm">
            Платформа для развития управленческих навыков
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
