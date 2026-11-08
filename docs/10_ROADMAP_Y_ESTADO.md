# Roadmap y estado de desarrollo

> **INSTRUCCIÓN PARA LA IA**: antes de escribir código en una nueva fase,
> actualiza este archivo marcando la fase como `IN_PROGRESS`. Al terminar,
> márcala `DONE` con fecha y notas. Si cambias el alcance, documéntalo aquí.

## Fases
- [x] F0 — Scaffolding Next.js (App Router) + Tailwind + shadcn/ui + Drizzle + env (DONE - 2026-11-07)
- [x] F1 — Modelo de datos, migraciones Turso, seed de bancos, SUPER_ADMIN, niveles de usuario (0-100) y membresías VIP (DONE - 2026-11-07)
- [x] F2 — Auth (NextAuth v5) con roles CREATOR/CONSUMER/AGENCY/SUPER_ADMIN + Google OAuth (DONE - 2026-11-07)
- [x] F3 — KYC con reconocimiento de cédula + contrato virtual de creador (DONE - 2026-11-07)
- [x] F4 — Perfil público `/[username]` + configuración de perfil, métodos de pago y badge con marco de nivel (DONE - 2026-11-07)
- [x] F5 — Uploads a R2 con presigned URLs + generación de previews + respaldo de archivos al eliminar (DONE - 2026-11-07)
- [x] F6 — Billetera KOIN + recargas USDT (validación manual por SUPER_ADMIN) (DONE - 2026-11-07)
- [x] F7 — Suscripciones + compras individuales + paquetes + protección anti-descarga para consumidores (con alerta y suspensión) (DONE - 2026-11-07)
- [x] F8 — Panel SUPER_ADMIN (CRUD completo: usuarios, contenido, niveles, membresías VIP, moderación, recargas, kyc, payouts) (DONE - 2026-11-07)
- [x] F9 — Cortes semanales (cron Vercel) + historial de payouts (DONE - 2026-11-07)
- [x] F10 — Plataforma de agencias (DONE - 2026-11-07)
- [x] F11 — Reportes, auditoría, hardening y verificación final (DONE - 2026-11-07)
- [x] Mejora de Badges VIP — Perfeccionamiento de efectos visuales metálicos 3D y luminosos en CRUD de Membresías (DONE - 2026-11-07)
- [x] Corrección de Relaciones Drizzle ORM en Payouts y Métodos de Pago (DONE - 2026-11-07)
- [x] F12 — Integración DolarAPI (Tasa Paralelo) + Retiros en Bolívares + Comisiones Escalonadas (10%, 15%, 20%) + Módulo de Suscriptores y Liquidaciones (DONE - 2026-11-08)
- [x] F13 — Estabilización Dominio de Producción (kontenido.online), NextAuth trustHost, Resiliencia Vercel y Configuración Google OAuth (DONE - 2026-11-08)
- [x] F14 — Flujo Integral de Creadora Tipo OnlyFans, KYC con Reconocimiento de Cédula (jesymca), Mensajería y Planes de Suscripción (DONE - 2026-11-08)

## Notas
- **F0 Completada**: Next.js 16.4.5 instalado con TypeScript, TailwindCSS, PostCSS, Drizzle ORM, @libsql/client, AWS SDK para R2, Zod, Lucide React, NextAuth v5. Variables de entorno inicializadas en `.env` y documentadas en `.env.example`.
- **F1 Completada**: Schema completo implementado y migrado a Turso LibSQL con 23 tablas. Seed completado con éxito: 30 bancos de Venezuela, configuraciones de plataforma, escala de niveles del 0 al 100 con marcos e inversión, membresías VIP (Ultra, Pro, Platinum, Golden, Silver, Bronce) y usuario SUPER_ADMIN (`herrejose@gmail.com`).
- **F2 Completada**: Autenticación implementada:
  - NextAuth v5 en `src/auth.ts` con Credentials + Google OAuth.
  - Tipos extendidos en `src/types/next-auth.d.ts`.
  - Middleware de seguridad y control de acceso basado en roles en `src/middleware.ts`.
  - Páginas de `/registro` (con selector interactivo Creador/Consumidor + Google), `/login` y `/suspendido`.
  - Componente de protección anti-descarga `AntiDownloadProtection.tsx` con endpoint `/api/security/infraction` que alerta y suspende automáticamente a consumidores no autorizados.
  - Navbar responsivo con saldo KOIN, [Lv. X] y badges VIP.
- **F3 & F4 Completadas**:
  - Módulo KYC en `/panel/kyc` con subida a R2 privado (`kontenido-private`).
  - Firma del Contrato Virtual en `/panel/contrato` con registro legal de IP y datos.
  - Configuración de perfil en `/panel/perfil` y de los 3 métodos de pago en `/panel/pagos` (Transferencia 30 bancos, PagoMóvil, Binance USDT).
  - Perfil público `/[username]` multi-tenant por path con marco numérico de nivel, badges VIP, precios mensuales y feed desbloqueable.
- **F5 & F6 Completadas**:
  - Subida de archivos con URLs prefirmadas directo a R2 (`/api/uploads/presigned`).
  - Al eliminar contenido: notificación obligatoria de borrado de plataforma + respaldo inmutable en R2 y BD (`deletePostWithBackupAction`).
  - Billetera KOIN (`/cuenta`): recarga USDT con verificación de TX Hash, progreso de nivel de inversión y compra de membresías VIP.
- **F11 — Hardening, Corrección de Edge Runtime y Estabilización (DONE - 2026-11-07)**:
  - Resuelto error de Edge Runtime `A Node.js API is used (process.cwd) which is not supported in the Edge Runtime` en `src/middleware.ts`:
    - Eliminado `dotenv.config()` de `src/lib/db/index.ts` (Next.js carga `.env` de forma nativa en todos los entornos; `seed.ts` mantiene su propio dotenv aislado para ejecución por CLI).
    - Implementada la arquitectura desacoplada oficial de NextAuth v5 con `src/auth.config.ts` (Edge-compatible) para el middleware, y `src/auth.ts` con proveedores completos (Credentials + Google + bcrypt) para Node.js runtime.
    - Garantizada total compatibilidad con Vercel Edge Runtime y Turbopack.
  - Integración de identidad visual oficial:
    - Incorporación de `favicon.svg` y `logo.png` desde `/img` en el directorio público y configuración en `src/app/layout.tsx` y `src/components/Navbar.tsx`.
    - Implementación de control de visibilidad de contraseñas ("ojitos" con iconos `Eye` / `EyeOff`) en todos los formularios (`/login`, `/registro`).
- **Mejora Integral de Badges VIP y CRUD de Membresías (DONE - 2026-11-07)**:
  - Resuelto el problema donde en `/admin/membresias` solo el badge "Golden" se apreciaba vistoso:
    - Se identificó que el componente `AdminVipManager.tsx` inyectaba clases crudas de Tailwind sin las clases de estilo maestras 3D (`vip-badge-base`).
    - Se rediseñaron en `src/app/globals.css` todos los badges VIP con gradientes multicapa hiperrealistas, bordes brillantes, bisel interior especular (`inset 0 1px 2px #fff`), halos luminosos (`box-shadow`) de alto contraste y un destello continuo animado (`badgeShimmerSweep`):
      1. **ULTRA**: Fucsia Neón + Fuego Magenta con halo cósmico y pulsación incandescente.
      2. **PRO**: Zafiro Eléctrico + Cobalto Neón con halo azul de alta energía.
      3. **PLATINUM**: Cromo Glacial / Diamante Cristalino con texto azul marino en relieve y bisel diamantino.
      4. **GOLDEN**: Oro Imperial 24K pulido con destellos solares y bisel áureo.
      5. **SILVER**: Plata Esterlina / Mercurio Líquido brillante con alto contraste y borde de platino puro.
      6. **BRONCE**: Cobre Radiante / Oro Rosado incandescente con calor de fragua metálica.
    - Se actualizó `AdminVipManager.tsx` con:
      - Aplicación de `getVipBadgeClass` en la grilla del CRUD.
      - **Vista Previa en Tiempo Real** dentro del modal de creación/edición que reacciona instantáneamente a la escritura.
      - **Selector de Plantillas Rápidas 3D**: 6 botones interactivos que permiten aplicar presets con un solo clic.
    - Se conectó `getVipBadgeClass` en `UserLevelBadge.tsx`, `cuenta/page.tsx` y `AdminUsersTable.tsx`.
- **F12 — Integración DolarAPI, Retiros en Bolívares y Comisiones Escalonadas (DONE - 2026-11-08)**:
  - **Servicio DolarAPI (`src/lib/dolarapi.ts`)**:
    - Consume `https://ve.dolarapi.com/v1/dolares/` y extrae el **VALOR PARALELO** (`promedio`) con fallback inteligente a `/paralelo` y contingencia en BD.
    - Funciones de formateo local venezolano `formatBs()` (ej: `Bs. 1.030,88`).
  - **Comisiones Escalonadas (`src/lib/commissions.ts`)**:
    - Implementación de 3 niveles porcentuales según el monto general acumulado por la creadora:
      - Nivel 1 (Inicial hasta $500 KOIN): 20% de comisión.
      - Nivel 2 (Intermedio $501 a $2,000 KOIN): 15% de comisión.
      - Nivel 3 (Top Creadora > $2,000 KOIN): 10% de comisión preferencial.
    - CRUD 100% administrable desde el panel SUPER_ADMIN (`/admin/settings`).
  - **Flujo de Retiros y Estado "EN ESPERA" (`requestPayoutAction` en `src/actions/creator.ts`)**:
    - Al solicitar retiro, la creadora ve el desglose en KOIN y el equivalente en Bolívares (VES) calculado al Valor Paralelo.
    - El saldo se descuenta inmediatamente y queda registrado en `payouts` con status `PENDING` ("EN ESPERA").
  - **Liquidación por SUPER_ADMIN (`processPayoutAction` en `src/actions/admin.ts`)**:
    - En `/admin/payouts`, el Super Admin visualiza el monto en Bolívares y datos de cuenta/PagoMóvil.
    - Es obligatorio ingresar el **Número de Transferencia / Referencia Bancaria** al liquidar.
    - Al confirmar, el retiro pasa a `PAID` y la creadora ve de inmediato el comprobante y Nro. de Referencia en su panel.
  - **Hub de Retiros y Suscriptores (`src/components/CreatorWithdrawalHub.tsx` & `/panel/pagos`)**:
    - Calculadora interactiva con preview en vivo de Bolívares (VES).
    - Historial de retiros con badge "EN ESPERA" / "PAGADO CON ÉXITO" y número de transferencia.
    - Tabla completa de suscriptores con avatar, nivel, pago en KOIN y ganancia neta correspondiente a la creadora.
    - Gestión de métodos de cobro venezolanos (30 bancos, PagoMóvil, Binance).
  - **Cron Semanal Vercel (`src/app/api/cron/payouts/route.ts`)**:
    - Actualizado para aplicar la tasa paralelo y las 3 comisiones escalonadas automáticamente cada lunes.
    - Se actualizó `AdminVipManager.tsx` con:
      - Aplicación de `getVipBadgeClass` en la grilla del CRUD.
      - **Vista Previa en Tiempo Real** dentro del modal de creación/edición que reacciona instantáneamente a la escritura.
      - **Selector de Plantillas Rápidas 3D**: 6 botones interactivos que permiten aplicar presets con un solo clic.
    - Se conectó `getVipBadgeClass` en `UserLevelBadge.tsx`, `cuenta/page.tsx` y `AdminUsersTable.tsx`.
- **Corrección de Relaciones Drizzle ORM en Payouts y Tablas Relacionadas (DONE - 2026-11-07)**:
  - Resuelto error `Runtime TypeError: Cannot read properties of undefined (reading 'referencedTable')` en `src/app/admin/payouts/page.tsx`:
    - El query `db.query.payouts.findMany({ with: { creator: true } })` y `db.query.paymentMethods.findMany({ with: { bank: true } })` fallaba en tiempo de ejecución porque faltaban las definiciones `payoutsRelations`, `paymentMethodsRelations` y `banksRelations` en `src/lib/db/schema.ts`.
    - Se implementaron y validaron todas las relaciones relacionales de Drizzle ORM (`payoutsRelations`, `paymentMethodsRelations`, `banksRelations`, `subscriptionsRelations`, `purchasesRelations`, `walletTransactionsRelations`, `downloadInfractionsRelations`, `kycDocumentsRelations`, `creatorContractsRelations`, `packagesRelations`, `packageItemsRelations`, `agenciesRelations`, `agencyCreatorsRelations`, `moderationFlagsRelations`, `auditLogRelations`).
    - Verificación exitosa en suite de pruebas relacionales y compilación sin errores con `npm run build`.

- **F14 — Flujo Integral de Creadora Tipo OnlyFans, KYC con Reconocimiento de Cédula (jesymca), Mensajería y Planes de Suscripción (DONE - 2026-11-08)**:
  - **Corrección de URLs y Modales de Registro/Login**:
    - Se ajustó el enlace del creador a `kontenido.online/{tu_usuario}` en `src/app/registro/page.tsx`.
    - Se corrigió la alineación del divisor `O con correo electrónico` y `O con tus credenciales` en `/registro` y `/login` para que quede perfectamente centrado en cualquier pantalla.
  - **Lógica de Estado KYC y Verificación**:
    - Creadoras recién registradas inician obligatoriamente con estado `FALTA VERIFICAR` (`kycStatus: "NONE"`).
    - La insignia `✓ Verificada` en el perfil público `/[username]` y badges de usuario solo se muestra cuando el SUPER_ADMIN aprueba el documento en `/admin/kyc`. De lo contrario muestra `⚠️ Falta Verificar` o `⏳ En Revisión`.
  - **Motor de Reconocimiento de Cédula Venezolana (jesymca)**:
    - Se implementó `src/lib/cedulaParser.ts` con el algoritmo de extracción por distancia Levenshtein y patrones regex oficiales para cédulas venezolanas (`V-XXXXXXX` / `E-XXXXXXX`).
    - Validador de fecha de nacimiento (`DD/MM/AAAA`) y cálculo estricto de mayoría de edad ($\ge 18$ años).
    - Componente interactivo `src/components/CedulaOcrScanner.tsx` con Tesseract.js WebAssembly vía CDN (`jsdelivr`) para mantener bundles ligeros en Vercel, subida encriptada a Cloudflare R2 privado (`kontenido-private`) con frente, reverso y selfie con cédula (prueba de vida), acompañado del aviso legal de confidencialidad y privacidad.
  - **Separación Estricta de Roles (Creadora vs Consumidor)**:
    - Las creadoras usan el sistema para producir y retirar ganancias en Bolívares (`/panel/pagos`), sin confusiones con recargas de billetera de consumo.
    - Se agregó banner informativo de rol en `/cuenta` con acceso directo a Mi Estudio y Retiros.
    - El balance en Navbar redirige a `/panel/pagos` para creadoras y a `/cuenta` para consumidores.
  - **Planes de Suscripción Flexibles (Hasta 3 Opciones con Vencimiento Automatizado)**:
    - Tabla `creator_subscription_plans` en Turso LibSQL con nombre, duración en días (`duration_days`), precio en KOIN y orden.
    - Gestor de planes en `src/components/CreatorPlansManager.tsx` y vista `/panel/suscripciones` donde la creadora visualiza sus suscriptores activos y días restantes antes de expiración.
    - Modal interactivo de selección de planes para fanáticos en `SubscribeButton.tsx` y en el perfil público `/[username]`.
  - **Mensajería Privada 1 a 1 Tipo OnlyFans**:
    - Tabla `messages` en Turso con soporte para texto, emojis rápidos, adjuntos multimedia en R2 y mensajes de pago (PPV bloqueados).
    - Sala de chat completa `src/components/CreatorChatRoom.tsx` y ruta `/panel/mensajes` con lista de conversaciones activas, mensajes cronológicos y cotización en KOIN.
  - **Estudio de Creadora y Checklist de Configuración**:
    - Subnavegador unificado `src/components/CreatorPanelNav.tsx` con acceso a Mi Estudio, Subir Contenido, Perfil y Portada, Retiros (Bs.), Membresías y Mensajería.
    - Checklist de progreso interactivo estilo OnlyFans (Avatar, Portada, Bio, KYC, Método de Cobro y Planes de Suscripción) con porcentaje de avance.
    - Publicador rápido `src/components/SocialPostComposer.tsx` integrado en `/panel` y `/panel/nuevo` con barra de emojis, menciones `@`, preview de fotos/videos y definición de precio PPV.
  - **Compilación de Producción**:
    - 29 rutas estáticas y dinámicas compiladas exitosamente con Next.js 16 (Turbopack) y TypeScript sin errores.

  - **Diagnóstico del error "This page couldn’t load / A server error occurred"**:
    1. En NextAuth v5 (Auth.js), al recibir solicitudes desde dominios personalizados como `https://www.kontenido.online`, si la opción `trustHost: true` o la variable `AUTH_TRUST_HOST=true` no están definidas en la configuración base consumida por el middleware en el Edge, NextAuth lanza `[auth][error] UntrustedHost: Host must be trusted`.
    2. En el Edge Runtime de Vercel, una excepción no capturada en el middleware bloquea toda la navegación y muestra la pantalla genérica 500 de Vercel.
    3. Faltaba manejo de resiliencia (`try/catch`) en las consultas iniciales a Turso en `src/app/page.tsx` y `src/components/Navbar.tsx` para evitar caídas en caso de que las variables de entorno de BD aún no estuviesen sincronizadas en Vercel.
  - **Soluciones Aplicadas en Código**:
    - Se agregó `trustHost: true` y `secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET` directamente en `src/auth.config.ts`.
    - Se protegió `src/middleware.ts` con manejo de errores resiliente para garantizar que fallos inesperados no bloqueen la carga del sitio.
    - Se añadió protección con valores por defecto en `src/app/page.tsx` para la consulta de creadores destacados y fallback seguro de `displayName`.
    - Se añadió alerta visible en `src/lib/db/index.ts` ante la ausencia de `TURSO_DATABASE_URL` en producción.
  - **Configuración Google OAuth y Vercel**:
    - Documentadas las URIs de redireccionamiento requeridas para la consola de Google: `/api/auth/callback/google`.
    - Documentadas todas las variables de entorno obligatorias a cargar en el panel de Vercel (Turso, Auth.js, Google, Cloudflare R2).



