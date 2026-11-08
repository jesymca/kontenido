import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

// Instancia de autenticación ligera compatible al 100% con Vercel Edge Runtime
const { auth } = NextAuth(authConfig);

/**
 * Middleware central de KONTENIDO
 * - Control de acceso basado en roles (RBAC) en el Edge
 * - Protección de rutas de administración (/admin), creadores (/panel), agencias (/agencia) y consumidores (/cuenta)
 * - Detección y bloqueo de usuarios suspendidos (/suspendido)
 */
export default auth((req) => {
  try {
    const { nextUrl } = req;
    const user = req.auth?.user;
    const pathname = nextUrl.pathname;

    // Rutas exentas de validación de autenticación
    const isPublicRoute =
      pathname === "/" ||
      pathname === "/login" ||
      pathname === "/registro" ||
      pathname === "/suspendido" ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/api/cron") ||
      pathname.startsWith("/_next") ||
      pathname.includes(".");

    // 1. Si el usuario está suspendido, bloquear acceso y enviar a la vista de suspensión
    if (user && user.status === "SUSPENDED" && pathname !== "/suspendido" && !pathname.startsWith("/api/auth")) {
      return NextResponse.redirect(new URL("/suspendido", nextUrl));
    }

    // 2. Proteger rutas de SUPER_ADMIN (/admin/*)
    if (pathname.startsWith("/admin")) {
      if (!user) {
        return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, nextUrl));
      }
      if (user.role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/", nextUrl));
      }
    }

    // 3. Proteger rutas de Creador (/panel/*)
    if (pathname.startsWith("/panel")) {
      if (!user) {
        return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, nextUrl));
      }
      // Nota: Si el usuario es Creador o Super Admin, tiene acceso completo.
      // Si el rol en sesión aún no se ha refrescado a CREATOR (o es CONSUMER), se envía a /cuenta con aviso
      if (user.role !== "CREATOR" && user.role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/cuenta", nextUrl));
      }
    }

    // 4. Proteger rutas de Agencia (/agencia/*)
    if (pathname.startsWith("/agencia")) {
      if (!user) {
        return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, nextUrl));
      }
      if (user.role !== "AGENCY" && user.role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/", nextUrl));
      }
    }

    // 5. Proteger rutas de Consumidor / Billetera (/cuenta/*)
    if (pathname.startsWith("/cuenta")) {
      if (!user) {
        return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(pathname)}`, nextUrl));
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Error en middleware de seguridad Edge:", error);
    return NextResponse.next();
  }
});

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto archivos estáticos como favicon, png, svg, etc.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
