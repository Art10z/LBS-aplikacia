// Unified analysis: rhyme groups + duplicate detection for research and canvas.

const HEADING_WORDS = [
  'intro','verse','chorus','refrén','bridge','most','outro','pre-chorus','prechorus',
  'tag','solo','interlude'
];

const SKIP_WORDS = new Set([
    'a', 'aj', 'ako', 'ale', 'aby', 'ani', 'ak', 'do', 'da', 'de', 'di', 'je', 'ja', 'ju', 'jej',
    'ku', 'ka', 'ki', 'ma', 'mi', 'mu', 'me', 'mna', 'mne', 'na', 'no', 'ni', 'nad', 'od', 'o',
    'po', 'pre', 'pri', 'pred', 'sa', 'si', 'so', 'sme', 'ste', 'som', 'ta', 'to', 'ti', 'ty',
    'te', 'tú', 'tu', 'ten', 'v', 've', 'vo', 'za', 'zo', 'že', 'ze', 'i', 'u', 'k', 's', 'z'
]);
const MIN_WORD_LENGTH_RHYME = 4;
const MIN_RHYME_MATCH = 2;

// Feature detection for Unicode property escapes (\p{L}) support.
const SUPPORTS_UNICODE_PROPS = (() => {
  try { new RegExp('\\p{L}','u'); return true; } catch { return false; }
})();

function isHeadingLine(text) {
  const t = (text || '').trim();
  if (!t) return false;
  if (/^\[[^\]]+\]$/.test(t)) return true; // [Verse], [Chorus 2]
  const headingRegex = SUPPORTS_UNICODE_PROPS
    ? /^[\p{L}\p{N} .#\-]+:\s*$/u
    : /^[A-Za-z0-9ÁÄáäČĎčďÉéÍíÓóÔôÚúÝýŽžŤťŇňŔŕŠšŽž .#\-]+:\s*$/;
  if (headingRegex.test(t)) return true; // Verse:, Refrén:
  const base = t.replace(/\s*\d+$/,'').toLowerCase();
  return HEADING_WORDS.includes(base);
}

function stripDiacritics(s) {
  try {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

function tokenize(line) {
  if (SUPPORTS_UNICODE_PROPS) {
    return line.match(/\p{L}+(?:['’\-]\p{L}+)*|\d+/gu) || [];
  }
  return line.match(/[A-Za-zÁÄáäČĎčďÉéÍíÓóÔôÚúÝýŽžŤťŇňŔŕŠšŽž]+(?:['’\-][A-Za-zÁÄáäČĎčďÉéÍíÓóÔôÚúÝýŽžŤťŇňŔŕŠšŽž]+)*|\d+/g) || [];
}

function normalizeFullWord(raw) { return stripDiacritics(raw); }

function deriveRhymeKey(raw) {
  const norm = normalizeFullWord(raw);
  const len = norm.length;
  if (len < MIN_WORD_LENGTH_RHYME) return null;
  if (len <= 5) return norm.slice(-2);
  return norm.slice(-3);
}

export function analyze(rawText) {
  const lines = rawText.split(/\r?\n/);
  const analyzedLines = [];
  const globalWordCounts = new Map();
  const allWordsForMetrics = [];

  lines.forEach((text, lineIdx) => {
    const heading = isHeadingLine(text);
    const tokens = tokenize(text).map(w => {
      const norm = normalizeFullWord(w);
      globalWordCounts.set(norm, (globalWordCounts.get(norm) || 0) + 1);
      if (!heading) {
        allWordsForMetrics.push(norm);
      }
      return { raw: w, norm, rhymeKey: heading ? null : deriveRhymeKey(w) };
    });
    analyzedLines.push({ text, isHeading: heading, tokens, lineIdx });
  });

  const nonEmptyLines = lines.filter(l => l.trim().length > 0 && !isHeadingLine(l));
  const uniqueWordsCount = new Set(allWordsForMetrics).size;
  const vocabularyRichness = allWordsForMetrics.length > 0 ? ((uniqueWordsCount / allWordsForMetrics.length) * 100).toFixed(1) : '0.0';
  const avgWordsPerLine = nonEmptyLines.length > 0 ? (allWordsForMetrics.length / nonEmptyLines.length).toFixed(1) : '0.0';
  const duplicateCount = Array.from(globalWordCounts.values()).filter(c => c > 1).length;

  const metrics = {
      lines: nonEmptyLines.length,
      words: allWordsForMetrics.length,
      uniqueWords: uniqueWordsCount,
      vocabularyRichness: `${vocabularyRichness}%`,
      avgWordsPerLine: avgWordsPerLine,
      duplicateCount: duplicateCount,
  };

  return { lines: analyzedLines, metrics, globalWordCounts };
}

export function render(result, layerEl, mode) {
  layerEl.innerHTML = '';
  result.lines.forEach(line => {
    const div = document.createElement('div');
    div.className = 'ua-line';
    if (line.isHeading) {
      div.textContent = line.text;
      div.classList.add('ua-heading');
      layerEl.appendChild(div);
      return;
    }
    const original = line.text;
    let cursor = 0;
    line.tokens.forEach(tok => {
      const idx = original.indexOf(tok.raw, cursor);
      if (idx === -1) return;
      const between = original.slice(cursor, idx);
      if (between) div.appendChild(document.createTextNode(between));
      
      const span = document.createElement('span');
      span.textContent = tok.raw;
      
      if (mode === 'duplicates') {
          const count = result.globalWordCounts.get(tok.norm) || 0;
          if (count > 1) {
              span.className = 'duplicate-word';
              if (count > 2) {
                  span.classList.add('duplicate-word-high');
              }
          }
      }
      
      div.appendChild(span);
      cursor = idx + tok.raw.length;
    });
    const tail = original.slice(cursor);
    if (tail) div.appendChild(document.createTextNode(tail));

    layerEl.appendChild(div);
  });
}

export function findRhymingWords(text) {
    const normalizedText = normalizeFullWord(text.replace(/[.,!?;:„“"()[\]{}—–-]/g, ' '));
    const words = normalizedText.split(/\s+/);
    
    const uniqueWords = new Set();
    words.forEach(word => {
        const cleaned = word.trim();
        if (cleaned.length >= MIN_WORD_LENGTH_RHYME && !SKIP_WORDS.has(cleaned)) {
            uniqueWords.add(cleaned);
        }
    });

    const wordList = Array.from(uniqueWords);
    const rhymeGroups = new Map();

    wordList.forEach(word => {
        const reversed = word.split('').reverse().join('');
        const suffix = reversed.substring(0, MIN_RHYME_MATCH);

        if (!rhymeGroups.has(suffix)) {
            rhymeGroups.set(suffix, []);
        }
        rhymeGroups.get(suffix).push(word);
    });

    const rhymingWords = [];
    rhymeGroups.forEach((group) => {
        if (group.length > 1) {
            rhymingWords.push(...group);
        }
    });

    return [...new Set(rhymingWords)];
}
