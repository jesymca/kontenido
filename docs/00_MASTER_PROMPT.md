# MASTER PROMPT — Proyecto KONTENIDO

## Objetivo
Construir una plataforma web tipo OnlyFans simplificada, nativa en Vercel,
con base de datos Turso (LibSQL) y almacenamiento de archivos en Cloudflare R2.
La plataforma se llama **KONTENIDO** y debe ser EXTREMADAMENTE intuitiva.

## Reglas inquebrantables para la IA
1. Lee TODOS los archivos `/docs/*.md` antes de escribir código.
2. Antes de crear archivos, actualiza `10_ROADMAP_Y_ESTADO.md` indicando la fase.
3. NO subir al repo: `.env`, `node_modules`, `.next`, `dist`, `*.log`, archivos
   temporales, credenciales, dumps de BD. Respetar `.gitignore` estricto.
4. NO subir a Vercel archivos innecesarios. Solo build output.
5. Cada endpoint, tabla y componente debe tener comentarios en español.
6. Todo cambio debe quedar documentado en `10_ROADMAP_Y_ESTADO.md`.
7. Si una decisión no está especificada aquí, propón opción y pregunta.

## Stack obligatorio
- Next.js 14 (App Router) + TypeScript
- Vercel (deploy nativo, Edge + Node runtime según necesidad)
- Turso (LibSQL) con `@libsql/client` y Drizzle ORM
- Cloudflare R2 con `@aws-sdk/client-s3` (S3 compatible)
- Autenticación: NextAuth v5 (Credentials + JWT)
- UI: TailwindCSS + shadcn/ui
- Validación: Zod
- Subida de archivos: presigned URLs directo a R2 (nunca pasar binarios por Vercel)

## Dominio y URLs
- Cada usuario tendrá URL pública: `https://<dominio>/<username>`
- El sistema debe funcionar con cualquier dominio configurado (multi-tenant
  por path, NO por subdominio, para simplificar).

## Idiomas
- UI en español (Venezuela). Código y variables en inglés.