import type { NextConfig } from "next";

// Configuración principal de Next.js para KONTENIDO
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com", // Fotos de perfil de Google
      },
    ],
  },
  // Paquetes del servidor para evitar bundling innecesario de binarios nativos
  serverExternalPackages: ["@libsql/client", "sharp"],
};

export default nextConfig;
