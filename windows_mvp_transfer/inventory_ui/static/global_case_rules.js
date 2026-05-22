const JOINERS = new Set(['on', 'in', 'and', 'or', 'of', 'the', 'a', 'an', 'to', 'for', 'at', 'by']);
const MEASUREMENT_UNITS = ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mtr', 'ltr'];
const ALWAYS_LOWER_WORDS = new Set(MEASUREMENT_UNITS);
const DEFAULT_ALWAYS_UPPER_WORDS = ['usb', 'xlr', 'iec', 'rca', 'aa', 'aaa'];
const ACRONYM_ALLOWLIST_API = '/api/ui-rules/acronym-allowlist';
const CANONICAL_CASE_WORDS = new Map([
  ['iphone', 'iPhone'],
  ['ipad', 'iPad'],
  ['ipod', 'iPod'],
  ['ios', 'iOS'],
  ['macbook', 'MacBook'],
]);

let cachedAllowlist = null;

export function getGlobalRuleTemplate() {
  return {
    scope: ['admin_master_view', 'admin_item_list_view'],
    precedence: [
      'field_specific_exception',
      'admin_allowlist_uppercase',
      'canonical_brand_case',
      'measurement_normalization',
      'acronym_single_letter_suffix',
      'generic_title_case_with_joiners',
    ],
    adminEditableLayer: 'admin_allowlist_uppercase',
    measurementUnits: [...MEASUREMENT_UNITS],
    defaultAllowlist: [...DEFAULT_ALWAYS_UPPER_WORDS],
  };
}

export function getDefaultCaseAllowlist() {
  return [...DEFAULT_ALWAYS_UPPER_WORDS];
}

export async function loadCaseAllowlist() {
  try {
    const res = await fetch(ACRONYM_ALLOWLIST_API);
    if (!res.ok) throw new Error('allowlist fetch failed');
    const data = await res.json();
    const parsed = parseAllowlistTokens(data.tokens || []);
    cachedAllowlist = parsed.length > 0 ? parsed : getDefaultCaseAllowlist();
  } catch {
    cachedAllowlist = cachedAllowlist && cachedAllowlist.length > 0
      ? [...cachedAllowlist]
      : getDefaultCaseAllowlist();
  }
  return [...cachedAllowlist];
}

export function getActiveCaseAllowlist() {
  if (cachedAllowlist === null) {
    return loadCaseAllowlist();
  }
  return [...cachedAllowlist];
}

export async function saveCaseAllowlist(rawValue) {
  const parsed = parseAllowlistTokens(rawValue);
  if (parsed.length === 0) {
    return { ok: false, error: 'Allow list not saved: enter at least one token.' };
  }

  try {
    const res = await fetch(ACRONYM_ALLOWLIST_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: parsed }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'Allow list save failed.' };
    }
    cachedAllowlist = parseAllowlistTokens(data.tokens || parsed);
    return { ok: true, tokens: [...cachedAllowlist] };
  } catch {
    return { ok: false, error: 'Allow list save failed. Check API connection.' };
  }
}

export async function resetCaseAllowlist() {
  try {
    const res = await fetch(`${ACRONYM_ALLOWLIST_API}/reset`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      return getActiveCaseAllowlist();
    }
    cachedAllowlist = parseAllowlistTokens(data.tokens || getDefaultCaseAllowlist());
    return [...cachedAllowlist];
  } catch {
    return getActiveCaseAllowlist();
  }
}

export function parseAllowlistTokens(value) {
  if (!value) return [];

  let items = [];
  try {
    const parsed = JSON.parse(String(value));
    if (Array.isArray(parsed)) {
      items = parsed;
    } else {
      items = String(value).split(/[,\n|]+/);
    }
  } catch {
    items = String(value).split(/[,\n|]+/);
  }

  return Array.from(new Set(
    items
      .map((token) => String(token || '').trim())
      .map((token) => token.replace(/\s{2,}/g, ' '))
      .filter(Boolean)
      .map((token) => token.toLowerCase()),
  ));
}

export function formatAllowlistForInput(tokens) {
  return tokens.map((token) => token.toUpperCase()).join(', ');
}

export function isAllCapsText(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  const letters = s.replace(/[^A-Za-z]/g, '');
  if (!letters) return false;
  return letters === letters.toUpperCase();
}

export function hasAllCapsWords(value) {
  const words = String(value || '').trim().split(/\s+/);
  return words.some((word) => {
    const letters = word.replace(/[^A-Za-z]/g, '');
    return letters.length >= 2 && letters === letters.toUpperCase();
  });
}

function resolveAllowWords(options = {}) {
  const sourceWords = options.allowWords && options.allowWords.length > 0
    ? options.allowWords
    : getActiveCaseAllowlist();
  const exceptionWords = new Set(
    (options.exceptionWords || []).map((word) => String(word || '').toLowerCase()),
  );

  return new Set(
    sourceWords
      .map((word) => String(word || '').toLowerCase())
      .filter((word) => Boolean(word) && !exceptionWords.has(word)),
  );
}

export function toTitleCaseWithJoiners(value, options = {}) {
  const s = String(value || '').trim();
  if (!s) return s;

  const allowWords = resolveAllowWords(options);
  const words = s.split(/\s+/);
  const titled = words
    .map((originalWord, index) => {
      const letterOnly = originalWord.replace(/[^A-Za-z]/g, '');
      const lowerLetters = letterOnly.toLowerCase();
      const lowerWord = originalWord.toLowerCase();
      const joinerKey = lowerWord.replace(/[^a-z]/g, '');
      const isPlainAlphaWord = /^[A-Za-z]+$/.test(originalWord);

      if (allowWords.has(lowerLetters)) {
        return replaceWordCoreCasing(originalWord, letterOnly.toUpperCase());
      }

      if (CANONICAL_CASE_WORDS.has(lowerLetters)) {
        return replaceWordCoreCasing(originalWord, CANONICAL_CASE_WORDS.get(lowerLetters));
      }

      if (ALWAYS_LOWER_WORDS.has(lowerLetters)) {
        return replaceWordCoreCasing(originalWord, lowerLetters);
      }

      if (index > 0 && isPlainAlphaWord && JOINERS.has(joinerKey)) return lowerWord;

      return capitalizeFirstLetter(lowerWord);
    })
    .join(' ');

  return normalizeMeasurementText(titled);
}

export function normalizeDescriptionCase(value, keepCapsWords, options = {}) {
  const s = String(value || '').trim();
  if (!s) return s;

  const allowWords = new Set(
    (options.allowWords && options.allowWords.length > 0 ? options.allowWords : getActiveCaseAllowlist())
      .map((word) => String(word).toLowerCase()),
  );
  const words = s.split(/\s+/);

  const normalized = words
    .map((originalWord, index) => {
      const letterOnly = originalWord.replace(/[^A-Za-z]/g, '');
      const lowerLetters = letterOnly.toLowerCase();
      const isCapsWord = letterOnly.length >= 2 && letterOnly === letterOnly.toUpperCase();
      const isSingleLetterWord = letterOnly.length === 1;
      const hasDigits = /\d/.test(originalWord);
      const hasUpperLetters = /[A-Z]/.test(originalWord);
      const prevWord = index > 0 ? words[index - 1] : '';
      const prevLettersOnly = prevWord.replace(/[^A-Za-z]/g, '');
      const prevIsCapsAcronym = prevLettersOnly.length >= 2 && prevLettersOnly === prevLettersOnly.toUpperCase();

      if (allowWords.has(lowerLetters)) {
        return replaceWordCoreCasing(originalWord, letterOnly.toUpperCase());
      }

      if (CANONICAL_CASE_WORDS.has(lowerLetters)) {
        return replaceWordCoreCasing(originalWord, CANONICAL_CASE_WORDS.get(lowerLetters));
      }

      if (ALWAYS_LOWER_WORDS.has(lowerLetters)) {
        return replaceWordCoreCasing(originalWord, lowerLetters);
      }

      if (isSingleLetterWord && prevIsCapsAcronym) {
        return originalWord.toUpperCase();
      }

      if (keepCapsWords && isCapsWord) {
        return originalWord.toUpperCase();
      }

      // Preserve typed uppercase in alphanumeric tokens (e.g. A3, USB2).
      // This prevents joiner handling from downcasing values like "A3" to "a3".
      if (hasDigits && hasUpperLetters) {
        return originalWord;
      }

      const lowerWord = originalWord.toLowerCase();
      const joinerKey = lowerWord.replace(/[^a-z]/g, '');
      const isPlainAlphaWord = /^[A-Za-z]+$/.test(originalWord);
      if (index > 0 && isPlainAlphaWord && JOINERS.has(joinerKey)) return lowerWord;

      return capitalizeFirstLetter(lowerWord);
    })
    .join(' ');

  return normalizeMeasurementText(normalized);
}

export function normalizeMeasurementText(value) {
  return String(value || '')
    .replace(
      /\b(\d+(?:\.\d+)?)\s*(mm|cm|m|km|in|ft|yd|mtr|ltr)\b/gi,
      (_, num, unit) => `${num}${String(unit).toLowerCase()}`,
    )
    .replace(
      /\b(mm|cm|m|km|in|ft|yd|mtr|ltr)\b/gi,
      (_, unit) => String(unit).toLowerCase(),
    );
}

function capitalizeFirstLetter(word) {
  const index = word.search(/[a-z]/);
  if (index === -1) return word;
  return word.slice(0, index) + word.charAt(index).toUpperCase() + word.slice(index + 1);
}

function replaceWordCoreCasing(originalWord, replacementCore) {
  const match = String(originalWord || '').match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/);
  if (!match) return replacementCore;
  return `${match[1]}${replacementCore}${match[3]}`;
}
