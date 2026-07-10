import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ToastProvider } from "@/components/shared/toast-provider";
import { UserProvider } from "@/hooks/use-user";
import { PwaProvider } from "@/components/providers/pwa-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Veronika Koppek — Управленческие навыки",
    template: "%s | Veronika Koppek",
  },
  description:
    "Развивайте управленческие навыки: построение команды, коммуникация, мотивация и разрешение конфликтов",
  manifest: "/manifest.json",
  keywords: [
    "управление командой",
    "управленческие навыки",
    "лидерство",
    "мотивация сотрудников",
    "разрешение конфликтов",
    "коммуникация",
    "курсы для руководителей",
  ],
  authors: [{ name: "Veronika Koppek" }],
  openGraph: {
    title: "Veronika Koppek — Управленческие навыки",
    description:
      "Развивайте управленческие навыки: построение команды, коммуникация, мотивация и разрешение конфликтов",
    type: "website",
    locale: "ru_RU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <UserProvider>
          <ToastProvider>
            <PwaProvider>{children}</PwaProvider>
          </ToastProvider>
        </UserProvider>
      </body>
    </html>
  );
}
