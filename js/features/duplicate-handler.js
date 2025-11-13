/* Unified Duplicate Handler (v4) - minimal, no external deps */
(function(w){
  const WORD_RX = /\p{L}+(?:['’-]\p{L}+)?/gu; // unicode letters + apostrophe/dash linkers
  function tokenize(t){ return (t||'').toLowerCase().match(WORD_RX) || []; }
  function analyze(text){
    const words = tokenize(text);
    const freq = new Map();
    for (const w of words) freq.set(w, (freq.get(w)||0)+1);
    const duplicates = Array.from(freq.entries())
      .filter(([,c]) => c > 1)
      .sort((a,b) => b[1]-a[1])
      .map(([word,count]) => ({ word, count }));
    return { words: words.length, unique: freq.size, duplicates, text };
  }
  function renderHighlighted(text, dups){
    if (!text) return '';
    const set = new Set((dups||[]).map(d=>d.word));
    return text.replace(WORD_RX, m => set.has(m.toLowerCase()) ? '<mark class="dup-word">'+m+'</mark>' : m);
  }
  function generateReport(analysis, fmt='text'){
    if (fmt === 'html'){
      const rows = (analysis.duplicates||[]).slice(0,100)
        .map((d,i)=>`<div class="dup-item"><span class="rank">${i+1}</span><span class="word">${d.word}</span><span class="count">×${d.count}</span></div>`) 
        .join('');
      return `<div class="duplicate-list">${rows}</div>`;
    }
    return (analysis.duplicates||[]).map(d=>`${d.word}: ${d.count}`).join('\n');
  }
  w.duplicateHandler = { analyze, renderHighlighted, generateReport };
})(window);
