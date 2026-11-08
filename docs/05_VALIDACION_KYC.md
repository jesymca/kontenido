# Validación de mayoría de edad (KYC)

## Repo a integrar
`https://github.com/jesymca/reconocimiento_cedula`

## Requisito OBLIGATORIO
Ningún usuario puede ser CREATOR sin haber validado su cédula venezolana y
confirmado edad ≥ 18 años.

## Flujo técnico
1. En `/panel/kyc` el usuario sube:
   - Foto frente de cédula
   - Foto reverso de cédula
   - Selfie sosteniendo la cédula
2. Los 3 archivos se suben a R2 en `creators/{id}/kyc/{docId}/` (bucket privado,
   sin URL pública, solo presigned para SUPER_ADMIN).
3. Se invoca el microservicio `reconocimiento_cedula` (clonar el repo en
   `/services/cedula-recognition` o desplegarlo como función independiente).
4. El servicio devuelve: número de cédula, fecha de nacimiento, nombres,
   apellidos y confianza del OCR.
5. Se calcula edad. Si < 18 → RECHAZO automático + log.
6. Si ≥ 18 → status PENDING para revisión humana por SUPER_ADMIN.
7. SUPER_ADMIN compara visualmente y aprueba/rechaza en `/admin/kyc`.

## Consideraciones
- Los archivos KYC son altamente sensibles: acceso solo vía presigned URL de
  corta duración, log de quién accedió en `audit_log`.
- Borrar del R2 a los 90 días post-aprobación (cron).
- Nunca loggear número de cédula completo en consola; enmascarar.