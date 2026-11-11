# Cloudflare R2 — Estructura, Firma Digital y Preservación de Formatos

## Buckets
- `kontenido-media`: Archivos de publicaciones, avatares y banners (públicos o vía presigned URLs según acceso).
- `kontenido-private`: Documentos KYC, contratos de creadoras y comprobantes de recarga.

## Estructura obligatoria en `kontenido-media`
- `creators/{userId}/posts/{postId}/original/{filename}`
- `creators/{userId}/posts/{postId}/preview/{filename}`
- `creators/{userId}/avatar/{uniqueId}.{ext}`
- `creators/{userId}/banner/{uniqueId}.{ext}`
- `backups/{userId}/{originalKey}` (conservación obligatoria tras eliminación)

## Reglas de subida
- El frontend solicita una URL prefirmada (`/api/uploads/presigned`) y sube el archivo binario directamente a Cloudflare R2 sin sobrecargar las funciones serverless.
- Validación de tipo MIME y tamaño:
  - Imágenes: hasta 15MB.
  - Videos: hasta 500MB (duración recomendada ≤ 10min).

## Firma Digital de Contenido (`https://www.kontenido.online/{usuario}`)
Todo contenido fotográfico o de video subido por una creadora debe ser firmado con el enlace de su perfil exclusivo:
`https://www.kontenido.online/{usuario}`

### Implementación Técnica de la Firma
1. **Firmado en Cliente (Fotos)**:
   - Antes de subir a Cloudflare R2, `src/lib/watermarkClient.ts` procesa la fotografía utilizando HTML5 Canvas.
   - Aplica una pastilla semitransparente oscura con borde rose-500, indicador oficial de KONTENIDO y la URL completa de la creadora en la esquina inferior.
   - Preserva la resolución original y no altera la orientación del archivo.
2. **Firmado en Servidor (Sharp y FFmpeg)**:
   - `src/lib/watermarkServer.ts`:
     - **Sharp (`signImageBufferWithSharp`)**: Ejecuta siempre `.rotate()` para auto-orientar según los metadatos EXIF (imprescindible para fotos tomadas con teléfonos verticales) y compone el badge SVG con la firma.
     - **FFmpeg (`signVideoWithFfmpeg`)**: Utiliza el filtro `drawtext` para incrustar la URL en videos MP4/WebM manteniendo la pista de audio intacta (`-c:a copy`) y adaptando el tamaño a la resolución del video.
   - Endpoint disponible: `POST /api/media/watermark`.
3. **Capa Visual Permanente en Reproductores**:
   - En la página de perfil (`/[username]`) y en el modal de contenido (`CreatorContentModal.tsx`), se renderiza una etiqueta flotante protegida con `https://www.kontenido.online/{usuario}` sobre cualquier foto o video, impidiendo que capturas de pantalla o grabadores evadan la firma.

## Preservación Estricta de Perspectiva (Vertical vs Horizontal)
- **Problema Corregido**: Fotos y videos tomados verticalmente (cámaras de smartphones, 9:16) no deben forzarse ni recortarse a proporciones horizontales (16:9).
- **Reglas de Perspectiva**:
  - En la cámara WebRTC (`MediaCaptureModal.tsx`): Las restricciones de video detectan la orientación del viewport (`aspectRatio: 9/16` en vertical y `16/9` en horizontal) y el canvas se dimensiona con `video.videoWidth` y `video.videoHeight` reales.
  - En contenedores de vista previa (`SocialPostComposer.tsx`, `CreatorContentModal.tsx`, `CedulaOcrScanner.tsx`): Se eliminó la clase forzada `aspect-video` combinada con `object-cover`. Se utiliza `object-contain` y alturas adaptables (`max-h-[...] w-auto max-w-full`).
  - En el visor de publicaciones públicas: Se emplea `object-contain` con fondo neutro oscuro para respetar el 100% del encuadre original, sea vertical u horizontal.
