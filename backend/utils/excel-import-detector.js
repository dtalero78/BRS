/**
 * Header-aware Excel layout detector for BRS imports.
 *
 * Input files vary wildly between companies: different column orders,
 * extra metadata columns, filter-question columns interleaved with items,
 * and values written as text labels ("Siempre", "Casi nunca") or numeric
 * 0-4 scales. This module inspects the header row and emits a layout
 * that maps semantic fields to column indexes so the importer doesn't
 * depend on fixed positions.
 */

const SOCIO_PATTERNS = [
  ['documento',        /n(ú|u)mero de identificaci(ó|o)n|documento de identidad|^c(é|e)dula|\bcc\b/i],
  ['nombre',           /nombre completo|nombres y apellidos|^\s*nombre\s*$|^\s*nombres?\s*$/i],
  ['fecha',            /fecha de aplicaci(ó|o)n/i],
  ['empresa',          /^\s*empresa\s*$/i],
  ['sexo',             /^[\d\.\s]*sexo\b|^\s*g(é|e)nero\s*$/i],
  ['birthYear',        /a(ñ|n)o de nacimiento|fecha de nacimiento/i],
  ['maritalStatus',    /estado civil/i],
  ['education',        /(ú|u)ltimo nivel de estudios|nivel educativo|nivel de estudios/i],
  ['ocupacion',        /ocupaci(ó|o)n o profesi(ó|o)n/i],
  ['ciudadResidencia', /lugar de residencia.*ciudad|ciudad de residencia/i],
  ['deptoResidencia',  /lugar de residencia.*departamento|departamento de residencia/i],
  ['estrato',          /estrato/i],
  ['tipoVivienda',     /tipo de vivienda/i],
  ['dependientes',     /personas que dependen|n(ú|u)mero de dependientes/i],
  ['ciudadTrabajo',    /lugar donde trabaja.*ciudad|ciudad donde trabaja/i],
  ['deptoTrabajo',     /lugar donde trabaja.*departamento|departamento donde trabaja/i],
  ['anosEmpresa',      /cu(á|a)ntos a(ñ|n)os.*trabaja en esta empresa|antig(ü|u)edad.*empresa/i],
  ['cargo',            /nombre del cargo|^\s*cargo\s*$|puesto de trabajo/i],
  ['tipoCargo',        /tipo de cargo/i],
  ['anosCargo',        /a(ñ|n)os que desempe(ñ|n)a|antig(ü|u)edad.*cargo/i],
  ['departamento',     /nombre del departamento|(á|a)rea o secci(ó|o)n|departamento.*empresa/i],
  ['tipoContrato',     /tipo de contrato/i],
  ['horasTrabajo',     /horas.*trabajo|horas diarias|jornada/i],
  ['tipoSalario',      /tipo de salario/i],
];

const FILTER_PATTERNS = [
  /soy jefe de otras personas/i,
  /relacionadas con la atenci(ó|o)n a clientes y usuarios/i,
];

const SECTION_EXTRA = /condiciones de la zona donde usted vive|vida fuera del trabajo|varias condiciones de la zona/i;
const SECTION_STRESS = /frecuencia con que se le han presentado.*malestares|se(ñ|n)ale la casilla.*frecuencia/i;

/**
 * Parse row 0 (and optionally others) for literal section labels such as
 * "SOCIODEMOGRÁFICO", "INTRALABORAL", "EXTRALABORAL", "ESTRÉS". Some
 * formats keep these as merged-cell banners above the item columns and
 * rely on them — rather than per-cell keywords — to indicate sections.
 */
function detectSectionBanners(data, headerRow) {
  const boundaries = {};
  const rowsToScan = new Set([0, headerRow].filter(r => r >= 0 && r < data.length));
  for (const r of rowsToScan) {
    const row = data[r];
    if (!row) continue;
    row.forEach((cell, i) => {
      if (cell == null || cell === '') return;
      const s = String(cell).trim();
      if (/^sociodemogr(á|a)fico/i.test(s))      boundaries[i] = 'socio';
      else if (/^intralaboral/i.test(s))         boundaries[i] = 'intra';
      else if (/^extralaboral/i.test(s))         boundaries[i] = 'extra';
      else if (/^estr(é|e)s/i.test(s))           boundaries[i] = 'stress';
      else if (/^ghq/i.test(s))                  boundaries[i] = 'ghq';
    });
  }
  return boundaries;
}

function sectionAtCol(boundaries, col) {
  let current = null;
  const keys = Object.keys(boundaries).map(Number).sort((a, b) => a - b);
  for (const k of keys) {
    if (k <= col) current = boundaries[k];
    else break;
  }
  return current;
}

/**
 * Locate the header row. Falls back to the first non-empty row if no
 * known markers are found.
 */
function findHeaderRow(data) {
  const headerKeywords = /documento|n(ú|u)mero de identificaci|nombre completo|sexo|estado civil|(ú|u)ltimo nivel|tipo de cargo|tipo de contrato|fecha de aplicaci|condiciones ambientales|frecuencia con que/i;
  let bestRow = 0;
  let bestScore = -1;
  const maxScan = Math.min(4, data.length);
  for (let r = 0; r < maxScan; r++) {
    const row = data[r];
    if (!row) continue;
    let score = 0;
    for (const cell of row) {
      if (cell == null || cell === '') continue;
      if (typeof cell !== 'string' && typeof cell !== 'number') continue;
      if (headerKeywords.test(String(cell))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestScore > 0 ? bestRow : 0;
}

/**
 * Extract an item number from a questionnaire header. Supports:
 *   "1"                                       -> 1   (fundacion format, bare number)
 *   "1. Nombre completo"                      -> 1   (sociodemographic style)
 *   "Las siguientes preguntas...1. El ruido"  -> 1   (embedded after double dots)
 *   "..114. Mi trabajo me exige atender"      -> 114
 *   "..10 En mi trabajo"                      -> 10  (typo: missing period after number)
 *   "7.1. Lugar de residencia"                -> null (decimal sub-item — not counted)
 */
function extractItemNumber(header) {
  if (header == null || header === '') return null;
  const s = String(header).trim();

  // 1) Bare numeric header (legacy format where row 1 is just item numbers)
  if (/^\d{1,3}$/.test(s)) return parseInt(s, 10);

  // 2) "N. text" or "N text" at start — sociodemographic numbering.
  //    Reject decimals (e.g. "7.1. text") by requiring whitespace, not digit, after the period.
  const startMatch = s.match(/^(\d{1,3})\.?\s+\S/);
  if (startMatch && !/^\d+\.\d/.test(s)) return parseInt(startMatch[1], 10);

  // 3) Embedded item number inside a questionnaire prompt.
  //    The preceding character must be a dot *not* following a digit — this
  //    admits both ".N." (real item) and "..N" (missing-trailing-dot typo)
  //    while rejecting decimal subitems like "7.1.".
  const embeddedMatch = s.match(/(?<!\d)\.+\s*(\d{1,3})\.?\s+[A-Za-zÁÉÍÓÚáéíóúñÑ¿]/);
  if (embeddedMatch) return parseInt(embeddedMatch[1], 10);

  return null;
}

function isFilterHeader(header) {
  if (!header) return false;
  const s = String(header);
  // Filter columns have filter text AND do NOT contain an item number
  if (!FILTER_PATTERNS.some(p => p.test(s))) return false;
  return extractItemNumber(s) === null;
}

/**
 * Determine which questionnaire section a column belongs to based on
 * keywords in the header. Returns 'stress', 'extra', or null (= intra).
 */
function classifySection(header) {
  if (!header) return null;
  const s = String(header);
  if (SECTION_STRESS.test(s)) return 'stress';
  if (SECTION_EXTRA.test(s)) return 'extra';
  return null;
}

/**
 * Build the layout from the header row.
 *
 * Uses section banners from row 0 when available (fundacion format,
 * where item headers are just numbers without context). Falls back
 * to per-header keyword classification otherwise.
 *
 * Returns:
 *   {
 *     socio: { documento: 4, nombre: 5, sexo: 6, ... },
 *     intra: { 1: 26, 2: 27, ... 123: 150 },
 *     extra: { 1: 151, ..., 31: 181 },
 *     stress: { 1: 182, ..., 31: 212 },
 *     filterCols: [132, 141],
 *     warnings: [...]
 *   }
 */
function detectLayout(headers, sectionBanners = {}) {
  const layout = {
    socio: {},
    intra: {},
    extra: {},
    stress: {},
    filterCols: [],
    warnings: [],
  };

  // Pre-classify each column once so we don't re-evaluate filter / item /
  // banner state in every pass.
  const cells = headers.map((rawHeader, i) => {
    if (rawHeader == null || rawHeader === '') return null;
    const text = String(rawHeader);
    if (isFilterHeader(text)) {
      layout.filterCols.push(i);
      return null;
    }
    return {
      i,
      text,
      itemNum: extractItemNumber(text),
      bannerSection: sectionAtCol(sectionBanners, i),
      // Headers like "13. ¿Cuál es el nombre del cargo?" carry a leading
      // question number and belong to the official sociodemographic form.
      // Plain metadata columns like "PUESTO DE TRABAJO" do not.
      hasSocioQuestionPrefix: /^\s*\d{1,2}\.?\s+\S/.test(text) && !/^\d+\.\d/.test(text),
    };
  });

  // Pass 1: assign socio fields where the header is the official
  // sociodemographic question (has "N." prefix). This ensures the question
  // wins over loose metadata aliases like "PUESTO DE TRABAJO".
  for (const c of cells) {
    if (!c) continue;
    if (!c.hasSocioQuestionPrefix) continue;
    if (c.bannerSection && c.bannerSection !== 'socio') continue;
    for (const [field, pattern] of SOCIO_PATTERNS) {
      if (layout.socio[field] === undefined && pattern.test(c.text)) {
        layout.socio[field] = c.i;
        c.assigned = 'socio';
        break;
      }
    }
  }

  // Pass 2: fill remaining socio fields using any matching header
  // (metadata columns, free-text labels, etc.).
  for (const c of cells) {
    if (!c || c.assigned) continue;
    if (c.bannerSection && c.bannerSection !== 'socio') continue;
    for (const [field, pattern] of SOCIO_PATTERNS) {
      if (layout.socio[field] === undefined && pattern.test(c.text)) {
        layout.socio[field] = c.i;
        c.assigned = 'socio';
        break;
      }
    }
  }

  // Pass 3: assign questionnaire items. Skip cols already used for socio.
  for (const c of cells) {
    if (!c || c.assigned) continue;
    if (c.itemNum === null) continue;

    let section = c.bannerSection;
    if (section === 'socio' || section === null) {
      section = classifySection(c.text);
    }
    if (section === 'ghq') continue;

    const targetMap = section === 'stress' ? layout.stress
                    : section === 'extra'  ? layout.extra
                    : layout.intra;

    if (targetMap[c.itemNum] === undefined) {
      targetMap[c.itemNum] = c.i;
    }
  }

  // Emit warnings for missing critical fields
  const critical = ['documento', 'nombre'];
  for (const f of critical) {
    if (layout.socio[f] === undefined) {
      layout.warnings.push(`No se encontró columna para el campo requerido: ${f}`);
    }
  }

  return layout;
}

const INTRA_TEXT_MAP = {
  'siempre': 4,
  'casi siempre': 3,
  'algunas veces': 2,
  'a veces': 2,
  'casi nunca': 1,
  'nunca': 0,
};

const STRESS_TEXT_MAP = {
  'siempre': 3,
  'casi siempre': 2,
  'a veces': 1,
  'algunas veces': 1,
  'nunca': 0,
};

/**
 * Convert a raw Excel cell to a BRS numeric response value.
 *
 * Accepts:
 *   - Numbers 0-maxVal. Su interpretación depende de numericScale:
 *       'inverted' (default, formato oficial del Ministerio): el Excel trae
 *          Siempre=0..Nunca=maxVal → se invierte a la escala BRS (Siempre=maxVal).
 *       'direct': el Excel ya viene en escala BRS (Siempre=maxVal) → se toma tal cual.
 *     Los números 0-4 no permiten auto-detectar la dirección; por eso es explícita.
 *   - Text labels: "Siempre", "Casi siempre", ... → mapean a la escala BRS
 *     directamente (no dependen de numericScale, son inequívocos).
 *
 * scale: 'intra' (0-4) o 'stress' (0-3)
 * numericScale: 'inverted' (default) | 'direct'
 */
function parseResponseValue(val, scale, numericScale = 'inverted') {
  if (val === undefined || val === null || val === '') return null;
  const maxVal = scale === 'stress' ? 3 : 4;

  const toBrs = (n) => {
    if (!Number.isFinite(n) || n < 0 || n > maxVal) return null;
    return numericScale === 'direct' ? n : maxVal - n;
  };

  if (typeof val === 'number') return toBrs(val);

  const s = String(val).trim();
  if (s === '') return null;

  // Pure numeric string like "2" or "4"
  if (/^\d+$/.test(s)) return toBrs(parseInt(s, 10));

  const lower = s.toLowerCase().replace(/\s+/g, ' ');
  const map = scale === 'stress' ? STRESS_TEXT_MAP : INTRA_TEXT_MAP;
  return map[lower] !== undefined ? map[lower] : null;
}

/**
 * Best-effort year extraction from a heterogeneous cell. Handles:
 *   - 4-digit year: 1977
 *   - Date strings: "03/06/1978", "1978-06-03"
 *   - Excel date serials: 28553 (numeric days since 1900)
 */
function parseExcelYear(val) {
  if (val == null || val === '') return null;

  if (typeof val === 'number') {
    // Raw 4-digit year
    if (val >= 1900 && val <= 2100) return Math.floor(val);
    // Excel date serial
    if (val > 10000 && val < 100000) {
      const utcDays = Math.floor(val - 25569);
      const d = new Date(utcDays * 86400 * 1000);
      return d.getUTCFullYear();
    }
    return null;
  }

  const s = String(val).trim();
  if (/^\d{4}$/.test(s)) return parseInt(s, 10);

  const yearMatch = s.match(/(19|20)\d{2}/);
  if (yearMatch) return parseInt(yearMatch[0], 10);

  return null;
}

/**
 * Generate a human-readable summary of the detected layout, suitable
 * for preview UIs. Includes sample data for up to N rows.
 */
function buildPreview(data, layout, formKey, sampleLimit = 5, headerRowIdx) {
  const headerRow = headerRowIdx !== undefined ? headerRowIdx : findHeaderRow(data);
  const dataStartRow = headerRow + 1;
  const scale = (section) => section === 'stress' ? 'stress' : 'intra';

  const intraItems = Object.keys(layout.intra).map(Number).sort((a, b) => a - b);
  const extraItems = Object.keys(layout.extra).map(Number).sort((a, b) => a - b);
  const stressItems = Object.keys(layout.stress).map(Number).sort((a, b) => a - b);

  const sampleParticipants = [];
  let totalDataRows = 0;
  for (let r = dataStartRow; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    const docCol = layout.socio.documento;
    const nameCol = layout.socio.nombre;
    const hasDoc = docCol !== undefined && row[docCol] != null && row[docCol] !== '';
    const hasName = nameCol !== undefined && row[nameCol] != null && row[nameCol] !== '';
    if (!hasDoc && !hasName) continue;
    totalDataRows++;

    if (sampleParticipants.length < sampleLimit) {
      const get = (field) => {
        const c = layout.socio[field];
        return c !== undefined && row[c] != null ? String(row[c]) : '';
      };

      // Count non-null responses per section
      const countResponses = (map, s) => {
        let ok = 0, invalid = 0;
        for (const col of Object.values(map)) {
          const parsed = parseResponseValue(row[col], s);
          if (parsed === null && row[col] != null && row[col] !== '') invalid++;
          else if (parsed !== null) ok++;
        }
        return { ok, invalid };
      };

      sampleParticipants.push({
        rowIndex: r + 1,
        documento: get('documento'),
        nombre: get('nombre'),
        sexo: get('sexo'),
        birthYear: parseExcelYear(row[layout.socio.birthYear]),
        cargo: get('cargo'),
        tipoCargo: get('tipoCargo'),
        tipoContrato: get('tipoContrato'),
        intralaboral: countResponses(layout.intra, 'intra'),
        extralaboral: countResponses(layout.extra, 'intra'),
        estres: countResponses(layout.stress, 'stress'),
      });
    }
  }

  return {
    formKey,
    headerRow: headerRow + 1,
    dataStartRow: dataStartRow + 1,
    totalRows: data.length,
    totalDataRows,
    layout: {
      socio: layout.socio,
      filterCols: layout.filterCols,
      intraItemCount: intraItems.length,
      extraItemCount: extraItems.length,
      stressItemCount: stressItems.length,
      intraItemsFound: intraItems,
      extraItemsFound: extraItems,
      stressItemsFound: stressItems,
    },
    warnings: layout.warnings,
    sampleParticipants,
  };
}

module.exports = {
  findHeaderRow,
  detectSectionBanners,
  detectLayout,
  parseResponseValue,
  parseExcelYear,
  buildPreview,
  extractItemNumber,
  isFilterHeader,
  classifySection,
  sectionAtCol,
};
