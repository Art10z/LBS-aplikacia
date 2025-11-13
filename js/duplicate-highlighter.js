// Deprecated: DuplicateHighlighter
// Kept as a tiny shim to avoid runtime errors during transition.
// All new code should use window.duplicateHandler (js/features/duplicate-handler.js)
(function(w){
  function warn(){ console.warn('[deprecated] DuplicateHighlighter is replaced by duplicateHandler'); }
  class DuplicateHighlighter {
    findDuplicates(text){ warn(); try{ const a = w.duplicateHandler?.analyze(text); return (a?.duplicates||[]).map(d=>[d.word,d.count]); } catch { return []; } }
    highlightInHTML(text, dups){ warn(); const list = Array.isArray(dups)? dups.map(x=>({word:x[0],count:x[1]})) : (dups||[]); return w.duplicateHandler ? w.duplicateHandler.renderHighlighted(text, list) : (text||''); }
    generateReport(dups){ warn(); const a = { duplicates: (dups||[]).map(x=>({word:x[0],count:x[1]})) }; return w.duplicateHandler ? w.duplicateHandler.generateReport(a,'text') : ''; }
  }
  w.DuplicateHighlighter = DuplicateHighlighter;
})(window);
