import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pulse — управление рекламными проектами",
  description:
    "Мульти-проектная платформа для рекламного агентства: аналитика, лиды, продажи, финансы и сотрудники по каждому проекту.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="min-h-full bg-canvas text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
