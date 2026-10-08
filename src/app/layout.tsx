import type { Metadata, Viewport } from "next";
import type { RootLayoutProps } from "@/lib/types";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yazboz — Okey ve 101 puan tablosu",
  description: "Okey ve 101 masanızın puanlarını telefonlardan canlı takip edin.",
  applicationName: "Yazboz",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f4ef",
};

export default function RootLayout({ children }: Readonly<RootLayoutProps>) {
  return (
    <html lang="tr">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
