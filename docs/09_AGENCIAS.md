# Plataforma de atención a AGENCIAS

## Rol AGENCY
- Registro independiente en `/registro` seleccionando **"Soy una Agencia"** (o inicialización desde `/agencia`).
- Puede crear y publicar múltiples perfiles de creadoras de contenido desde `/agencia`, aplicando exactamente las mismas reglas y condiciones que las creadoras individuales (incluyendo categoría: Mujer, Hombre, Pareja o Transexual).
- Panel `/agencia`:
  - Listado de perfiles administrados + métricas consolidadas (ingresos en KOIN, tarifa de suscripción, tarifa de chat, publicaciones).
  - Configuración de la Agencia y del **Badge llamativo** (`badgeText`, `badgeColor`, `showBadge`) que se muestra en todos los perfiles de la agencia y en el catálogo principal.
  - Gestión integral por perfil en `/agencia/creadoras/[id]`, reutilizando las herramientas de creadora sin duplicar lógica (`resolveCreatorTarget`):
    - Edición de perfil y categoría (`ProfileForm`).
    - Publicación y eliminación con respaldo de contenido (`SocialPostComposer`, `DeletePostButton`).
    - Gestión de planes de suscripción (`CreatorPlansManager`).
    - Administración de mensajería privada, packs multimedia PPV/gratuitos y tarifa/tiempo de acceso al chat (`CreatorChatRoom`).

## Reglas
- Comisión de agencia configurable (`agencies.commission_pct`), descontada del payout del creador y acreditada a la agencia en su propio corte semanal.
- Un creador solo puede pertenecer a 1 agencia (`agency_creators`).
- `SUPER_ADMIN` puede aprobar/suspender agencias.
