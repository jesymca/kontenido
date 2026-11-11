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

## Marca de Agua de Contenido (Watermark) — `https://www.kontenido.online/{usuario}`
Todo contenido fotográfico o de video subido por una creadora debe ser protegido con la **MARCA DE AGUA** de su perfil exclusivo:
`https://www.kontenido.online/{usuario}`

### Implementación Técnica de la Marca de Agua
1. **Marca de Agua en Cliente (Fotos)**:
   - Antes de subir a Cloudflare R2, `src/lib/watermarkClient.ts` procesa la fotografía utilizando HTML5 Canvas.
   - Aplica una **marca de agua diagonal central semitransparente** a lo largo de la foto (`rgba(255, 255, 255, 0.22)` a -22°) para impedir recortes no autorizados.
   - Aplica un **sello oficial de marca de agua en la esquina inferior** con fondo oscuro, acento rosa y la URL completa de la creadora.
   - Preserva la resolución original y no altera la orientación del archivo (fotos verticales permanecen 100% verticales).
2. **Marca de Agua en Servidor (Sharp y FFmpeg)**:
   - `src/lib/watermarkServer.ts`:
     - **Sharp (`signImageBufferWithSharp`)**: Ejecuta siempre `.rotate()` para auto-orientar según los metadatos EXIF (imprescindible para fotos tomadas con teléfonos verticales) y compone el overlay SVG con la marca de agua diagonal y el sello.
     - **FFmpeg (`signVideoWithFfmpeg`)**: Utiliza el filtro `drawtext` para incrustar la marca de agua en videos MP4/WebM manteniendo la pista de audio intacta (`-c:a copy`) y adaptando el tamaño a la resolución del video.
   - Endpoint disponible: `POST /api/media/watermark`.
3. **Componente de Marca de Agua en Reproductores (`MediaWatermark.tsx`)**:
   - En la página de perfil (`/[username]`), en el modal de contenido (`CreatorContentModal.tsx`) y en la previsualización del compositor (`SocialPostComposer.tsx`), se renderiza el componente `<MediaWatermark username={creator.username} />`.
   - Muestra tanto la **marca de agua diagonal central** como el **sello inferior**, superpuestos directamente sobre el video o fotografía en tiempo real (`pointer-events-none`), garantizando que cualquier captura de pantalla o grabación conserve la marca de agua visible.

## Preservación Estricta de Perspectiva (Vertical vs Horizontal)
- **Problema Corregido**: Fotos y videos tomados verticalmente (cámaras de smartphones, 9:16) no deben forzarse ni recortarse a proporciones horizontales (16:9).
- **Reglas de Perspectiva**:
  - En la cámara WebRTC (`MediaCaptureModal.tsx`): Las restricciones de video detectan la orientación del viewport (`aspectRatio: 9/16` en vertical y `16/9` en horizontal) y el canvas se dimensiona con `video.videoWidth` y `video.videoHeight` reales.
  - En contenedores de vista previa (`SocialPostComposer.tsx`, `CreatorContentModal.tsx`, `CedulaOcrScanner.tsx`): Se eliminó la clase forzada `aspect-video` combinada con `object-cover`. Se utiliza `object-contain` y alturas adaptables (`max-h-[...] w-auto max-w-full`).
  - En el visor de publicaciones públicas: Se emplea `object-contain` con fondo neutro oscuro para respetar el 100% del encuadre original, sea vertical u horizontal.
