# Seguridad y moderación de contenido

## SUPER_ADMIN
- Email: `herrejose@gmail.com` (semilla en `settings`)
- Password: `JyM01012023` (hashear con bcrypt al seedear; forzar cambio en 1er login)
- Panel `/admin`:
  - `/admin/usuarios` (ver, suspender, aprobar)
  - `/admin/kyc`
  - `/admin/recargas` (validar USDT)
  - `/admin/contenido` (revisar TODOS los posts y media subidos)
  - `/admin/payouts`
  - `/admin/agencias`
  - `/admin/reportes`
  - `/admin/settings` (fee, dirección USDT, paridad KOIN/USDT)

## Moderación de contenido
- Todo post nuevo entra como `PENDING_REVIEW`.
- SUPER_ADMIN ve TODAS las imágenes/videos subidos (thumbnails + preview) y
  marca APPROVED / REJECTED con motivo.
- Reglas explícitas: prohibido CSAM, gore, violencia, no consentimiento.
- Botón "Reportar" en perfil público → crea `moderation_flags` OPEN.
- Si se detecta CSAM: bloqueo inmediato del creador + conservación del material
  para autoridades + notificación interna.

## Seguridad general
- Rate limiting en endpoints de auth y recargas (Upstash o memoria en Edge).
- Contraseñas con bcrypt cost 12.
- JWT firmado; roles en claims verificados en middleware.
- CSRF protection en Server Actions (nativo Next.js).
- Sanitización de username (regex `^[a-z0-9_]{3,30}$`).
- HTTPS forzado, HSTS, CSP estricta.