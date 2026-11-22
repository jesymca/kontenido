/**
 * Parser y Extractor de Documentos de Identidad (Cédula Venezolana, ID Nacional y Pasaporte MRZ)
 * Basado en la lógica de código abierto de José Herrera:
 * https://github.com/jesymca/reconocimiento_cedula
 * Demo: https://jesymca.github.io/reconocimiento_cedula/
 *
 * Extrae y normaliza 100% desde la plataforma (sin APIs externas):
 * - Número de documento (Cédula V-/E-, Pasaporte o ID Nacional)
 * - Nombres y Apellidos
 * - Fecha de nacimiento (DD/MM/AAAA, AAAA-MM-DD, DD MMM AAAA y zona MRZ ICAO 9303)
 * - Verificación de dígito verificador ICAO para MRZ
 * - Detección de marcadores oficiales del documento
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
  mrzValid?: boolean;
  documentMarkersFound?: number;
  birthDateSource?: "MRZ" | "LABEL_MATCH" | "DATE_HEURISTIC" | "NONE";
}

export function calculateExactAge(birthDateIso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDateIso.trim());
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const birth = new Date(year, month - 1, day);
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day
  ) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
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
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
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
  } catch {
    // Si falla el regex, continuar con fuzzy
  }

  const target = normalizeLabel(label);
  const tUpper = text.toUpperCase();
  for (let i = 0; i < tUpper.length; i++) {
    for (let w = Math.floor(target.length * 0.7); w <= target.length + 4; w++) {
      const sub = tUpper.substring(i, i + w).replace(/[^A-ZÁÉÍÓÚÑ]/g, "");
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
  const tokens = str
    .replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ\s]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length >= 2)
    .filter(
      (tok) =>
        !/^(REPUBLICA|BOLIVARIANA|VENEZUELA|IDENTIDAD|CEDULA|MINISTERIO|SAIME|DIRECTOR|GUSTAVO|VIZCAINO|VIZCAIN|TITULAR|FIRMA|NACIMIENTO|EXPEDICION|EXPEDICIÓN|VENCIMIENTO|EDO|CIVIL|NACIONALIDAD|SEXO|PASAPORTE|PASSPORT|SURNAME|GIVEN|NAMES|BIRTH)$/i.test(
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
    /(REPUBLICA|BOLIVARIANA|VENEZUELA|CEDULA|IDENTIDAD|NACIMIENTO|EXPEDICION|EXPEDICIÓN|VENCIMIENTO|EDO|CIVIL|NACIONALIDAD|SEXO|FIRMA|TITULAR|DIRECTOR|MINISTERIO|SAIME|GUSTAVO|VIZCAIN|N\s*CEDULA|PASAPORTE|PASSPORT)/i.test(
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
 * Calcula el dígito verificador estándar ICAO 9303 (pesos 7, 3, 1 módulo 10)
 * usado en zonas legibles por máquina (MRZ) de pasaportes y documentos nacionales.
 */
function computeIcaoCheckDigit(field: string): number {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const ch = field[i];
    let val = 0;
    if (ch >= "0" && ch <= "9") {
      val = ch.charCodeAt(0) - 48;
    } else if (ch >= "A" && ch <= "Z") {
      val = ch.charCodeAt(0) - 55;
    }
    sum += val * weights[i % 3];
  }
  return sum % 10;
}

/**
 * Normaliza errores comunes de OCR en campos numéricos de MRZ (O->0, I/L->1, S->5, B->8)
 */
function fixMrzDigits(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/S/g, "5")
    .replace(/B/g, "8")
    .replace(/Z/g, "2");
}

function parseMrzZone(rawText: string): {
  birthDateIso?: string;
  documentNumber?: string;
  fullName?: string;
  mrzValid: boolean;
} {
  const lines = rawText
    .split("\n")
    .map((l) => l.replace(/\s+/g, "").toUpperCase())
    .filter((l) => l.length >= 24 && l.includes("<"));

  if (lines.length === 0) return { mrzValid: false };

  let fullName: string | undefined;
  let documentNumber: string | undefined;
  let birthDateIso: string | undefined;
  let mrzValid = false;

  // Extraer nombre de línea tipo P<VENAPELLIDO<<NOMBRE<SEGUNDO<<<<
  for (const line of lines) {
    if (/^[PIAC][A-Z<][A-Z<]{3}[A-Z]+<<[A-Z<]+/.test(line)) {
      const namePart = line.slice(5);
      const [surnamesRaw, givenRaw] = namePart.split("<<");
      const surnames = (surnamesRaw || "").replace(/<+/g, " ").trim();
      const given = (givenRaw || "").replace(/<+/g, " ").trim();
      const combined = [given, surnames].filter(Boolean).join(" ").trim();
      if (combined.length >= 4) {
        fullName = combined;
      }
    }
  }

  // Buscar patrón MRZ con fecha de nacimiento YYMMDD + dígito verificador + sexo (M/F/<) + fecha vencimiento YYMMDD + check digit
  for (const line of lines) {
    // TD3 (Pasaporte línea 2): 9-char doc + 1 check + 3-char nat + 6-char DOB + 1 check + 1 sex + 6-char exp + 1 check
    const td3Match = line.match(
      /([A-Z0-9<]{9})([0-9OILS])([A-Z<]{3})([0-9OILSBZ]{6})([0-9OILSBZ])([MF<])([0-9OILSBZ]{6})([0-9OILSBZ])/
    );
    if (td3Match) {
      const docRaw = td3Match[1].replace(/<+/g, "");
      const dobRaw = fixMrzDigits(td3Match[4]);
      const dobCheck = parseInt(fixMrzDigits(td3Match[5]), 10);
      if (/^\d{6}$/.test(dobRaw) && !isNaN(dobCheck)) {
        const expected = computeIcaoCheckDigit(dobRaw);
        if (expected === dobCheck) {
          const yy = parseInt(dobRaw.slice(0, 2), 10);
          const mm = parseInt(dobRaw.slice(2, 4), 10);
          const dd = parseInt(dobRaw.slice(4, 6), 10);
          const currentYy = new Date().getFullYear() % 100;
          const fullYear = yy > currentYy ? 1900 + yy : 2000 + yy;
          const candidateIso = `${fullYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
          const age = calculateExactAge(candidateIso);
          if (age !== null && age >= 0 && age <= 110) {
            birthDateIso = candidateIso;
            documentNumber = docRaw || undefined;
            mrzValid = true;
            break;
          }
        }
      }
    }

    // TD1 (ID Nacional línea 2): 6-char DOB + 1 check + 1 sex + 6-char exp + 1 check + 3-char nat
    const td1Match = line.match(
      /^([0-9OILSBZ]{6})([0-9OILSBZ])([MF<])([0-9OILSBZ]{6})([0-9OILSBZ])([A-Z<]{3})/
    );
    if (td1Match) {
      const dobRaw = fixMrzDigits(td1Match[1]);
      const dobCheck = parseInt(fixMrzDigits(td1Match[2]), 10);
      if (/^\d{6}$/.test(dobRaw) && !isNaN(dobCheck)) {
        if (computeIcaoCheckDigit(dobRaw) === dobCheck) {
          const yy = parseInt(dobRaw.slice(0, 2), 10);
          const mm = parseInt(dobRaw.slice(2, 4), 10);
          const dd = parseInt(dobRaw.slice(4, 6), 10);
          const currentYy = new Date().getFullYear() % 100;
          const fullYear = yy > currentYy ? 1900 + yy : 2000 + yy;
          const candidateIso = `${fullYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
          const age = calculateExactAge(candidateIso);
          if (age !== null && age >= 0 && age <= 110) {
            birthDateIso = candidateIso;
            mrzValid = true;
            break;
          }
        }
      }
    }
  }

  return { birthDateIso, documentNumber, fullName, mrzValid };
}

const MONTH_NAME_MAP: Record<string, string> = {
  ENE: "01", JAN: "01", ENERO: "01", JANUARY: "01",
  FEB: "02", FEBRERO: "02", FEBRUARY: "02", FEV: "02",
  MAR: "03", MARZO: "03", MARCH: "03",
  ABR: "04", APR: "04", ABRIL: "04", APRIL: "04",
  MAY: "05", MAYO: "05", MAI: "05",
  JUN: "06", JUNIO: "06", JUNE: "06",
  JUL: "07", JULIO: "07", JULY: "07",
  AGO: "08", AUG: "08", AGOSTO: "08", AUGUST: "08",
  SEP: "09", SEPT: "09", SET: "09", SEPTIEMBRE: "09", SEPTEMBER: "09",
  OCT: "10", OUT: "10", OCTUBRE: "10", OCTOBER: "10",
  NOV: "11", NOVIEMBRE: "11", NOVEMBER: "11",
  DIC: "12", DEC: "12", DEZ: "12", DICIEMBRE: "12", DECEMBER: "12",
};

function countDocumentMarkers(rawText: string): number {
  const normalized = rawText
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const markers = [
    /\bREPUBLICA\b/,
    /\bBOLIVARIANA\b/,
    /\bVENEZUELA\b/,
    /\bCEDULA\b/,
    /\bIDENTIDAD\b/,
    /\bSAIME\b/,
    /\bPASAPORTE\b|\bPASSPORT\b/,
    /\bNACIMIENTO\b|\bBIRTH\b|\bNASCIMENTO\b/,
    /\bEXPEDICION\b|\bEMISION\b|\bISSUE\b/,
    /\bVENCIMIENTO\b|\bEXPIRY\b|\bEXPIRATION\b/,
    /\bAPELLIDOS?\b|\bSURNAME\b/,
    /\bNOMBRES?\b|\bGIVEN\b/,
    /\bNACIONALIDAD\b|\bNATIONALITY\b/,
    /\bSEXO\b|\bSEX\b/,
    /\bDOCUMENTO\b|\bNACIONAL\b|\bIDENTITY\b/,
  ];

  let hits = 0;
  for (const re of markers) {
    if (re.test(normalized)) hits++;
  }
  return hits;
}

/**
 * Función principal que procesa el texto OCR obtenido de Cédula Venezolana,
 * Documento Nacional o Pasaporte Internacional.
 */
export function parseVenezuelanId(
  rawText: string,
  documentType: "CEDULA_VE" | "NATIONAL_ID" | "PASSPORT" = "CEDULA_VE"
): ParsedVenezuelanId {
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
      mrzValid: false,
      documentMarkersFound: 0,
      birthDateSource: "NONE",
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
    mrzValid: false,
    documentMarkersFound: countDocumentMarkers(rawText),
    birthDateSource: "NONE",
  };

  // 0. Prioridad máxima: Zona MRZ ICAO 9303 (Pasaportes y documentos nacionales con MRZ)
  const mrz = parseMrzZone(rawText);
  if (mrz.mrzValid) {
    result.mrzValid = true;
    if (mrz.documentNumber) {
      result.cedula = mrz.documentNumber;
      result.rawCedula = mrz.documentNumber;
    }
    if (mrz.fullName) {
      result.fullName = mrz.fullName;
    }
    if (mrz.birthDateIso) {
      const [y, m, d] = mrz.birthDateIso.split("-");
      result.birthDateIso = mrz.birthDateIso;
      result.fechaNacimiento = `${d}/${m}/${y}`;
      result.age = calculateExactAge(mrz.birthDateIso);
      result.isAdult = result.age !== null && result.age >= 18;
      result.birthDateSource = "MRZ";
    }
  }

  // 1. Número de Cédula / Documento / Pasaporte
  if (!result.cedula) {
    const cedulaPatterns =
      documentType === "CEDULA_VE"
        ? [
            /\b([VEPvep])\s*[-.]?\s*(\d{1,2}(?:[.,]\d{3}){2})\b/,
            /\b([VEPvep])\s*[-.]?\s*(\d{6,8})\b/,
            /\b(\d{1,2}(?:[.,]\d{3}){2})\b/,
            /\b(\d{7,8})\b/,
          ]
        : [
            /\b([A-Z]{1,3}\d{6,9})\b/,
            /\b([VEPvep])\s*[-.]?\s*(\d{6,10})\b/,
            /\b(\d{1,3}(?:[.,]\d{3}){2,3})\b/,
            /\b(\d{7,12})\b/,
          ];

    for (const re of cedulaPatterns) {
      const m = combinedText.match(re);
      if (m) {
        if (documentType === "CEDULA_VE") {
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
        } else {
          const rawVal = (m[2] ? `${m[1]}-${m[2]}` : m[1]).replace(/[.\s,]/g, "");
          if (rawVal.length >= 6 && rawVal.length <= 14) {
            result.rawCedula = rawVal;
            result.cedula = rawVal;
            break;
          }
        }
      }
    }
  }

  // 2. Apellidos y Nombres
  if (!result.fullName) {
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
  }

  // 3. Fechas y Cálculo de Mayoría de Edad (si no vino ya verificada desde MRZ)
  if (!result.birthDateIso) {
    const fullDates: Array<{
      raw: string;
      day: string;
      month: string;
      year: string;
      index: number;
    }> = [];

    // Patrón DD/MM/AAAA, DD-MM-AAAA, DD.MM.AAAA
    const dmyRegex = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g;
    let m: RegExpExecArray | null;
    while ((m = dmyRegex.exec(combinedText)) !== null) {
      const dayNum = parseInt(m[1], 10);
      const monthNum = parseInt(m[2], 10);
      const yearNum = parseInt(m[3], 10);
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1920 && yearNum <= new Date().getFullYear() + 20) {
        fullDates.push({ raw: m[0], day: m[1], month: m[2], year: m[3], index: m.index });
      }
    }

    // Patrón AAAA-MM-DD o AAAA/MM/DD
    const ymdRegex = /\b(19\d{2}|20\d{2})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g;
    while ((m = ymdRegex.exec(combinedText)) !== null) {
      const yearNum = parseInt(m[1], 10);
      const monthNum = parseInt(m[2], 10);
      const dayNum = parseInt(m[3], 10);
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
        fullDates.push({ raw: m[0], day: m[3], month: m[2], year: m[1], index: m.index });
      }
    }

    // Patrón textual (ej: 14 MAR 1996, 05 ENE 1999)
    const textMonthRegex = /\b(\d{1,2})[\s\-./]+([A-ZÁÉÍÓÚ]{3,10})[\s\-./]+(19\d{2}|20\d{2})\b/gi;
    while ((m = textMonthRegex.exec(combinedText)) !== null) {
      const monthCode = MONTH_NAME_MAP[m[2].toUpperCase()];
      const dayNum = parseInt(m[1], 10);
      if (monthCode && dayNum >= 1 && dayNum <= 31) {
        fullDates.push({ raw: m[0], day: m[1], month: monthCode, year: m[3], index: m.index });
      }
    }

    const birthLabels = [
      "F. NACIMIENTO",
      "FECHA DE NACIMIENTO",
      "NACIMIENTO",
      "DATE OF BIRTH",
      "BIRTH",
      "NASCIMENTO",
      "DOB",
    ];
    let lblNacimiento = -1;
    for (const lbl of birthLabels) {
      const idx = findLabelIndex(combinedText, lbl);
      if (idx >= 0) {
        lblNacimiento = idx;
        break;
      }
    }

    let birthDate: { raw: string; day: string; month: string; year: string; index: number } | null =
      null;

    if (lblNacimiento >= 0) {
      let best = null;
      let bestDist = Infinity;
      for (const d of fullDates) {
        const y = parseInt(d.year, 10);
        if (y > new Date().getFullYear()) continue; // Ignorar fechas de vencimiento futuras
        const dist = Math.abs(d.index - lblNacimiento);
        if (dist < bestDist && dist < 130) {
          best = d;
          bestDist = dist;
        }
      }
      if (best) {
        birthDate = best;
        result.birthDateSource = "LABEL_MATCH";
      }
    }

    if (!birthDate && fullDates.length > 0) {
      // Tomar la fecha más antigua válida (en una cédula/pasaporte: nacimiento < expedición < vencimiento)
      const plausibleBirthDates = fullDates
        .filter((d) => {
          const y = parseInt(d.year, 10);
          return y >= 1930 && y <= new Date().getFullYear() - 5;
        })
        .sort((a, b) => parseInt(a.year, 10) - parseInt(b.year, 10));

      birthDate = plausibleBirthDates[0] || fullDates[0];
      if (birthDate) {
        result.birthDateSource = "DATE_HEURISTIC";
      }
    }

    if (birthDate) {
      const dStr = birthDate.day.padStart(2, "0");
      const mStr = birthDate.month.padStart(2, "0");
      const yStr = birthDate.year;
      const iso = `${yStr}-${mStr}-${dStr}`;
      const age = calculateExactAge(iso);

      if (age !== null) {
        result.fechaNacimiento = `${dStr}/${mStr}/${yStr}`;
        result.birthDateIso = iso;
        result.age = age;
        result.isAdult = age >= 18;
      }
    }
  }

  return result;
}
