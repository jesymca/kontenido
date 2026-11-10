import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || "https://kontenido.online";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/registro", "/login", "/[username]"],
        disallow: [
          "/panel/",
          "/admin/",
          "/api/",
          "/cuenta/",
          "/suspendido",
        ],
      },
      {
        // Permitir acceso total a crawlers sociales para vistas previas en WhatsApp, Telegram, Twitter, etc.
        userAgent: [
          "WhatsApp",
          "TelegramBot",
          "Twitterbot",
          "facebookexternalhit",
          "LinkedInBot",
          "Slackbot",
          "Applebot",
        ],
        allow: "/",
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
