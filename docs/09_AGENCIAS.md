# Plataforma de atención a AGENCIAS

## Rol AGENCY
- Registro independiente con datos fiscales/legales.
- Puede "afiliar" creadores (con consentimiento de estos).
- Panel `/agencia`:
  - Listado de creadores afiliados + métricas (suscripciones, ventas, payouts).
  - Solicitudes de afiliación pendientes.
  - Reportes descargables (CSV/PDF).
  - Chat de soporte con SUPER_ADMIN.

## Reglas
- Comisión de agencia configurable (`agencies.commission_pct`), descontada del
  payout del creador y acreditada a la agencia en su propio corte semanal.
- Un creador solo puede pertenecer a 1 agencia.
- Tabla `agency_creators` para la relación.
- SUPER_ADMIN puede aprobar/suspender agencias.