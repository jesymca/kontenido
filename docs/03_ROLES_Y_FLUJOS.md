# Roles y flujos de usuario

## 1. Registro (2 tipos de usuario, sin fricción)

Pantalla de bienvenida con DOS botones grandes:
- **"Quiero crear contenido"** → rol CREATOR
- **"Quiero ver contenido"** → rol CONSUMER

### Flujo CREATOR (obligatorio KYC + contrato)
1. Datos: email, password, username (slug), fecha de nacimiento.
2. Subir cédula (frente/reverso) + selfie → se ejecuta el repo
   `https://github.com/jesymca/reconocimiento_cedula` (ver 05_VALIDACION_KYC.md).
3. Si `age >= 18` → firmar contrato virtual (ver 08_CONTRATOS_Y_LEGAL.md).
4. Configurar métodos de pago (al menos 1).
5. Configurar mensualidad de suscripción (KOIN).
6. Estado: PENDING_REVIEW → SUPER_ADMIN aprueba → ACTIVE.

### Flujo CONSUMER
1. Datos: email, password, username.
2. Verificación de edad declarativa (checkbox + fecha nacimiento ≥ 18).
3. Crear wallet con balance 0.
4. Para consumir: recargar USDT → SUPER_ADMIN valida → se acredita KOIN.

## 2. URL pública por usuario
- `https://dominio.com/{username}` → perfil público (bio, avatar, banner,
  previews, precio suscripción, botones "Suscribirse" y "Comprar contenido").
- El perfil se renderiza por `middleware` que resuelve el `username` contra la
  BD. Si no existe → 404. Si existe y está suspendido → página de aviso.

## 3. Bancos (seed fijo)
| id | nombre_banco |
|----|--------------|
| 1 | 100% Banco |
| 2 | Bancamiga |
| 3 | Banco Activo |
| 4 | Banco Agrícola de Venezuela |
| 5 | Banco Caroní |
| 6 | Banco de Comercio Exterior (BANCOEX) |
| 7 | Banco de Desarrollo Económico y Social (BANDES) |
| 8 | Banco de la Fuerza Armada Nacional Bolivariana (BANFANB) |
| 9 | Banco de la Gente Emprendedora (Bangente) |
| 10 | Banco de Venezuela |
| 11 | Banco del Caribe (Bancaribe) |
| 12 | Banco del Tesoro |
| 13 | Banco Digital de los Trabajadores |
| 14 | Banco Exterior |
| 15 | Banco Internacional de Desarrollo |
| 16 | Banco Nacional de Crédito (BNC) |
| 17 | Banco Nacional de Vivienda y Hábitat (BANAVIH) |
| 18 | Banco Plaza |
| 19 | Banco Provincial |
| 20 | Banco Sofitasa |
| 21 | Bancrecer |
| 22 | Banesco |
| 23 | Banplus |
| 24 | BFC Banco Fondo Común |
| 25 | Del Sur Banco Universal |
| 26 | Instituto Municipal de Crédito Popular (IMCP) |
| 27 | Mercantil |
| 28 | N58 Banco Digital |
| 29 | R4 Banco Microfinanciero |
| 30 | Venezolano de Crédito |

## 4. Métodos de pago que puede configurar un CREATOR
Tres opciones exactas (no más):
1. **Transferencia bancaria** (selecciona banco 1–30 + número de cuenta + titular + cédula)
2. **PagoMóvil** (selecciona banco 1–30 + teléfono + cédula + banco receptor)
3. **Binance** (email o wallet USDT)

El creador puede activar los 3 simultáneamente. El SUPER_ADMIN elige cuál usar
al pagar cada corte semanal.

## 5. Flujo de compra (consumer)
1. Abre perfil público de un creador.
2. Puede: (a) Suscribirse al precio mensual, (b) Comprar post individual,
   (c) Comprar paquete.
3. Si no tiene saldo KOIN → modal "Recargar" → ver 04_BILLETERA_Y_PAGOS.md.
4. Al confirmar: se debita KOIN, se crea `purchase` o `subscription`, se
   desbloquean las presigned URLs de originales.