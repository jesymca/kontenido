# Billetera KOIN y sistema de pagos

## Concepto de KOIN
- KOIN es la moneda interna. 1 KOIN ≈ 1 USDT (paridad fija configurable por
  SUPER_ADMIN en tabla `settings`).
- Toda operación interna (suscripción, compra, payout) se hace en KOIN.
- Solo la recarga (USDT → KOIN) entra dinero real.

## Recarga (SOLO CONSUMER, vía Binance USDT)
1. Consumer ve dirección/QR USDT (TRC20 o BEP20) configurada por SUPER_ADMIN.
2. Consumer transfiere USDT y sube comprobante (tx hash + captura) desde su panel.
3. Se crea `wallet_transactions` type=TOPUP_USDT status=PENDING.
4. SUPER_ADMIN revisa en `/admin/recargas` y marca CONFIRMED o REJECTED.
5. Si CONFIRMED: se acredita `balance_koin` y se registra CONVERSION.
6. Si REJECTED: se notifica motivo.

## Suscripción (consumer → creator)
- Precio mensual definido por cada creator (`profiles.subscription_price_koin`).
- Al suscribirse: se descuenta del wallet y se registra en `subscriptions`.
- Se notifica al creator: "Toda suscripción que configures se cobra de forma
  unificada a través de la billetera KOIN del consumidor. Recibirás tu corte
  semanal en el método de pago que elijas."
- Renovación: cron diario verifica `ends_at` y, si auto_renew y saldo
  suficiente, renueva. Si no, EXPIRED.

## Compras individuales / paquetes
- Se debita wallet, se crea `purchases`, se desbloquean originales.

## Cortes semanales a CREATORS
- Cron de Vercel cada lunes 00:00 UTC (`/api/cron/payouts`).
- Calcula por creador: sum(subscriptions activas del período) +
  sum(purchases del período) − comisión plataforma (`settings.platform_fee_pct`).
- Crea `payouts` en estado PENDING.
- SUPER_ADMIN ve la lista, elige el `payment_method_id` (de los 3 configurados
  por el creador) y marca PAID adjuntando comprobante (R2).
- El creador ve historial de cortes y comprobantes en su panel.

## Reglas
- NUNCA se permite retiro libre por parte del creador. Solo cortes semanales
  aprobados por SUPER_ADMIN.
- Todo movimiento queda en `wallet_transactions` y en `audit_log`.