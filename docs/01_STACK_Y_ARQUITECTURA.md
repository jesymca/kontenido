# Stack y Arquitectura

## Frontend
- Next.js 14 App Router
- Rutas públicas: `/`, `/login`, `/registro`, `/[username]`, `/[username]/[postId]`
- Rutas privadas: `/panel/*` (creador), `/cuenta/*` (consumidor), `/agencia/*`, `/admin/*`

## Backend
- Server Actions + Route Handlers (Next.js)
- Middleware para auth y control de rol
- Cron de Vercel (`/api/cron/*`) para cortes semanales

## Base de datos (Turso)
- Migraciones con Drizzle Kit
- `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` en Vercel env

## Almacenamiento (Cloudflare R2)
- Bucket principal: `kontenido-media`
- Estructura de carpetas OBLIGATORIA:

/creators/{creatorId}/avatar/{filename}
/creators/{creatorId}/banner/{filename}
/creators/{creatorId}/posts/{postId}/original/{filename}
/creators/{creatorId}/posts/{postId}/preview/{filename}   # blur/watermark
/creators/{creatorId}/packages/{packageId}/{filename}
/creators/{creatorId}/kyc/{docId}/{filename}              # cédula, privado
/agencies/{agencyId}/logo/{filename}
/temp/{userId}/{uuid}                                     # uploads temporales

Regla: NUNCA público directo. Todo acceso vía presigned URL firmada (TTL 60s
para previews, 15min para originales comprados).

Preview (blur) generada en servidor con Sharp antes de subir, y el original
se sube cifrado/no listado.
