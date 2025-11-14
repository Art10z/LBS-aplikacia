// Unified analysis: rhyme groups + duplicate detection for research and canvas.
// Rules:
// - Words length 4-5: rhyme key = last 2 letters (diacritics stripped, lowercase)
// - Words length >=6: rhyme key = last 3 letters
// - Words <4 ignored for rhyme
// - 100% match on normalized full word => full duplicate (dup-full)
// - Adjacent duplicates mark the second token (dup-pair)

export function initUnifiedAnalyzer({ getText, layerEl, mode = 'rhyme', debounceMs = 200 }) {
  if (typeof getText !== 'function' || !layerEl) return () => {};

  const run = () => {
    try {
      const txt = getText() || '';
      const result = analyze(txt);
      render(result, layerEl, mode);
    } catch (e) {
      console.error('UnifiedAnalyzer run error:', e);
    }
  };
  const dRun = debounce(run, debounceMs);
  // Initial render
  run();
  // Return a simple API for re-render and mode change
  const api = {
    update() { dRun(); },
    setMode(newMode) { mode = newMode; dRun(); }
  };
  // Caller should call update() on input changes
  return api;
}

function debounce(fn, ms) { let h; return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); }; }

const HEADING_WORDS = [
  'intro','verse','chorus','refrén','bridge','most','outro','pre-chorus','prechorus',
  'tag','solo','interlude'
];

// Feature detection for Unicode property escapes (\p{L}) support.
const SUPPORTS_UNICODE_PROPS = (() => {
  try { new RegExp('\\p{L}','u'); return true; } catch { return false; }
})();

function isHeadingLine(text) {
  const t = (text || '').trim();
  if (!t) return false;
  if (/^\[[^\]]+\]$/.test(t)) return true; // [Verse], [Chorus 2]
  // Fallback pattern without Unicode property escapes for older engines.
  const headingRegex = SUPPORTS_UNICODE_PROPS
    ? /^[\p{L}\p{N} .#\-]+:\s*$/u
    : /^[A-Za-z0-9ÁÄáäČĎčďÉéÍíÓóÔôÚúÝýŽžŤťŇňŔŕŠšŽž .#\-]+:\s*$/;
  if (headingRegex.test(t)) return true; // Verse:, Refrén:
  const base = t.replace(/\s*\d+$/,'').toLowerCase(); // remove trailing number safely without /u
  return HEADING_WORDS.includes(base);
}

function stripDiacritics(s) {
  try {
    // Older engines may not understand \p{Diacritic}; use generic combining mark range.
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

function tokenize(line) {
  if (SUPPORTS_UNICODE_PROPS) {
    return line.match(/\p{L}+(?:['’\-]\p{L}+)*|\d+/gu) || [];
  }
  // Fallback: approximate word matching including slovak diacritics explicitly.
  return line.match(/[A-Za-zÁÄáäČĎčďÉéÍíÓóÔôÚúÝýŽžŤťŇňŔŕŠšŽž]+(?:['’\-][A-Za-zÁÄáäČĎčďÉéÍíÓóÔôÚúÝýŽžŤťŇňŔŕŠšŽž]+)*|\d+/g) || [];
}
function normalizeFullWord(raw) { return stripDiacritics(raw); }

function deriveRhymeKey(raw) {
  const norm = normalizeFullWord(raw);
  const len = norm.length;
  if (len < 4) return null;
  if (len <= 5) return norm.slice(-2);
  return norm.slice(-3);
}

export function analyze(rawText) {
  const lines = rawText.split(/\r?\n/);
  const analyzed = [];
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
      return { raw: w, norm, rhymeKey: heading ? null : deriveRhymeKey(w), dupPairSecond: false, dupFull: false };
    });
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i].norm === tokens[i + 1].norm) tokens[i + 1].dupPairSecond = true;
    }
    analyzed.push({ text, isHeading: heading, tokens, lineIdx });
  });

  // Mark full duplicates (counts > 1) for words that qualify for rhyme (len >= 4)
  analyzed.forEach(line => {
    if (line.isHeading) return;
    line.tokens.forEach(tok => {
      if (tok.norm.length >= 4 && (globalWordCounts.get(tok.norm) || 0) > 1) tok.dupFull = true;
    });
  });

  // Group by rhyme key using last eligible token per line
  const rhymeBuckets = new Map(); // key -> [lineIdx]
  analyzed.forEach(line => {
    if (line.isHeading) return;
    for (let i = line.tokens.length - 1; i >= 0; i--) {
      const t = line.tokens[i];
      if (t.rhymeKey) {
        if (!rhymeBuckets.has(t.rhymeKey)) rhymeBuckets.set(t.rhymeKey, []);
        rhymeBuckets.get(t.rhymeKey).push(line.lineIdx);
        break;
      }
    }
  });

  const rhymeKeyToLabel = new Map();
  let groupCounter = 0;
  for (const [key, arr] of rhymeBuckets.entries()) {
    if (arr.length < 2) continue; // Only label groups with 2+ lines
    const label = String.fromCharCode(65 + (groupCounter % 26)) + (groupCounter >= 26 ? Math.floor(groupCounter / 26) : '');
    rhymeKeyToLabel.set(key, label);
    groupCounter++;
  }

  analyzed.forEach(line => {
    if (line.isHeading) return;
    line.tokens.forEach(tok => {
      if (tok.rhymeKey && rhymeKeyToLabel.has(tok.rhymeKey)) tok.rhymeGroup = rhymeKeyToLabel.get(tok.rhymeKey);
    });
  });

  // Vypocet metrik
  const nonEmptyLines = lines.filter(l => l.trim().length > 0 && !isHeadingLine(l));
  const uniqueWordsCount = new Set(allWordsForMetrics).size;
  const vocabularyRichness = allWordsForMetrics.length > 0 ? ((uniqueWordsCount / allWordsForMetrics.length) * 100).toFixed(1) : 0;
  const avgWordsPerLine = nonEmptyLines.length > 0 ? (allWordsForMetrics.length / nonEmptyLines.length).toFixed(1) : 0;
  const duplicateCount = Array.from(globalWordCounts.values()).filter(c => c > 1).length;

  const metrics = {
      lines: nonEmptyLines.length,
      words: allWordsForMetrics.length,
      uniqueWords: uniqueWordsCount,
      vocabularyRichness: `${vocabularyRichness}%`,
      avgWordsPerLine: avgWordsPerLine,
      duplicateCount: duplicateCount
  };

  return { lines: analyzed, metrics };
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
      const between = original.slice(cursor, idx);
      if (between) div.appendChild(document.createTextNode(between));
      let isDupe = false;
      if (tok.norm && result.metrics && tok.norm.length >= 3) {
        const wordCount = result.lines
          .flatMap(l => l.tokens)
          .filter(t => t.norm === tok.norm).length;
        if (wordCount > 1) {
          isDupe = true;
        }
      }
      if (isDupe) {
        const span = document.createElement('span');
        span.textContent = tok.raw;
        span.className = 'dup-highlight';
        div.appendChild(span);
      } else {
        div.appendChild(document.createTextNode(tok.raw));
      }
      cursor = idx + tok.raw.length;
    });
    const tail = original.slice(cursor);
    if (tail) div.appendChild(document.createTextNode(tail));

    if (mode === 'rhyme') {
      const lastWithGroup = [...div.querySelectorAll('.rhyme-token')].pop();
      if (lastWithGroup) {
        const badge = document.createElement('span');
        badge.className = 'rhyme-badge';
        badge.textContent = lastWithGroup.dataset.rhyme;
        badge.title = 'Rým skupina ' + lastWithGroup.dataset.rhyme;
        div.appendChild(document.createTextNode(' '));
        div.appendChild(badge);
      }
    }

    layerEl.appendChild(div);
  });
}
