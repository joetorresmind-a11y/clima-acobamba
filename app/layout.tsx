import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgroClima Local · Cuaderno de campo",
  description: "Registra observaciones, consulta SENAMHI y organiza el trabajo agrícola con información climática local.",
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
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
