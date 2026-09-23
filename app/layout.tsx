import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  metadataBase: new URL("https://thalesfranco.vercel.app"),
  applicationName: "Thales Franco",
  appleWebApp: {
    capable: true,
    title: "Thales Franco",
    statusBarStyle: "default",
  },
  title: "Thales Franco | Training Studio",
  description: "Treino com ciência. Resultado com constância.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#141416" };
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
