# Validación de mayoría de edad (KYC)

## Repo a integrar
`https://github.com/jesymca/reconocimiento_cedula`

## Requisito OBLIGATORIO
Ningún usuario puede ser CREATOR sin haber validado su cédula venezolana y
confirmado edad ≥ 18 años.

## Flujos técnicos de Validación

### Flujo 1: Creadora vía OCR y Revisión Humana
1. En `/panel/kyc` la creadora sube o toma con la cámara:
   - Foto frente de cédula (escaneada automáticamente por Tesseract OCR).
   - Foto reverso de cédula.
   - Selfie sosteniendo la cédula (prueba de vida con orientación nativa vertical/horizontal).
2. Los 3 archivos se suben a R2 en `creators/{id}/kyc/{docId}/` (bucket privado `kontenido-private`, sin URL pública, acceso por URL prefirmada de corta duración).
3. El motor OCR extrae: número de cédula, nombres completos, fecha de nacimiento y calcula mayoría de edad.
4. Si la edad calculada es < 18 → RECHAZO automático del formulario.
5. Si es ≥ 18 → entra en estado `PENDING` para revisión humana por SUPER_ADMIN en `/admin/kyc`.

### Flujo 2: Validación Directa desde SUPER_ADMIN (Editar Usuario)
1. El SUPER_ADMIN puede ingresar a `/admin/usuarios` y hacer clic en el botón **Editar** de cualquier usuario.
2. En la sección **Validación de Identidad y Mayoría de Edad (KYC)**, el SUPER_ADMIN dispone de control directo:
   - Selector de estado: `APPROVED`, `PENDING`, `REJECTED`, `NONE`.
   - Campo para ingresar/modificar la Fecha de Nacimiento.
   - Botón directo: **"Validar y Aprobar Mayoría de Edad de Forma Directa"**.
3. Al guardar como `APPROVED`:
   - El usuario pasa a `kycStatus = "APPROVED"` y estado `ACTIVE`.
   - Si existían documentos KYC en estado pendiente, se marcan como aprobados con `ageVerified = 1`, `reviewerId = admin.id` y `reviewedAt = now`.
   - Si no existían documentos previos, se crea un registro de verificación directa en `kyc_documents`.
   - Se genera una traza en `audit_log` con la acción `SUPER_ADMIN_DIRECT_KYC_APPROVAL`.

## Modal de Inspección Visual en Alta Resolución (`/admin/kyc`)
- Al hacer clic sobre cualquiera de las 3 fotografías (Frente, Reverso o Selfie), se abre un **Modal Lightbox de Inspección Detallada**:
  - Visualización en alta definición preservando la relación de aspecto y orientación original (sin recortes horizontales ni distorsión).
  - Herramientas de zoom: Acercar (+), Alejar (-) y Restablecer (50% a 300%).
  - Herramienta de rotación: Giro de 90° en 90° (0°, 90°, 180°, 270°) con tecla rápida `R` o botón.
  - Navegación rápida entre documentos: botones inferiores y flechas del teclado `←` y `→`.
  - Encabezado con datos extraídos (Cédula, Nombres, Fecha de Nacimiento) para cotejar en tiempo real con la fotografía.
  - Atajo de cierre con tecla `Escape`.

## Consideraciones de Seguridad
- Los archivos KYC son altamente confidenciales: acceso exclusivo mediante presigned URLs con TTL de 15 minutos en el bucket `kontenido-private`.
- Eliminación automática de fotos del bucket tras 90 días post-aprobación mediante cron de seguridad.
- Registro estricto de auditoría de todas las revisiones y aprobaciones en `audit_log`.
