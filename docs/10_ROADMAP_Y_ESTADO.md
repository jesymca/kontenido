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
- [x] F15 — CRUD de Comisiones por Nivel en SUPER_ADMIN (`/admin/comisiones`), Enlace Ancla en `/panel/pagos`, Sincronización de Nivel VIP en `/cuenta`, Navbar de Suscripciones para Consumidores y Filtro Anti-Contacto Externo (DONE - 2026-11-08)
- [x] F16 — Cámara y Grabación WebRTC en Móvil y Escritorio (Trasera / Selfie) para Perfil, Banner, Publicaciones y KYC Cédula + Modal de Recorte Interactivo (DONE - 2026-11-09)
- [x] F17 — Algoritmo de Me Gusta (Corazón), Favoritos para Consumidores (`/cuenta/favoritos`), Estadísticas Intuitivas (Fotos/Videos/Precio) y Muestra Gratuita (Teaser Público) (DONE - 2026-11-09)
- [x] F18 — Transparencia de Inteligencia Artificial: Switch de Configuración de Creadora y Badge Oficial "CREADO CON IA" (DONE - 2026-11-09)
- [x] F19 — Optimización Integral de Metadatos SEO, Open Graph 1200x630 (WhatsApp, Telegram, Instagram, Twitter), Favicons PNG/ICO, Robots.txt, Sitemap.xml y PWA Manifest (DONE - 2026-11-09)
- [x] F20 — Corrección y Sincronización Estricta de Esquema en Turso para `/admin/usuarios` + Resiliencia con Fallback (DONE - 2026-11-09)

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
  - **Corrección Definitiva de Acceso a `/panel`, Sincronización JWT/DB y Menú Desplegado Global**:
    - Se eliminó en `src/middleware.ts` la redirección forzada de `/panel` hacia `/cuenta` que ocurría cuando la cookie JWT en el navegador conservaba un rol anterior (`CONSUMER`) previo a la actualización en Turso DB.
    - Se creó `src/app/panel/layout.tsx` para validar el rol directamente contra Turso DB en tiempo real y ofrecer activación en 1 clic a Creadora si una cuenta entró como Consumidor.
    - Se actualizaron los callbacks `jwt` y `session` en `src/auth.ts` para sincronizar en cada render el `id`, `username`, `role`, `kycStatus` y `level` desde Turso DB.
    - Se integró `CreatorPanelNav` de forma permanente dentro del `<header>` global en `src/components/Navbar.tsx` cuando el usuario es `CREATOR`, mostrando todo su menú de herramientas desplegado en cualquier página.
    - Se corrigió el botón *"Quiero Crear Contenido"* en `src/app/page.tsx` para que apunte siempre a `/panel` cuando hay sesión activa (en lugar de `/cuenta`).
  - **Edición en Tiempo Real de Nombre de Usuario (`username`) y Sugerencias Inteligentes**:
    - Se habilitó la edición del enlace del perfil (`kontenido.online/{username}`) en `src/components/ProfileForm.tsx` (`/panel/perfil`) y en `/registro` mediante el nuevo componente `src/components/UsernameAvailabilityInput.tsx`.
    - Se implementó `checkUsernameAvailabilityAction` en `src/actions/creator.ts` para verificar disponibilidad en tiempo real contra Turso DB y rutas reservadas del sistema.
    - Cuando el nombre está libre, el campo se ilumina en verde con el distintivo **`✓ Perfil Disponible`**.
    - Cuando el nombre ya está ocupado (o al pulsar *"Sugerir nombres"*), despliega automáticamente botones clicables con sugerencias verificadas y disponibles basadas en la propuesta del usuario (`@nombre_ve`, `@nombre_vip`, `@soy_nombre`, `@nombre_oficial`, etc.).

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
- **F15 — Comisiones por Nivel CRUD, Enlace a Métodos de Cobro, Sincronización de Niveles VIP, Navbar de Consumidores y Filtro Anti-Contacto Externo (DONE - 2026-11-08)**:
  - **CRUD de Comisiones para Creadoras por Tramo de Nivel en SUPER_ADMIN (`/admin/comisiones`)**:
    - Se creó la sección `/admin/comisiones` en el panel de `SUPER_ADMIN` (`src/app/admin/comisiones/page.tsx` y `src/components/AdminCommissionsCrud.tsx`) y se agregó al menú lateral (`src/app/admin/layout.tsx`).
    - Permite agregar, editar y eliminar tramos de comisión según el nivel de la creadora (ej: Nivel 0 al 30 = 20%, Nivel 31 al 60 = 15%, Nivel 61 al 100 = 10%) así como ajustar el nivel individual de cualquier creadora.
    - En `/panel/pagos` (`src/components/CreatorWithdrawalHub.tsx`), bajo *"Tu Comisión Actual"*, se despliega la escala completa de tramos por nivel, indicando el nivel actual de la creadora y en qué nivel exacto disminuye su porcentaje de comisión.
  - **Enlace Ancla Directo a Métodos de Cobro en `/panel/pagos`**:
    - En la sección *"Cuenta de Destino en Venezuela"* de `/panel/pagos`, se integró un enlace clicable (`#metodos-de-cobro`) tanto en el aviso cuando no hay cuentas configuradas como debajo del selector, llevando suavemente a la sección inferior *"Configuración de Métodos de Cobro (Venezuela y Cripto)"*.
  - **Sincronización Dinámica de Nivel de Inversor y Descargas VIP en `/cuenta`**:
    - Se eliminaron los textos estáticos (`Nivel 0 ($0)`, `Nivel 4 ($101+ Descargas VIP)`, `Nivel 100 ($4,900+)`) en `src/app/cuenta/page.tsx` y se sincronizaron directamente con la tabla `user_levels` de Turso DB administrada desde `/admin/niveles` (detectando dinámicamente el primer nivel con `canDownload === 1` y su monto `minSpentUsd`).
  - **Navbar de Suscripciones para Consumidores (`ConsumerPanelNav`) y Vista `/cuenta/suscripciones`**:
    - Se creó `src/components/ConsumerPanelNav.tsx` integrado en el `<header>` global (`src/components/Navbar.tsx`) para todos los usuarios con rol `CONSUMER`, mostrando accesos a *Explorar Creadoras*, *Mis Suscripciones*, *Billetera y VIP*, *Mensajes Privados* y píldoras directas con cada creadora a la que está suscrito para ir a ver su contenido en 1 clic.
    - Se creó la página `/cuenta/suscripciones` (`src/app/cuenta/suscripciones/page.tsx`) con tarjetas detalladas de todos los perfiles suscritos.
  - **Filtro Anti-Contacto Externo para Creadoras y Consumidores (`src/lib/contentFilter.ts`)**:
    - Bloquea en servidor (`src/actions/creator.ts`) y cliente (`ProfileForm.tsx`, `SocialPostComposer.tsx`, `CreatorChatRoom.tsx`) la publicación o envío de números telefónicos (nacionales 0412/0414/0424/0416/0426 e internacionales), correos electrónicos (estándar u ofuscados), enlaces externos y menciones a WhatsApp, Telegram, Instagram, TikTok, Zelle o PayPal.
- **F16 — Cámara y Grabación WebRTC en Móvil y Escritorio (Trasera / Selfie) para Perfil, Banner, Publicaciones y KYC Cédula + Modal de Recorte Interactivo (DONE - 2026-11-09)**:
  - **Componente Universal de Cámara WebRTC (`src/components/MediaCaptureModal.tsx`)**:
    - Utiliza la API nativa `navigator.mediaDevices.getUserMedia` para permitir acceso directo a la cámara desde celulares (Android / iOS) y computadoras.
    - Soporte completo para alternar con un botón entre **Cámara Trasera** (`facingMode: "environment"`) y **Cámara Frontal / Selfie** (`facingMode: "user"` con efecto espejo natural).
    - Permite captura de **Fotos instantáneas** (canvas con resolución nativa de cámara) y **Grabación de Video** con temporizador en vivo (`formatTimer`), botón de detener, vista previa interactiva antes de confirmar y reintentar si se desea.
  - **Integración en Perfil y Banner (`src/components/ProfileForm.tsx`)**:
    - Se agregaron botones de "Usar Cámara" tanto para la Foto de Perfil / Avatar (priorizando cámara Frontal / Selfie) como para la Foto de Portada / Banner (priorizando cámara Trasera).
    - Las fotos capturadas o seleccionadas de la galería pasan por el modal interactivo de recorte (`src/components/ImageCropModal.tsx`) permitiendo arrastrar, ajustar zoom y encuadrar la parte superior deseada de la imagen antes de subir a R2.
  - **Integración en Creador de Publicaciones (`src/components/SocialPostComposer.tsx`)**:
    - Se agregó el botón *"Usar Cámara (Foto o Video)"* junto a la subida de archivos de galería.
    - Las creadoras pueden tomarse fotos o grabarse en video directamente desde el teléfono y agregarlos al post.
  - **Integración en Escáner KYC de Cédula y Selfie (`src/components/CedulaOcrScanner.tsx`)**:
    - Opciones de cámara en los 3 pasos de validación: Cédula Frente (Cámara trasera para OCR automático con Tesseract.js), Cédula Reverso y Selfie con Cédula en Mano (Cámara frontal / selfie).
- **F17 — Algoritmo de Me Gusta (Corazón), Favoritos para Consumidores, Métricas Intuitivas de Contenido y Muestra Gratuita (DONE - 2026-11-09)**:
  - **Algoritmo de Posicionamiento por "Me Gusta" (Likes)**:
    - Tablas `profile_likes` y columna `profiles.likes_count` para ordenar los perfiles de mayor a menor popularidad.
    - En la Landing Page (`src/app/page.tsx`), las creadoras se posicionan según su volumen de likes (`orderBy(desc(profiles.likesCount), desc(users.level))`).
    - Componente interactivo [`ProfileInteractions.tsx`](file:///home/herrera/Descargas/kontenido/src/components/ProfileInteractions.tsx) con botón de corazón y animación inmediata para dar y quitar Me Gusta.
  - **Módulo de Favoritos para Consumidores**:
    - Tabla `profile_favorites` y server actions en [`src/actions/interactions.ts`](file:///home/herrera/Descargas/kontenido/src/actions/interactions.ts).
    - Botón de "Favorito" en el perfil público para que los consumidores guarden a las creadoras que les interesan.
    - Nueva vista dedicada [`/cuenta/favoritos`](file:///home/herrera/Descargas/kontenido/src/app/cuenta/favoritos/page.tsx) accesible desde la barra superior [`ConsumerPanelNav.tsx`](file:///home/herrera/Descargas/kontenido/src/components/ConsumerPanelNav.tsx) y desde `/cuenta`, con tarjetas interactivas de cada creadora guardada y acceso directo para suscribirse.
  - **Métricas Intuitivas de Contenido (Fotos, Videos y Precio)**:
    - En la cabecera de `/[username]`, en las tarjetas de la Landing Page y en `/cuenta/favoritos` se despliega de forma clara y visual:
      - 📷 **Cantidad exacta de Fotos**.
      - 🎥 **Cantidad exacta de Videos**.
      - 💎 **Precio mensual en KOIN / mes**.
      - ❤️ **Total de Me Gusta acumulados**.
  - **Publicaciones de Muestra Gratuita (Públicas / Teaser)**:
    - En [`SocialPostComposer.tsx`](file:///home/herrera/Descargas/kontenido/src/components/SocialPostComposer.tsx) las creadoras cuentan con un selector de 3 modos:
      1. 🔓 **Muestra Gratuita (Público)**: Visible para cualquier visitante sin necesidad de estar suscrito (ideal para enganchar y captar nuevos clientes).
      2. 👑 **Solo Suscriptores**: Exclusivo para miembros suscritos.
      3. 💎 **Pago por Ver (PPV)**: Desbloqueable individualmente por X KOIN.
    - En `/[username]`, los posts marcados como muestra gratuita se muestran desbloqueados con el distintivo `🔓 Muestra Gratuita (Público)`.
- **F18 — Transparencia de Inteligencia Artificial: Switch de Configuración y Badge "CREADO CON IA" (DONE - 2026-11-09)**:
  - **Base de Datos y Migración**:
    - Se agregó el campo `is_ai_generated` (`integer not null default 0`) en la tabla `profiles` de `src/lib/db/schema.ts` y script auto-migratorio en `src/lib/db/initInteractions.ts`.
  - **Switch en Configuración de Perfil (`src/components/ProfileForm.tsx` y `src/actions/creator.ts`)**:
    - Sección *"6. IDENTIFICACIÓN DE CONTENIDO CREADO POR INTELIGENCIA ARTIFICIAL (IA)"* con switch moderno y etiqueta de *Transparencia IA*, permitiendo al creador declarar si su contenido o modelo es generado/asistido con IA.
  - **Badge y Banner Oficial en Perfil Público (`src/components/UserLevelBadge.tsx` y `src/app/[username]/page.tsx`)**:
    - Distintivo neón pulsante `[🤖 CREADO CON IA]` incorporado en `UserLevelBadge.tsx`, visible en la cabecera de perfil, tarjetas de inicio (`/`) y lista de favoritos (`/cuenta/favoritos`).
    - Banner informativo de transparencia en la parte superior del perfil público para que los consumidores conozcan con claridad el origen del material.
- **F19 — Optimización Integral de Metadatos SEO, Open Graph 1200x630 (WhatsApp, Telegram, Twitter, Instagram), Favicons PNG/ICO, Robots.txt, Sitemap.xml y PWA Manifest (DONE - 2026-11-09)**:
  - **Generación de Assets de Imagen Multiformato con Sharp**:
    - `public/og-image.png` y `public/opengraph-image.png` (1200x630): Banner oficial de alta resolución con fondo oscuro elegante, viñeta lumínica fucsia/azul, logo centrado, eslogan *"Tus fotos y videos en 1 solo clic"*, píldoras de PagoMóvil, KOIN 1:1 USDT y Binance Pay.
    - Favicons ráster PNG requeridos por WhatsApp, Telegram, Apple iOS y Android: `favicon.ico` (48x48), `favicon-32x32.png`, `favicon-16x16.png`, `apple-touch-icon.png` (180x180), `icon-192.png` e `icon-512.png`.
  - **Metadatos Globales en Root Layout (`src/app/layout.tsx`)**:
    - `metadataBase` configurada con fallback a `https://kontenido.online`.
    - Etiquetas `openGraph` (locale `es_VE`, type `website`, image 1200x630) y `twitter` (`summary_large_image`).
    - Configuración exhaustiva de `keywords`, `authors`, `creator`, `publisher`, `robots` (max-image-preview large) y `alternates` canonical.
  - **Metadatos Dinámicos por Perfil de Creadora (`src/app/[username]/page.tsx`)**:
    - Función `generateMetadata({ params })` que consulta la base de datos y genera una tarjeta Open Graph personalizada con el nombre, biografía, precio en KOIN y la foto real del avatar o banner de la creadora al compartir su enlace en WhatsApp o Telegram.
  - **SEO y Descubrimiento Técnico (`src/app/robots.ts`, `src/app/sitemap.ts`, `public/manifest.json`)**:
    - `robots.txt`: Reglas optimizadas para Googlebot, Bingbot y bots de redes sociales (WhatsApp, TelegramBot, Twitterbot, facebookexternalhit, LinkedInBot, Slackbot, Applebot).
    - `sitemap.xml`: Generación dinámica en tiempo real que lista la landing page, registro, login y todas las URLs de creadores activos (`https://kontenido.online/[username]`).
    - `manifest.json`: Web App Manifest PWA con iconos adaptativos y colores de tema oficial.
- **F20 — Corrección y Sincronización Estricta de Esquema en Turso para `/admin/usuarios` (DONE - 2026-11-09)**:
  - **Diagnóstico del Error 500 (`A server error occurred`)**:
    - Al consultar `/admin/usuarios`, Drizzle ORM ejecutaba `findMany` con relaciones `with: { profile: true, posts: { with: { media: true } } }`.
    - La base de datos remota de Turso no tenía aplicadas aún las nuevas columnas añadidas en el código TypeScript (`likes_count` e `is_ai_generated` en `profiles`, e `is_public_teaser` en `posts`), ni las tablas `profile_likes` y `profile_favorites`, provocando la excepción fatal de LibSQL `SQLITE_ERROR: no such column`.
  - **Acciones Correctivas**:
    - Se ejecutó la migración directa con LibSQL sobre Turso creando las tablas faltantes y ejecutando los `ALTER TABLE` para `likes_count`, `is_ai_generated` e `is_public_teaser`, junto a sus índices correspondientes.
    - Se protegió `src/app/admin/usuarios/page.tsx` con manejo de errores `try / catch` resiliente y llamada proactiva a `ensureInteractionsSchema()`, evitando que cualquier anomalía de red o consulta tumbe la pantalla completa.
    - Se verificó la consulta en vivo retornando los usuarios exitosamente.








