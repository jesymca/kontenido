import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AntiDownloadProtection from "@/components/AntiDownloadProtection";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "KONTENIDO — Vende y disfruta creaciones fotográficas y videos",
  description:
    "Plataforma venezolana de contenido exclusivo, suscripciones y monetización directa con KOIN y USDT.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/img/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.svg",
    apple: "/img/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const isConsumer = session?.user?.role === "CONSUMER";
  const canDownload =
    session?.user?.allowDownload === 1 || session?.user?.role === "SUPER_ADMIN";

  return (
    <html lang="es">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen flex flex-col">
        {/* Sistema de protección contra descargas no autorizadas */}
        <AntiDownloadProtection isConsumer={isConsumer} canDownload={canDownload} />

        {/* Barra de navegación superior */}
        <Navbar />

        {/* Contenido de la página */}
        <main className="flex-1">{children}</main>

        {/* Pie de página */}
        <footer className="border-t border-slate-800 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} KONTENIDO. Todos los derechos reservados. Pagos respaldados en KOIN.</p>
        </footer>
      </body>
    </html>
  );
}
