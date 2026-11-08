/**
 * Módulo de Seguridad Anti-Fuga y Filtro de Contacto Externo (KONTENIDO)
 *
 * Bloquea estrictamente la publicación o envío de:
 * 1. Números de teléfono (formatos de Venezuela 0412/0414/0424/0416/0426/+58 e internacionales, incluso separados por espacios o guiones)
 * 2. Direcciones de correo electrónico (estándar u ofuscadas con "arroba", "gmail", "hotmail", etc.)
 * 3. Enlaces web externos y redes/mensajería fuera de la plataforma (WhatsApp, Telegram, Instagram, TikTok, etc.)
 *
 * Aplica tanto a Creadoras de Contenido (biografía, títulos, descripciones, planes, chat)
 * como a Consumidores (mensajería privada).
 */

export interface ContentValidationResult {
  valid: boolean;
  error?: string;
  reason?: string;
  detectedType?: "PHONE" | "EMAIL" | "EXTERNAL_LINK" | "EXTERNAL_APP";
}

// 1. Correos electrónicos estándar y ofuscados
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+\s*(?:@|\[at\]|\(at\)|arroba)\s*[a-zA-Z0-9.-]+\s*(?:\.|dot|punto)\s*[a-zA-Z]{2,}/i;
const EMAIL_DOMAINS_REGEX = /\b(?:gmail\.com|hotmail\.com|outlook\.com|yahoo\.com|icloud\.com|protonmail\.com|live\.com)\b/i;

// 2. Números de teléfono venezolanos (+58, 0412, 0414, 0424, 0416, 0426, 0212) o secuencias de >= 7 dígitos
const VE_PHONE_PREFIX_REGEX = /(?:\+?58|0)\s*[-.]?\s*(?:412|414|424|416|426|212)\s*[-.]?\s*\d{3}\s*[-.]?\s*\d{2,4}/i;
const GENERIC_PHONE_SEQUENCE_REGEX = /(?:\b|\+)(\d[\s.-]*){7,15}\b/;

// 3. Enlaces web externos (permitiendo únicamente menciones a kontenido.online si existieran)
const EXTERNAL_URL_REGEX = /(?:https?:\/\/|www\.)(?!([a-z0-9-]+\.)*kontenido\.online)[^\s]+/i;

// 4. Plataformas externas de mensajería, redes sociales o pagos directos por fuera
const EXTERNAL_PLATFORM_REGEX = /\b(?:whatsapp|wasap|wsp|wa\.me|telegram|t\.me|instagram|insta|tiktok|onlyfans|fansly|facebook|fb\.com|zelle|zinli|paypal|escr[ií]beme\s+al\s+privado\s+de|mi\s+n[uú]mero|mi\s+tel[eé]fono|mi\s+celular|mi\s+whatsapp|mi\s+telegram|cont[aá]ctame\s+fuera)\b/i;

/**
 * Valida que un texto (biografía, post, título, mensaje de chat, plan) no contenga
 * números telefónicos, correos electrónicos ni intentos de contacto fuera de KONTENIDO.
 */
export function validateNoExternalContact(
  text: string | null | undefined,
  fieldLabel?: string
): ContentValidationResult {
  if (!text || !text.trim()) {
    return { valid: true };
  }

  const normalized = text.trim();
  const prefix = fieldLabel ? `${fieldLabel}: ` : "";

  // Verificar correos electrónicos
  if (EMAIL_REGEX.test(normalized) || EMAIL_DOMAINS_REGEX.test(normalized)) {
    const msg = `🚫 ${prefix}Por seguridad, no está permitido publicar direcciones de correo electrónico ni intentar comunicarse fuera de KONTENIDO.`;
    return {
      valid: false,
      detectedType: "EMAIL",
      error: msg,
      reason: msg,
    };
  }

  // Verificar números de teléfono venezolanos o secuencias numéricas de contacto
  if (VE_PHONE_PREFIX_REGEX.test(normalized) || GENERIC_PHONE_SEQUENCE_REGEX.test(normalized)) {
    const msg = `🚫 ${prefix}Por seguridad, no está permitido publicar números de teléfono ni datos de contacto telefónico dentro de la plataforma.`;
    return {
      valid: false,
      detectedType: "PHONE",
      error: msg,
      reason: msg,
    };
  }

  // Verificar enlaces externos
  if (EXTERNAL_URL_REGEX.test(normalized)) {
    const msg = `🚫 ${prefix}No está permitido incluir enlaces web externos en publicaciones, perfiles o mensajes.`;
    return {
      valid: false,
      detectedType: "EXTERNAL_LINK",
      error: msg,
      reason: msg,
    };
  }

  // Verificar menciones a WhatsApp, Telegram u otras apps externas
  if (EXTERNAL_PLATFORM_REGEX.test(normalized)) {
    const msg = `🚫 ${prefix}No está permitido compartir cuentas de WhatsApp, Telegram, redes externas ni solicitar contacto fuera de KONTENIDO.`;
    return {
      valid: false,
      detectedType: "EXTERNAL_APP",
      error: msg,
      reason: msg,
    };
  }

  return { valid: true };
}
