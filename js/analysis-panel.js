/**
 * ANALYSIS PANEL
 * Samostatný panel "Analýza" vedľa "Výskum a Analýza"
 * Centralizuje lyrické analýzy (duplikáty + metriky) bez zaťažovania Dynamického plátna
 * @version 1.0
 */

(function () {
    'use strict';

    /**
     * Získa zdrojový text z Importéra alebo Dynamického plátna
     */
    function getSourceText() {
        // Prioritne z Importéra textu
        const importer = document.getElementById('source-input');
        if (importer && importer.value && importer.value.trim()) {
            return importer.value;
        }
        
        // Fallback: text z aktívneho elementu v dynamickom plátne
        const activeElement = document.querySelector('.dynamic-canvas .selected, .canvas-item.selected');
        if (activeElement) {
            return activeElement.textContent || activeElement.innerText || '';
        }
        
        return '';
    }

    /**
     * Vytvorí tlačidlo "Analýza"
     */
    function createAnalysisButton() {
        const btn = document.createElement('button');
        btn.className = 'tool-btn analysis-trigger-btn';
        btn.type = 'button';
        btn.innerHTML = '🔬 Analýza';
        btn.title = 'Otvoriť panel Analýza (duplikáty, metriky, report)';
        btn.addEventListener('click', openAnalysisModal);
        return btn;
    }

    /**
     * Nájde vhodné miesto na vloženie tlačidla
     * Preferuje Research panel alebo pravý sidebar
     */
    function findInsertPoint() {
        // Skús nájsť research panel
        const research = document.querySelector('.research-panel, #research-panel, .panel-research, [data-panel="research"]');
        if (research) return research;
        
        // Fallback: pravý sidebar alebo importer container
        return document.querySelector('.right-sidebar') 
            || document.querySelector('.importer-panel')
            || document.querySelector('.app-header')
            || document.querySelector('header');
    }

    /**
     * Otvorí modal s analýzou
     */
    function openAnalysisModal() {
        const text = getSourceText();
        
        const modal = document.createElement('div');
        modal.className = 'analysis-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <button class="modal-close" aria-label="Zavrieť">×</button>
                <h3>🔬 Analýza textu</h3>
                <div class="analysis-body">
                    <div class="analysis-left">
                        <div class="analysis-actions">
                            <button class="run-analysis-btn tool-btn">▶️ Spustiť analýzu</button>
                            <button class="show-preview-btn tool-btn">👁️ Preview zvýraznenia</button>
                            <button class="export-report-btn tool-btn">💾 Exportovať report</button>
                        </div>
                        <div class="analysis-metrics" aria-live="polite">
                            <div class="metrics-placeholder">
                                <p>Klikni na "Spustiť analýzu" pre zobrazenie metrík</p>
                            </div>
                        </div>
                    </div>
                    <div class="analysis-right">
                        <h4>Náhľad textu</h4>
                        <div class="analysis-preview preview-text">${escapeHtml(text)}</div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);

        // Close handlers
        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => modal.remove());
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Button handlers
        const runBtn = modal.querySelector('.run-analysis-btn');
        const previewBtn = modal.querySelector('.show-preview-btn');
        const exportBtn = modal.querySelector('.export-report-btn');
        const metricsEl = modal.querySelector('.analysis-metrics');
        const previewEl = modal.querySelector('.analysis-preview');

        let currentAnalysis = null;

        /**
         * Spustí analýzu textu
         */
        async function runAnalysis() {
            const source = getSourceText();
            if (!source || !source.trim()) {
                metricsEl.innerHTML = '<div class="error">❌ Žiadny text na analýzu. Vlož text do Importéra textu.</div>';
                return;
            }

            metricsEl.innerHTML = '<div class="loading">⏳ Analyzujem...</div>';

            try {
                // Prefer unified duplicateHandler, fallback na DuplicateHighlighter shim
                let duplicates = [];
                let duplicateCount = 0;

                if (window.duplicateHandler) {
                    const analysis = window.duplicateHandler.analyze(source);
                    duplicates = analysis.duplicates || [];
                    duplicateCount = duplicates.length;
                    previewEl.innerHTML = window.duplicateHandler.renderHighlighted(source, duplicates);
                } else if (window.DuplicateHighlighter) {
                    const highlighter = new window.DuplicateHighlighter();
                    const pairs = highlighter.findDuplicates(source);
                    duplicates = pairs.map(([word, count]) => ({ word, count }));
                    duplicateCount = duplicates.length;
                    previewEl.innerHTML = highlighter.highlightInHTML(source, pairs);
                } else {
                    previewEl.innerHTML = escapeHtml(source);
                }

                // Základné metriky
                const words = (source.toLowerCase().match(/\b[\p{L}\p{N}'-]+\b/gu) || []);
                const lines = source.split(/\r?\n/).filter(l => l.trim().length > 0);
                const uniqueWords = new Set(words).size;
                const vocabularyRichness = words.length > 0 ? ((uniqueWords / words.length) * 100).toFixed(1) : 0;
                const avgWordsPerLine = lines.length > 0 ? (words.length / lines.length).toFixed(1) : 0;

                currentAnalysis = {
                    source,
                    duplicates,
                    metrics: {
                        lines: lines.length,
                        words: words.length,
                        uniqueWords,
                        vocabularyRichness,
                        avgWordsPerLine,
                        duplicateCount
                    }
                };

                // Zobraz metriky
                let metricsHtml = `
                    <div class="metrics-card">
                        <h4>📊 Štatistiky</h4>
                        <table class="metrics-table">
                            <tr><td>Riadky:</td><td><strong>${lines.length}</strong></td></tr>
                            <tr><td>Slová celkom:</td><td><strong>${words.length}</strong></td></tr>
                            <tr><td>Unikátne slová:</td><td><strong>${uniqueWords}</strong></td></tr>
                            <tr><td>Bohatosť slovníka:</td><td><strong>${vocabularyRichness}%</strong></td></tr>
                            <tr><td>Priem. slov/riadok:</td><td><strong>${avgWordsPerLine}</strong></td></tr>
                        </table>
                    </div>
                `;

                if (duplicateCount > 0) {
                    metricsHtml += `
                        <div class="metrics-card duplicates-card">
                            <h4>🔍 Duplikované slová</h4>
                            <p class="duplicate-summary">
                                <span class="dup-badge warning">${duplicateCount} typov duplikátov</span>
                            </p>
                            <div class="duplicate-mini-list">
                                ${duplicates.slice(0, 5).map(([word, count], idx) => `
                                    <div class="dup-mini-item">
                                        <span class="rank">${idx + 1}</span>
                                        <span class="word">${word}</span>
                                        <span class="count">${count}×</span>
                                    </div>
                                `).join('')}
                                ${duplicateCount > 5 ? `<p class="more-info">... a ďalších ${duplicateCount - 5}</p>` : ''}
                            </div>
                        </div>
                    `;
                } else {
                    metricsHtml += `
                        <div class="metrics-card success-card">
                            <h4>✅ Bez duplikátov</h4>
                            <p>Text neobsahuje opakujúce sa slová.</p>
                        </div>
                    `;
                }

                metricsEl.innerHTML = metricsHtml;

            } catch (error) {
                console.error('Analysis error:', error);
                metricsEl.innerHTML = `<div class="error">❌ Chyba pri analýze: ${error.message}</div>`;
            }
        }

        /**
         * Zobrazí preview modal so zvýrazneným textom
         */
        function showPreviewModal() {
            if (!currentAnalysis) {
                alert('Najprv spusti analýzu');
                return;
            }

            const previewModal = document.createElement('div');
            previewModal.className = 'highlight-preview-modal';
            previewModal.innerHTML = `
                <div class="modal-content">
                    <button class="modal-close">×</button>
                    <h3>👁️ Preview zvýraznenia duplikátov</h3>
                    <div class="preview-text">${previewEl.innerHTML}</div>
                    <div style="padding:16px; text-align:right; border-top:1px solid var(--border-light);">
                        <button class="tool-btn copy-html-btn">📋 Kopírovať HTML</button>
                        <button class="tool-btn close-btn">Zavrieť</button>
                    </div>
                </div>
            `;

            document.body.appendChild(previewModal);

            previewModal.querySelector('.modal-close').addEventListener('click', () => previewModal.remove());
            previewModal.querySelector('.close-btn').addEventListener('click', () => previewModal.remove());
            
            previewModal.querySelector('.copy-html-btn').addEventListener('click', () => {
                const html = previewEl.innerHTML;
                navigator.clipboard.writeText(html).then(() => {
                    alert('✅ HTML skopírované do schránky');
                }).catch(err => {
                    console.error('Copy failed:', err);
                    alert('❌ Chyba pri kopírovaní');
                });
            });

            previewModal.addEventListener('click', (e) => {
                if (e.target === previewModal) previewModal.remove();
            });
        }

        /**
         * Exportuje report ako textový súbor
         */
        function exportReport() {
            if (!currentAnalysis) {
                alert('Najprv spusti analýzu');
                return;
            }

            const { metrics, duplicates } = currentAnalysis;
            
            let report = '═══════════════════════════════════════════════════\n';
            report += '           ANALÝZA TEXTU - REPORT\n';
            report += '═══════════════════════════════════════════════════\n\n';
            
            report += '📊 ŠTATISTIKY:\n';
            report += '─────────────────────────────────────────────────\n';
            report += `Riadky:              ${metrics.lines}\n`;
            report += `Slová celkom:        ${metrics.words}\n`;
            report += `Unikátne slová:      ${metrics.uniqueWords}\n`;
            report += `Bohatosť slovníka:   ${metrics.vocabularyRichness}%\n`;
            report += `Priem. slov/riadok:  ${metrics.avgWordsPerLine}\n\n`;
            
            if (metrics.duplicateCount > 0) {
                report += '🔍 DUPLIKOVANÉ SLOVÁ:\n';
                report += '─────────────────────────────────────────────────\n';
                report += `Počet typov duplikátov: ${metrics.duplicateCount}\n\n`;
                
                duplicates.forEach(([word, count], idx) => {
                    report += `${(idx + 1).toString().padStart(3, ' ')}. ${word.padEnd(20)} → ${count}× opakovaní\n`;
                });
            } else {
                report += '✅ TEXT NEOBSAHUJE DUPLIKOVANÉ SLOVÁ\n';
            }
            
            report += '\n═══════════════════════════════════════════════════\n';
            report += `Vygenerované: ${new Date().toLocaleString('sk-SK')}\n`;
            report += '═══════════════════════════════════════════════════\n';

            downloadTextFile('analysis-report.txt', report);
        }

        // Event listeners
        runBtn.addEventListener('click', runAnalysis);
        previewBtn.addEventListener('click', showPreviewModal);
        exportBtn.addEventListener('click', exportReport);

        // Auto-run ak existuje text
        if (text && text.trim()) {
            setTimeout(runAnalysis, 150);
        }
    }

    /**
     * Helper: Download text file
     */
    function downloadTextFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    /**
     * Helper: Escape HTML
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Inicializuje Analysis panel
     */
    function initAnalysisPanel() {
        const insertPoint = findInsertPoint();
        
        if (!insertPoint) {
            console.warn('⚠️ Analysis Panel: Insert point nenájdený');
            return;
        }

        // Avoid duplicate button
        if (document.querySelector('.analysis-trigger-btn')) {
            console.log('✓ Analysis button už existuje');
            return;
        }

        const btn = createAnalysisButton();

        // Preferuj vloženie do research panel headera
        if (insertPoint.classList.contains('research-panel') || insertPoint.id === 'research-panel') {
            const header = insertPoint.querySelector('.panel-header, h3, h2');
            if (header) {
                // Pridaj vedľa existujúcich tlačidiel v headeri
                header.style.display = 'flex';
                header.style.alignItems = 'center';
                header.style.gap = '8px';
                header.appendChild(btn);
            } else {
                insertPoint.insertBefore(btn, insertPoint.firstChild);
            }
        } else {
            insertPoint.appendChild(btn);
        }

        console.log('✅ Analysis Panel initialized');
    }

    // Export init function
    window.initAnalysisPanel = initAnalysisPanel;

    // Auto-init on DOM ready
    // if (document.readyState === 'loading') {
    //     document.addEventListener('DOMContentLoaded', initAnalysisPanel);
    // } else {
    //     // DOM already loaded
    //     setTimeout(initAnalysisPanel, 100);
    // }

})();
