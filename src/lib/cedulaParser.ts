/**
 * Parser y Extractor de Cédulas de Identidad Venezolanas
 * Basado directamente en la lógica de código abierto de José Herrera:
 * https://github.com/jesymca/reconocimiento_cedula
 * Demo: https://jesymca.github.io/reconocimiento_cedula/
 * 
 * Extrae y normaliza:
 * - Número de cédula (V-XXXXXXXX o E-XXXXXXXX)
 * - Nombres y Apellidos
 * - Fecha de nacimiento (DD/MM/AAAA)
 * - Cálculo estricto de mayoría de edad (≥ 18 años)
 */

export interface ParsedVenezuelanId {
  cedula: string; // ej: "V-18452921"
  rawCedula: string; // ej: "18452921"
  nombres: string;
  apellidos: string;
  fullName: string;
  fechaNacimiento: string; // DD/MM/AAAA
  birthDateIso: string; // YYYY-MM-DD para guardar en la BD
  age: number | null;
  isAdult: boolean;
  estadoCivil?: string;
  nacionalidad?: string;
  sexo?: string;
  fechaExpedicion?: string;
  fechaVencimiento?: string;
}

// Distancia Levenshtein para coincidencia difusa de etiquetas OCR
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // eliminación
        dp[i][j - 1] + 1, // inserción
        dp[i - 1][j - 1] + cost // sustitución
      );
    }
  }
  return dp[m][n];
}

// Colapsar caracteres repetidos y normalizar para matching
export function normalizeLabel(s: string): string {
  return s.toUpperCase().replace(/(.)\1+/g, "$1").replace(/[^A-ZÁÉÍÓÚÑ]/g, "");
}

// Buscar el índice aproximado donde aparece una etiqueta en el texto
export function findLabelIndex(text: string, label: string): number {
  const letters = label.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
  const escaped = letters
    .split("")
    .map((c) => `[${c.toUpperCase()}${c.toLowerCase()}]`)
    .join("[\\s.]*");
  try {
    const re = new RegExp(escaped);
    const m = text.match(re);
    if (m && typeof m.index === "number") return m.index;
  } catch (e) {
    // Si falla el regex, continuar con fuzzy
  }

  const target = normalizeLabel(label);
  const tUpper = text.toUpperCase();
  for (let i = 0; i < tUpper.length; i++) {
    for (let w = Math.floor(target.length * 0.7); w <= target.length + 4; w++) {
      const sub = tUpper.substr(i, w).replace(/[^A-ZÁÉÍÓÚÑ]/g, "");
      if (!sub) continue;
      const subNorm = sub.replace(/(.)\1+/g, "$1");
      const d = levenshtein(subNorm, target);
      if (d <= Math.floor(target.length * 0.3)) return i;
    }
  }
  return -1;
}

// Limpiar nombres y apellidos retirando palabras clave y ruido OCR
export function cleanNames(str: string): string {
  let tokens = str
    .replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ\s]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length >= 2)
    .filter(
      (tok) =>
        !/^(REPUBLICA|BOLIVARIANA|VENEZUELA|IDENTIDAD|CEDULA|MINISTERIO|SAIME|DIRECTOR|GUSTAVO|VIZCAINO|VIZCAIN|TITULAR|FIRMA|NACIMIENTO|EXPEDICION|EXPEDICIÓN|VENCIMIENTO|EDO|CIVIL|NACIONALIDAD|SEXO)$/i.test(
          tok
        )
    );

  while (tokens.length > 0) {
    const last = tokens[tokens.length - 1];
    if (last.length <= 3 && /[a-záéíóúñ]/.test(last) && !/^[A-ZÁÉÍÓÚÑ]+$/.test(last)) {
      tokens.pop();
    } else break;
  }

  while (tokens.length > 0) {
    const first = tokens[0];
    if (first.length <= 3 && /[a-záéíóúñ]/.test(first) && !/^[A-ZÁÉÍÓÚÑ]+$/.test(first)) {
      tokens.shift();
    } else break;
  }

  return tokens.join(" ").trim();
}

function detectNameLabel(token: string): "apellidos" | "nombres" | null {
  const norm = normalizeLabel(token);
  if (norm.length < 4) return null;
  const ap = normalizeLabel("APELLIDOS");
  const no = normalizeLabel("NOMBRES");
  const dAp = levenshtein(norm, ap);
  const dNo = levenshtein(norm, no);
  const thrAp = Math.floor(ap.length * 0.4);
  const thrNo = Math.floor(no.length * 0.4);
  if (dAp <= thrAp && dAp <= dNo) return "apellidos";
  if (dNo <= thrNo) return "nombres";
  return null;
}

function nameLabelByPrefix(token: string): "apellidos" | "nombres" | null {
  if (!token || token.length < 3) return null;
  const firstChar = token[0].toUpperCase();
  if (firstChar === "A") return "apellidos";
  if (firstChar === "N" || firstChar === "O") return "nombres";
  return null;
}

function looksLikeNameLine(line: string): string | null {
  const cleaned = line.replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ\s]/g, " ").trim();
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return null;
  if (/\d{2}[\/\-.]\d{2}[\/\-.]\d{4}/.test(line)) return null;
  if (
    /(REPUBLICA|BOLIVARIANA|VENEZUELA|CEDULA|IDENTIDAD|NACIMIENTO|EXPEDICION|EXPEDICIÓN|VENCIMIENTO|EDO|CIVIL|NACIONALIDAD|SEXO|FIRMA|TITULAR|DIRECTOR|MINISTERIO|SAIME|GUSTAVO|VIZCAIN|N\s*CEDULA)/i.test(
      line
    )
  )
    return null;

  const properNouns = tokens.filter((t) => {
    const letters = t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, "");
    if (letters.length < 3) return false;
    const upper = letters.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length;
    return upper / letters.length >= 0.7;
  });

  return properNouns.length >= 1 ? properNouns.join(" ") : null;
}

/**
 * Función principal que procesa el texto OCR obtenido de la cédula
 */
export function parseVenezuelanId(rawText: string): ParsedVenezuelanId {
  if (!rawText) {
    return {
      cedula: "",
      rawCedula: "",
      nombres: "",
      apellidos: "",
      fullName: "",
      fechaNacimiento: "",
      birthDateIso: "",
      age: null,
      isAdult: false,
    };
  }

  const normalized = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const combinedText = normalized.join(" ");

  const result: ParsedVenezuelanId = {
    cedula: "",
    rawCedula: "",
    nombres: "",
    apellidos: "",
    fullName: "",
    fechaNacimiento: "",
    birthDateIso: "",
    age: null,
    isAdult: false,
  };

  // 1. Cédula
  const cedulaPatterns = [
    /\b([VEPvep])\s*[-.]?\s*(\d{1,2}(?:[.,]\d{3}){2})\b/,
    /\b([VEPvep])\s*[-.]?\s*(\d{6,8})\b/,
    /\b(\d{1,2}(?:[.,]\d{3}){2})\b/,
    /\b(\d{7,8})\b/,
  ];

  for (const re of cedulaPatterns) {
    const m = combinedText.match(re);
    if (m) {
      let prefix = "V";
      let num = "";
      if (m.length >= 3 && /^[VEPvep]$/i.test(m[1])) {
        prefix = m[1].toUpperCase();
        num = m[2];
      } else {
        num = m[1];
      }
      const digitsOnly = num.replace(/[.\-\s,]/g, "");
      if (digitsOnly.length >= 6 && digitsOnly.length <= 8) {
        result.rawCedula = digitsOnly;
        result.cedula = `${prefix}-${digitsOnly}`;
        break;
      }
    }
  }

  // 2. Apellidos y Nombres
  for (const line of normalized) {
    const tokens = line.split(/\s+/);
    if (tokens.length < 2) continue;
    const lbl = detectNameLabel(tokens[0]);
    if (lbl === "apellidos" && !result.apellidos) {
      result.apellidos = cleanNames(tokens.slice(1).join(" "));
    } else if (lbl === "nombres" && !result.nombres) {
      result.nombres = cleanNames(tokens.slice(1).join(" "));
    }
  }

  if (!result.apellidos || !result.nombres) {
    const cedulaLineIdx = normalized.findIndex(
      (l) =>
        /\b[VVEP]?\s*[-.]?\s*\d{1,2}[.,]\d{3}[.,]\d{3}\b/.test(l) ||
        /\b\d{1,2}\.\d{3}\.\d{3}\b/.test(l) ||
        /\b[VVEP]?\s*[-.]?\s*\d{7,8}\b/.test(l)
    );
    const startIdx = cedulaLineIdx >= 0 ? cedulaLineIdx + 1 : 0;
    const candidateNames: string[] = [];
    for (let i = startIdx; i < normalized.length && candidateNames.length < 2; i++) {
      const line = normalized[i];
      const nm = looksLikeNameLine(line);
      if (nm && !candidateNames.includes(nm)) {
        candidateNames.push(nm);
      }
    }
    if (!result.apellidos && candidateNames.length >= 1)
      result.apellidos = cleanNames(candidateNames[0]);
    if (!result.nombres && candidateNames.length >= 2)
      result.nombres = cleanNames(candidateNames[1]);
  }

  if (!result.apellidos || !result.nombres) {
    for (const line of normalized) {
      const tokens = line.split(/\s+/);
      if (tokens.length < 2) continue;
      const lbl = nameLabelByPrefix(tokens[0]);
      if (!lbl) continue;
      const rest = tokens.slice(1).join(" ");
      const cleanedRest = cleanNames(rest);
      if (!cleanedRest) continue;
      if (lbl === "apellidos" && !result.apellidos) result.apellidos = cleanedRest;
      else if (lbl === "nombres" && !result.nombres) result.nombres = cleanedRest;
    }
  }

  result.fullName = [result.nombres, result.apellidos].filter(Boolean).join(" ").trim();

  // 3. Fechas y Cálculo de Mayoría de Edad
  const dateFullRegex = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g;
  const fullDates: Array<{ raw: string; day: string; month: string; year: string; index: number }> =
    [];
  let m: RegExpExecArray | null;

  while ((m = dateFullRegex.exec(combinedText)) !== null) {
    fullDates.push({ raw: m[0], day: m[1], month: m[2], year: m[3], index: m.index });
  }

  const lblNacimiento = findLabelIndex(combinedText, "F. NACIMIENTO");
  let birthDate: { raw: string; day: string; month: string; year: string; index: number } | null =
    null;

  if (lblNacimiento >= 0) {
    let best = null;
    let bestDist = Infinity;
    for (const d of fullDates) {
      const dist = Math.abs(d.index - lblNacimiento);
      if (dist < bestDist && dist < 120) {
        best = d;
        bestDist = dist;
      }
    }
    birthDate = best;
  }

  if (!birthDate && fullDates.length > 0) {
    // Buscar la fecha cuyo año sea razonable para nacimiento (ej: entre 1940 y 2008)
    birthDate = fullDates.find((d) => {
      const y = parseInt(d.year);
      return y >= 1940 && y <= new Date().getFullYear();
    }) || fullDates[0];
  }

  if (birthDate) {
    const dStr = birthDate.day.padStart(2, "0");
    const mStr = birthDate.month.padStart(2, "0");
    const yStr = birthDate.year;

    result.fechaNacimiento = `${dStr}/${mStr}/${yStr}`;
    result.birthDateIso = `${yStr}-${mStr}-${dStr}`;

    // Calcular edad
    const birth = new Date(parseInt(yStr), parseInt(mStr) - 1, parseInt(dStr));
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    result.age = age;
    result.isAdult = age >= 18;
  }

  return result;
}
