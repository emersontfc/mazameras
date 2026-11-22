import type { Metadata } from "next";
import "./globals.css";
import "./mobile.css";
import "./mobile-fix.css";
import "./book-features.css";

export const metadata: Metadata = {
  title: "A Vida dum Estudante de Medicina",
  description: "Um livro escrito por quem viveu a jornada de Medicina.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt">
      <body className="antialiased">{children}</body>
    </html>
  );
}
