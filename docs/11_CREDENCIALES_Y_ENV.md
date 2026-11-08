# Credenciales y variables de entorno

⚠️ NO subir este archivo con valores reales a Git. Usar `.env.example` con
placeholders. Los valores reales viven solo en Vercel → Settings → Environment
Variables y en el `.env.local` del desarrollador (ignorado por git).

## SUPER_ADMIN inicial
- Email: `herrejose@gmail.com`
- Password: `JyM01012023` (forzar cambio en primer login; hashear con bcrypt)

## .gitignore obligatorio
node_modules/
.next/
dist/
build/
.env
.env.local
.env.*.local
.log
.DS_Store
coverage/
turso.db
turso.db-
drizzle/meta/_journal.json.bak

## Vercel
- Framework preset: Next.js
- Build command: `pnpm build`
- Output: `.next`
- Ignored: `docs/`, `services/cedula-recognition/node_modules`, scripts de seed
  que no deban ejecutarse en build.

## Turso
- Crear DB `kontenido-prod` y `kontenido-dev`.
- Guardar `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` en Vercel (prod y preview).

## Cloudflare R2
- Crear buckets `kontenido-media` y `kontenido-private`.
- API Token con permisos Object Read & Write sobre esos buckets.
- Guardar las 5 variables (`R2_*`) en Vercel.
