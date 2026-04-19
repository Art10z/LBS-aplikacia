// Utility helpers for LBS
window.LBSUtils = (function(){
  const VOWELS_ALL = /[aäeioóuúyýáéíôAÄEIOÓUÚYÝÁÉÍÔ]/g;
  const SYLLABIC_CONSONANTS = /[rŕlĺRŔLĹ]/g; // simplified, avoids lookbehind
  const LONG_VOWELS_REGEX = /[áéíóúýĺŕÁÉÍÓÚÝĹŔ]/g;
  const LONG_VOWELS_STR = 'áéíóúýĺŕÁÉÍÓÚÝĹŔ';
  const WORD_REGEX = /[a-zA-ZáéíóúýčďěňřšťžľĺŕäôÁÉÍÓÚÝČĎĚŇŘŠŤŽĽĹŔÄÔ]+/g;
  const TAG_REGEX = /^\[(.*?)\]$/;

  function escapeHTML(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function countSyllables(text){
    if(!text) return 0;
    const v = (text.match(VOWELS_ALL)||[]).length;
    const sc = (text.match(SYLLABIC_CONSONANTS)||[]).length;
    return v + sc;
  }

  function findLastWordRange(line){
    let last = null;
    let m;
    WORD_REGEX.lastIndex = 0;
    while((m = WORD_REGEX.exec(line)) !== null){ last = {index: m.index, end: m.index + m[0].length}; }
    return last || {index:-1,end:-1};
  }

  function normalizeStr(s){
    try{
      return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    }catch(e){
      return String(s).toLowerCase();
    }
  }

  function getLastN(word, n){
    if(!word) return '';
    const norm = normalizeStr(word).replace(/[^a-z0-9]/gi, '');
    return norm.slice(-n);
  }

  return {VOWELS_ALL, SYLLABIC_CONSONANTS, LONG_VOWELS_REGEX, LONG_VOWELS_STR, WORD_REGEX, TAG_REGEX, escapeHTML, countSyllables, findLastWordRange, normalizeStr, getLastN};
})();
