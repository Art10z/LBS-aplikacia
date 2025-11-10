/**
 * SIMPLE TEXT COMPARATOR
 * Porovnáva max 2 projekty - čisto textová analýza
 * @version 1.0
 */

class SimpleTextComparator {
    constructor() {
        this.project1 = null;
        this.project2 = null;
    }

    /**
     * Načíta text z projektu (HTML súbor)
     * @param {number} projectNumber - Číslo projektu (1-5)
     * @returns {Promise<Object>} - Objekt s info o projekte
     */
    async loadProject(projectNumber) {
        try {
            const response = await fetch(`project${projectNumber}.html`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const html = await response.text();
            
            // Extrahuj čistý text z HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Odstráň skripty a štýly
            doc.querySelectorAll('script, style').forEach(el => el.remove());
            
            const text = doc.body.textContent || '';
            
            return {
                id: projectNumber,
                name: `Project ${projectNumber}`,
                text: text.trim(),
                loaded: true
            };
        } catch (error) {
            console.error(`Chyba pri načítaní project${projectNumber}.html:`, error);
            return {
                id: projectNumber,
                name: `Project ${projectNumber}`,
                text: '',
                loaded: false,
                error: error.message
            };
        }
    }

    /**
     * Porovná 2 projekty
     * @param {number} projectNum1 - Číslo prvého projektu
     * @param {number} projectNum2 - Číslo druhého projektu
     * @returns {Promise<Object>} - Výsledok porovnania
     */
    async compare(projectNum1, projectNum2) {
        if (projectNum1 === projectNum2) {
            throw new Error('Vyber 2 rôzne projekty!');
        }

        this.project1 = await this.loadProject(projectNum1);
        this.project2 = await this.loadProject(projectNum2);

        if (!this.project1.loaded) {
            throw new Error(`Nepodarilo sa načítať ${this.project1.name}: ${this.project1.error}`);
        }
        if (!this.project2.loaded) {
            throw new Error(`Nepodarilo sa načítať ${this.project2.name}: ${this.project2.error}`);
        }

        return this._analyzeComparison();
    }

    /**
     * Analyzuje oba projekty a vytvorí porovnanie
     * @private
     */
    _analyzeComparison() {
        const analysis1 = this._analyzeText(this.project1.text);
        const analysis2 = this._analyzeText(this.project2.text);

        return {
            project1: {
                name: this.project1.name,
                ...analysis1
            },
            project2: {
                name: this.project2.name,
                ...analysis2
            },
            comparison: this._generateComparison(analysis1, analysis2),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Analyzuje text a vráti metriky
     * @private
     */
    _analyzeText(text) {
        const lines = text.split('\n').filter(l => l.trim());
        const words = text.toLowerCase().match(/\b[\p{L}\p{N}'-]+\b/gu) || [];
        const uniqueWords = new Set(words);
        
        // Odstráň prázdne riadky pre výpočet priemerov
        const nonEmptyLines = lines.filter(l => l.trim().length > 0);
        
        // Najdlhší a najkratší riadok
        const lineLengths = nonEmptyLines.map(l => l.length);
        const longestLine = lineLengths.length > 0 ? Math.max(...lineLengths) : 0;
        const shortestLine = lineLengths.length > 0 ? Math.min(...lineLengths) : 0;

        return {
            totalLines: lines.length,
            totalWords: words.length,
            uniqueWords: uniqueWords.size,
            avgWordsPerLine: nonEmptyLines.length > 0 
                ? (words.length / nonEmptyLines.length).toFixed(1) 
                : 0,
            vocabulary: words.length > 0 
                ? ((uniqueWords.size / words.length) * 100).toFixed(1) 
                : 0,
            longestLine: longestLine,
            shortestLine: shortestLine,
            avgLineLength: nonEmptyLines.length > 0 
                ? (lineLengths.reduce((a, b) => a + b, 0) / lineLengths.length).toFixed(1)
                : 0,
            totalChars: text.length
        };
    }

    /**
     * Vytvorí porovnanie medzi dvoma analýzami
     * @private
     */
    _generateComparison(a1, a2) {
        return {
            wordsDiff: a2.totalWords - a1.totalWords,
            linesDiff: a2.totalLines - a1.totalLines,
            vocabDiff: (parseFloat(a2.vocabulary) - parseFloat(a1.vocabulary)).toFixed(1),
            uniqueWordsDiff: a2.uniqueWords - a1.uniqueWords,
            charsDiff: a2.totalChars - a1.totalChars,
            winner: this._determineWinner(a1, a2)
        };
    }

    /**
     * Určí víťaza na základe viacerých kritérií
     * @private
     */
    _determineWinner(a1, a2) {
        let score1 = 0;
        let score2 = 0;

        // Kritérium 1: Viac slov = lepšie (väčší text)
        if (a1.totalWords > a2.totalWords) score1++; 
        else if (a2.totalWords > a1.totalWords) score2++;
        
        // Kritérium 2: Bohatšia slovná zásoba = lepšie
        const vocab1 = parseFloat(a1.vocabulary);
        const vocab2 = parseFloat(a2.vocabulary);
        if (vocab1 > vocab2) score1++; 
        else if (vocab2 > vocab1) score2++;
        
        // Kritérium 3: Viac unikátnych slov = lepšie
        if (a1.uniqueWords > a2.uniqueWords) score1++; 
        else if (a2.uniqueWords > a1.uniqueWords) score2++;

        // Kritérium 4: Väčšia priemerná dĺžka riadku = lepšie (detailnejší text)
        const avg1 = parseFloat(a1.avgLineLength);
        const avg2 = parseFloat(a2.avgLineLength);
        if (avg1 > avg2) score1++; 
        else if (avg2 > avg1) score2++;

        if (score1 > score2) return 'project1';
        if (score2 > score1) return 'project2';
        return 'tie';
    }

    /**
     * Generuje ASCII textový report (pre konzolu)
     * @param {Object} comparisonData - Dáta z porovnania
     * @returns {string} - Formátovaný ASCII report
     */
    generateTextReport(comparisonData) {
        const { project1, project2, comparison } = comparisonData;

        const formatNumber = (num) => String(num).padStart(8);
        const formatPercent = (num) => String(num).padStart(6);

        let report = `
╔═══════════════════════════════════════════════════════════════╗
║           📊 TEXT COMPARISON REPORT                            ║
╚═══════════════════════════════════════════════════════════════╝

┌───────────────────────────────────────────────────────────────┐
│ ${project1.name.padEnd(60)} │
├───────────────────────────────────────────────────────────────┤
│ Total Lines:        ${formatNumber(project1.totalLines)}                            │
│ Total Words:        ${formatNumber(project1.totalWords)}                            │
│ Unique Words:       ${formatNumber(project1.uniqueWords)}                            │
│ Vocabulary:         ${formatPercent(project1.vocabulary)}%                          │
│ Avg Words/Line:     ${formatPercent(project1.avgWordsPerLine)}                              │
│ Longest Line:       ${formatNumber(project1.longestLine)} chars                      │
│ Shortest Line:      ${formatNumber(project1.shortestLine)} chars                      │
│ Avg Line Length:    ${formatPercent(project1.avgLineLength)} chars                      │
│ Total Characters:   ${formatNumber(project1.totalChars)}                            │
└───────────────────────────────────────────────────────────────┘

                              VS

┌───────────────────────────────────────────────────────────────┐
│ ${project2.name.padEnd(60)} │
├───────────────────────────────────────────────────────────────┤
│ Total Lines:        ${formatNumber(project2.totalLines)}                            │
│ Total Words:        ${formatNumber(project2.totalWords)}                            │
│ Unique Words:       ${formatNumber(project2.uniqueWords)}                            │
│ Vocabulary:         ${formatPercent(project2.vocabulary)}%                          │
│ Avg Words/Line:     ${formatPercent(project2.avgWordsPerLine)}                              │
│ Longest Line:       ${formatNumber(project2.longestLine)} chars                      │
│ Shortest Line:      ${formatNumber(project2.shortestLine)} chars                      │
│ Avg Line Length:    ${formatPercent(project2.avgLineLength)} chars                      │
│ Total Characters:   ${formatNumber(project2.totalChars)}                            │
└───────────────────────────────────────────────────────────────┘

╔═══════════════════════════════════════════════════════════════╗
║                      🏆 VÝSLEDOK                                ║
╚═══════════════════════════════════════════════════════════════╝

Rozdiel v slovách:        ${comparison.wordsDiff > 0 ? '+' : ''}${comparison.wordsDiff}
Rozdiel v riadkoch:       ${comparison.linesDiff > 0 ? '+' : ''}${comparison.linesDiff}
Rozdiel v unikátnych:     ${comparison.uniqueWordsDiff > 0 ? '+' : ''}${comparison.uniqueWordsDiff}
Rozdiel v slovnej zásobe: ${comparison.vocabDiff > 0 ? '+' : ''}${comparison.vocabDiff}%
Rozdiel v znakoch:        ${comparison.charsDiff > 0 ? '+' : ''}${comparison.charsDiff}

${comparison.winner === 'project1' ? '🥇 VÍŤAZ: ' + project1.name :
  comparison.winner === 'project2' ? '🥇 VÍŤAZ: ' + project2.name :
  '🤝 REMÍZA - Oba projekty sú rovnocenné'}

`;

        return report;
    }

    /**
     * Generuje HTML verziu reportu (pre UI)
     * @param {Object} comparisonData - Dáta z porovnania
     * @returns {string} - HTML kód
     */
    generateHTMLReport(comparisonData) {
        const { project1, project2, comparison } = comparisonData;
        
        const winnerClass1 = comparison.winner === 'project1' ? 'winner' : '';
        const winnerClass2 = comparison.winner === 'project2' ? 'winner' : '';
        const tieClass = comparison.winner === 'tie' ? 'tie' : '';

        return `
<div class="text-comparison-report ${tieClass}">
    <h2>📊 Text Comparison Report</h2>
    
    <div class="comparison-grid">
        <div class="project-stats ${winnerClass1}">
            <h3>${project1.name} ${comparison.winner === 'project1' ? '🏆' : ''}</h3>
            <table>
                <tr><td>Total Lines</td><td><strong>${project1.totalLines}</strong></td></tr>
                <tr><td>Total Words</td><td><strong>${project1.totalWords}</strong></td></tr>
                <tr><td>Unique Words</td><td><strong>${project1.uniqueWords}</strong></td></tr>
                <tr><td>Vocabulary</td><td><strong>${project1.vocabulary}%</strong></td></tr>
                <tr><td>Avg Words/Line</td><td><strong>${project1.avgWordsPerLine}</strong></td></tr>
                <tr><td>Longest Line</td><td><strong>${project1.longestLine}</strong> chars</td></tr>
                <tr><td>Shortest Line</td><td><strong>${project1.shortestLine}</strong> chars</td></tr>
                <tr><td>Avg Line Length</td><td><strong>${project1.avgLineLength}</strong> chars</td></tr>
                <tr><td>Total Characters</td><td><strong>${project1.totalChars}</strong></td></tr>
            </table>
        </div>

        <div class="vs-divider">
            <span>VS</span>
        </div>

        <div class="project-stats ${winnerClass2}">
            <h3>${project2.name} ${comparison.winner === 'project2' ? '🏆' : ''}</h3>
            <table>
                <tr><td>Total Lines</td><td><strong>${project2.totalLines}</strong></td></tr>
                <tr><td>Total Words</td><td><strong>${project2.totalWords}</strong></td></tr>
                <tr><td>Unique Words</td><td><strong>${project2.uniqueWords}</strong></td></tr>
                <tr><td>Vocabulary</td><td><strong>${project2.vocabulary}%</strong></td></tr>
                <tr><td>Avg Words/Line</td><td><strong>${project2.avgWordsPerLine}</strong></td></tr>
                <tr><td>Longest Line</td><td><strong>${project2.longestLine}</strong> chars</td></tr>
                <tr><td>Shortest Line</td><td><strong>${project2.shortestLine}</strong> chars</td></tr>
                <tr><td>Avg Line Length</td><td><strong>${project2.avgLineLength}</strong> chars</td></tr>
                <tr><td>Total Characters</td><td><strong>${project2.totalChars}</strong></td></tr>
            </table>
        </div>
    </div>

    <div class="comparison-summary">
        <h3>📈 Rozdiely</h3>
        <div class="diff-grid">
            <div class="diff-item">
                <span class="label">Slová:</span>
                <span class="value ${comparison.wordsDiff > 0 ? 'positive' : comparison.wordsDiff < 0 ? 'negative' : ''}">${comparison.wordsDiff > 0 ? '+' : ''}${comparison.wordsDiff}</span>
            </div>
            <div class="diff-item">
                <span class="label">Riadky:</span>
                <span class="value ${comparison.linesDiff > 0 ? 'positive' : comparison.linesDiff < 0 ? 'negative' : ''}">${comparison.linesDiff > 0 ? '+' : ''}${comparison.linesDiff}</span>
            </div>
            <div class="diff-item">
                <span class="label">Unikátne slová:</span>
                <span class="value ${comparison.uniqueWordsDiff > 0 ? 'positive' : comparison.uniqueWordsDiff < 0 ? 'negative' : ''}">${comparison.uniqueWordsDiff > 0 ? '+' : ''}${comparison.uniqueWordsDiff}</span>
            </div>
            <div class="diff-item">
                <span class="label">Slovná zásoba:</span>
                <span class="value ${parseFloat(comparison.vocabDiff) > 0 ? 'positive' : parseFloat(comparison.vocabDiff) < 0 ? 'negative' : ''}">${comparison.vocabDiff > 0 ? '+' : ''}${comparison.vocabDiff}%</span>
            </div>
            <div class="diff-item">
                <span class="label">Znaky:</span>
                <span class="value ${comparison.charsDiff > 0 ? 'positive' : comparison.charsDiff < 0 ? 'negative' : ''}">${comparison.charsDiff > 0 ? '+' : ''}${comparison.charsDiff}</span>
            </div>
        </div>
    </div>

    ${comparison.winner !== 'tie' ? `
        <div class="winner-banner">
            <h2>🏆 Víťaz: ${comparison.winner === 'project1' ? project1.name : project2.name}</h2>
        </div>
    ` : `
        <div class="tie-banner">
            <h2>🤝 Remíza - Oba projekty sú rovnocenné</h2>
        </div>
    `}
</div>
        `;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimpleTextComparator;
} else {
    window.SimpleTextComparator = SimpleTextComparator;
}
