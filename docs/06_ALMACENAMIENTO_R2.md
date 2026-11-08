# Cloudflare R2 — Estructura y reglas

## Buckets
- `kontenido-media` (público-solo-lectura vía Worker si se requiere, pero
  preferimos 100% presigned).
- `kontenido-private` (KYC, contratos, comprobantes de pago).

## Estructura obligatoria en `kontenido-media`
(ver `01_STACK_Y_ARQUITECTURA.md`)

## Reglas de subida
- Frontend NUNCA sube binarios a Vercel.
- Server Action pide presigned PUT URL → cliente sube directo a R2 → notifica
  a `/api/uploads/confirm` para registrar en `media_assets`.
- Validación de MIME y tamaño ANTES de firmar la URL.
- Límites: imagen ≤ 15MB, video ≤ 500MB, duración video ≤ 10min.

## Reglas de lectura
- Previews: URL firmada TTL 60s, siempre visibles.
- Originales: URL firmada TTL 15min, solo si el usuario tiene compra/suscripción.
- Nunca exponer `original_key` en respuestas JSON al cliente; solo la URL firmada
  generada server-side.

## Procesamiento de media
- Al confirmar subida de imagen: generar preview con blur gaussiano + watermark
  KONTENIDO, subir a `.../preview/`.
- Video: extraer frame 1, aplicar blur, subir como preview.
- Guardar dimensiones y duración en `media_assets`.