import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import AntiDownloadProtection from "@/components/AntiDownloadProtection";
import { auth } from "@/auth";

const defaultBaseUrl = process.env.NEXTAUTH_URL || "https://kontenido.online";

export const metadata: Metadata = {
  metadataBase: new URL(defaultBaseUrl),
  title: {
    default: "KONTENIDO — Plataforma de Creadores y Contenido Exclusivo",
    template: "%s | KONTENIDO",
  },
  description:
    "Plataforma líder en Venezuela para creadores de contenido, fotos y videos exclusivos. Monetiza con KOIN (USDT) y recibe tus pagos directo en PagoMóvil o Bancos Nacionales.",
  applicationName: "KONTENIDO",
  authors: [{ name: "KONTENIDO", url: defaultBaseUrl }],
  generator: "Next.js",
  keywords: [
    "kontenido",
    "creadores venezuela",
    "onlyfans venezuela",
    "fotos exclusivas",
    "videos exclusivos",
    "pagomovil creadores",
    "koin",
    "usdt venezuela",
    "binance venezuela",
    "suscripciones vip",
    "monetizar fotos venezuela",
  ],
  creator: "KONTENIDO",
  publisher: "KONTENIDO",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "icon",
        type: "image/png",
        sizes: "192x192",
        url: "/icon-192.png",
      },
      {
        rel: "icon",
        type: "image/png",
        sizes: "512x512",
        url: "/icon-512.png",
      },
    ],
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    locale: "es_VE",
    url: defaultBaseUrl,
    siteName: "KONTENIDO",
    title: "KONTENIDO — Tus fotos y videos en 1 solo clic",
    description:
      "Plataforma líder en Venezuela para creadores de contenido exclusivo. Monetiza con KOIN (USDT) y retira tus ganancias en PagoMóvil, Transferencia Bancaria o Binance.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "KONTENIDO — Plataforma de Creadores en Venezuela",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KONTENIDO — Tus fotos y videos en 1 solo clic",
    description:
      "Monetiza tu comunidad en Venezuela con KOIN (USDT) y retira en PagoMóvil o Binance.",
    images: ["/og-image.png"],
    creator: "@kontenido_ve",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "entertainment",
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
