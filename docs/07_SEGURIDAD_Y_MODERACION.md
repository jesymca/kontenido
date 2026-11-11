# Seguridad y moderación de contenido

## SUPER_ADMIN
- Email: `herrejose@gmail.com` (semilla en `settings`)
- Password: `JyM01012023` (hashear con bcrypt al seedear; forzar cambio en 1er login)
- Panel `/admin`:
  - `/admin/usuarios` (CRUD completo de usuarios, cambio de roles, niveles, VIP, suspensión y **Validación Directa de KYC y Mayoría de Edad**)
  - `/admin/kyc` (revisión de cédulas frente/reverso/selfie con visor modal de alta resolución, zoom y rotación)
  - `/admin/recargas` (validar USDT)
  - `/admin/contenido` (revisar y moderar publicaciones)
  - `/admin/payouts`
  - `/admin/agencias`
  - `/admin/reportes`
  - `/admin/settings` (fee, dirección USDT, paridad KOIN/USDT)

## Validación Directa de KYC en Edición de Usuario
- El SUPER_ADMIN puede entrar a la ficha de cualquier usuario en `/admin/usuarios` (modal Editar Usuario) y aprobar directamente la Validación de Identidad y Mayoría de Edad (≥ 18 años).
- Actualiza automáticamente `users.kycStatus = "APPROVED"` y `users.status = "ACTIVE"`.
- Registra la fecha de nacimiento ingresada o confirmada.
- Sincroniza o crea el registro correspondiente en `kyc_documents` y deja constancia en `audit_log`.

## Firma Digital contra Fugas y Piratería
- Todo material fotográfico o en video subido a la plataforma es firmado con la URL única de la creadora (`https://www.kontenido.online/{usuario}`).
- Combina quemado en binario (HTML5 Canvas / Sharp / FFmpeg) con pastilla de protección superpuesta no interactiva en los reproductores web.
- Protege la autoría ante capturas de pantalla, grabaciones indebidas y redistribución no autorizada.

## Moderación de contenido
- Todo post nuevo entra como `PENDING_REVIEW` o `APPROVED` según directriz administrativa.
- SUPER_ADMIN ve TODAS las imágenes/videos subidos (thumbnails + preview) y marca APPROVED / REJECTED con motivo.
- Reglas explícitas: prohibido CSAM, gore, violencia, no consentimiento.
- Botón "Reportar" en perfil público → crea `moderation_flags` OPEN.
- Si se detecta CSAM: bloqueo inmediato del creador + conservación del material para autoridades + notificación interna.

## Seguridad general
- Rate limiting en endpoints de auth y recargas (Upstash o memoria en Edge).
- Contraseñas con bcrypt cost 12.
- JWT firmado; roles en claims verificados en middleware.
- CSRF protection en Server Actions (nativo Next.js).
- Sanitización de username (regex `^[a-z0-9_]{3,30}$`).
- HTTPS forzado, HSTS, CSP estricta.
