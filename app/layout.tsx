import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Thales Franco | Training Studio",
  description: "Treino com ciência. Resultado com constância.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
