/**
 * DUPLICATE WORD HIGHLIGHTER
 * Detekuje a zvýrazňuje duplikované slová v texte
 * @version 1.0
 */

class DuplicateHighlighter {
    constructor() {
        // Slovenské a anglické stopwords (ignorujeme ich pri detekcii)
        this.stopwords = new Set([
            'a', 'aj', 'ale', 'ako', 'by', 'som', 'si', 'sa', 'to',
            'je', 'v', 'na', 'do', 'z', 'zo', 'pre', 'o', 'že', 'mi',
            'ma', 'mu', 'ju', 'ho', 'ich', 'im', 'ním', 'jej', 'jeho',
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
            'of', 'with', 'as', 'by', 'from', 'up', 'an', 'be', 'it'
        ]);
    }

    /**
     * Analyzuje text a vráti všetky duplikované slová
     * @param {string} text - Text na analýzu
     * @returns {Array<[string, number]>} - Pole tuplov [slovo, počet]
     */
    findDuplicates(text) {
        if (!text) return [];

        const words = text.toLowerCase().match(/\b[\p{L}\p{N}'-]+\b/gu) || [];
        const wordCounts = {};
        
        // Počítaj slová (okrem stopwords a príliš krátkych slov)
        words.forEach(word => {
            if (!this.stopwords.has(word) && word.length > 2) {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            }
        });

        // Vráť len duplikáty, zoradené od najviac opakovaných
        return Object.entries(wordCounts)
            .filter(([word, count]) => count > 1)
            .sort((a, b) => b[1] - a[1]);
    }

    /**
     * Vytvorí HTML s highlighted duplikátmi
     * @param {string} text - Pôvodný text
     * @param {Array<[string, number]>} duplicates - Duplikované slová
     * @returns {string} - HTML s označenými duplikátmi
     */
    highlightInHTML(text, duplicates) {
        if (!text || duplicates.length === 0) return this._escapeHtml(text);

        const duplicateWords = new Set(duplicates.map(([word]) => word));
        
        // Použijeme regex s Unicode support pre slovenčinu
        return text.replace(/\b[\p{L}\p{N}'-]+\b/gu, (match) => {
            const lowerMatch = match.toLowerCase();
            if (duplicateWords.has(lowerMatch)) {
                const count = duplicates.find(([w]) => w === lowerMatch)?.[1] || 0;
                return `<mark class="duplicate-word" data-word="${this._escapeHtml(lowerMatch)}" data-count="${count}" title="Opakované ${count}×">${this._escapeHtml(match)}</mark>`;
            }
            return this._escapeHtml(match);
        });
    }

    /**
     * Vytvorí textový report o duplikátoch
     * @param {Array<[string, number]>} duplicates - Duplikované slová
     * @returns {string} - Formátovaný report
     */
    generateReport(duplicates) {
        if (duplicates.length === 0) {
            return '✅ Žiadne duplikované slová nenájdené!\n\n(Ignorované stopwords a slová kratšie ako 3 znaky)';
        }

        let report = `⚠️ Našlo sa ${duplicates.length} duplikovaných slov:\n\n`;
        
        duplicates.forEach(([word, count], index) => {
            const bars = '█'.repeat(Math.min(count, 20));
            report += `${String(index + 1).padStart(3)}. "${word}" → ${count}× ${bars}\n`;
        });

        const totalRepeats = duplicates.reduce((sum, [, count]) => sum + count, 0);
        report += `\n📊 Celkovo: ${totalRepeats} opakovaní`;

        return report;
    }

    /**
     * Vytvorí detailnú štatistiku
     * @param {string} text - Text na analýzu
     * @returns {Object} - Objekt so štatistikami
     */
    getStatistics(text) {
        const duplicates = this.findDuplicates(text);
        const words = text.toLowerCase().match(/\b[\p{L}\p{N}'-]+\b/gu) || [];
        const uniqueWords = new Set(words);
        
        const duplicateWordCount = duplicates.reduce((sum, [, count]) => sum + count, 0);
        const uniqueDuplicates = duplicates.length;

        return {
            totalWords: words.length,
            uniqueWords: uniqueWords.size,
            duplicateTypes: uniqueDuplicates,
            duplicateInstances: duplicateWordCount,
            repetitionRate: words.length > 0 
                ? ((duplicateWordCount / words.length) * 100).toFixed(1) 
                : 0,
            vocabularyRichness: words.length > 0
                ? ((uniqueWords.size / words.length) * 100).toFixed(1)
                : 0
        };
    }

    /**
     * Escape HTML znaky
     * @private
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export pre použitie v module aj v globálnom scope
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DuplicateHighlighter;
} else {
    window.DuplicateHighlighter = DuplicateHighlighter;
}
