# Contrato virtual obligatorio (CREATOR)

## Contenido mínimo del contrato
Texto a mostrar con scroll y checkbox "Acepto":

> **CONTRATO DE PRESTACIÓN DE SERVICIOS – KONTENIDO**
>
> Yo, [nombre completo], titular de la cédula de identidad [número], declaro:
>
> 1. Ser MAYOR DE EDAD (≥ 18 años), lo cual fue validado mediante mi cédula
>    venezolana.
> 2. Que todo el contenido (fotografías y videos) que publique en KONTENIDO es
>    creado por mi voluntad propia, sin coacción, y es de mi autoría.
> 3. Que libero a KONTENIDO (la plataforma) de cualquier obligación, relación
>    laboral, de creación de contenido o responsabilidad sobre el material
>    publicado. KONTENIDO es únicamente un canal de oferta y no produce,
>    edita ni distribuye contenido propio.
> 4. Que cumplo con la legislación venezolana aplicable y me hago responsable
>    del contenido que publico.
> 5. Que entiendo que los pagos se realizan vía cortes semanales en los métodos
>    configurados y que la plataforma cobra una comisión del [X]%.
> 6. Que acepto la política de moderación y puedo ser suspendido si incumplo.

## Registro
- Al aceptar: guardar en `creator_contracts` (fecha, IP, user-agent, versión).
- Generar PDF (react-pdf o puppeteer server-side) y subir a R2
  `kontenido-private/creators/{id}/contracts/{version}.pdf`.
- Descargable por el creador desde su panel.