/**
 * SYSTEM CHECK - Validácia implementácie
 * Kontroluje či sú všetky nové funkcie správne implementované
 */

(function() {
    'use strict';

    console.log('\n' + '='.repeat(70));
    console.log('🔍 === LBS LIVE SERVER - SYSTEM CHECK === 🔍');
    console.log('='.repeat(70) + '\n');

    const checks = [];
    let passed = 0;
    let failed = 0;

    // Helper funkcia na pridanie checku
    function addCheck(name, condition, details = '') {
        checks.push({ name, passed: condition, details });
        if (condition) {
            passed++;
            console.log(`✅ ${name}`);
            if (details) console.log(`   ${details}`);
        } else {
            failed++;
            console.log(`❌ ${name}`);
            if (details) console.log(`   ⚠️  ${details}`);
        }
    }

    // === CORE CHECKS ===
    console.log('\n📦 CORE MODULES:\n');

    addCheck(
        'DuplicateHighlighter class',
        typeof window.DuplicateHighlighter === 'function',
        'Class pre detekciu duplikátov'
    );

    addCheck(
        'SimpleTextComparator class',
        typeof window.SimpleTextComparator === 'function',
        'Class pre porovnanie projektov'
    );

    // === DOM CHECKS ===
    console.log('\n🎨 DOM ELEMENTS:\n');

    addCheck(
        'Text Importér textarea',
        !!document.getElementById('source-input'),
        'Hlavné textarea pre import textu'
    );

    addCheck(
        'Duplicate toolbar',
        !!document.querySelector('.importer-toolbar'),
        'Toolbar s tlačidlami pre duplikáty'
    );

    addCheck(
        'Highlight Duplicates button',
        !!document.getElementById('highlight-duplicates-btn'),
        'Tlačidlo na zvýraznenie duplikátov'
    );

    addCheck(
        'Show Report button',
        !!document.getElementById('show-duplicate-report-btn'),
        'Tlačidlo na zobrazenie reportu'
    );

    addCheck(
        'Duplicate counter',
        !!document.getElementById('duplicate-count'),
        'Počítadlo duplikátov'
    );

    addCheck(
        'Compare Projects button',
        !!document.querySelector('.compare-btn'),
        'Tlačidlo na porovnanie projektov'
    );

    // === CSS CHECKS ===
    console.log('\n🎨 CSS STYLESHEETS:\n');

    const stylesheets = Array.from(document.styleSheets).map(s => s.href);


    addCheck(
        'text-comparator.css',
        stylesheets.some(href => href && href.includes('text-comparator.css')),
        'Štýly pre project comparator'
    );

    // === FUNCTIONALITY CHECKS ===
    console.log('\n⚙️ FUNCTIONALITY:\n');

    // Test DuplicateHighlighter
    if (typeof window.DuplicateHighlighter === 'function') {
        try {
            const highlighter = new window.DuplicateHighlighter();
            const testText = 'test test word word';
            const duplicates = highlighter.findDuplicates(testText);
            
            addCheck(
                'DuplicateHighlighter.findDuplicates()',
                duplicates.length === 2 && duplicates[0][0] === 'test',
                `Našlo ${duplicates.length} duplikátov v testovacom texte`
            );

            const stats = highlighter.getStatistics(testText);
            addCheck(
                'DuplicateHighlighter.getStatistics()',
                stats.totalWords > 0,
                `Total words: ${stats.totalWords}, Unique: ${stats.uniqueWords}`
            );
        } catch (error) {
            addCheck(
                'DuplicateHighlighter methods',
                false,
                `Error: ${error.message}`
            );
        }
    }

    // Test SimpleTextComparator
    if (typeof window.SimpleTextComparator === 'function') {
        try {
            const comparator = new window.SimpleTextComparator();
            
            addCheck(
                'SimpleTextComparator instance',
                comparator instanceof window.SimpleTextComparator,
                'Inštancia vytvorená úspešne'
            );

            addCheck(
                'SimpleTextComparator.loadProject()',
                typeof comparator.loadProject === 'function',
                'Metóda pre načítanie projektu existuje'
            );

            addCheck(
                'SimpleTextComparator.compare()',
                typeof comparator.compare === 'function',
                'Metóda pre porovnanie existuje'
            );
        } catch (error) {
            addCheck(
                'SimpleTextComparator methods',
                false,
                `Error: ${error.message}`
            );
        }
    }

    // === INTEGRATION CHECKS ===
    console.log('\n🔗 INTEGRATION:\n');

    // Check if Controller has new methods
    addCheck(
        'Controller.enhanceTextImporter',
        window.Controller && typeof window.Controller.enhanceTextImporter === 'function',
        'Metóda v Controller existuje'
    );

    addCheck(
        'Controller.initProjectComparator',
        window.Controller && typeof window.Controller.initProjectComparator === 'function',
        'Metóda v Controller existuje'
    );

    // === SUMMARY ===
    console.log('\n' + '='.repeat(70));
    console.log('📊 VÝSLEDKY:\n');
    console.log(`   Úspešných testov: ${passed}`);
    console.log(`   Neúspešných testov: ${failed}`);
    console.log(`   Celkovo: ${passed + failed} testov`);
    console.log('\n   Úspešnosť: ${((passed / (passed + failed)) * 100).toFixed(1)}%');
    console.log('='.repeat(70));

    if (failed === 0) {
        console.log('\n🎉 VŠETKO FUNGUJE SPRÁVNE! Aplikácia je pripravená na použitie.\n');
        console.log('📝 Návod na použitie:');
        console.log('   1. Otvor "Importér Textu" a vlož text');
        console.log('   2. Klikni "🔍 Zvýrazniť Duplikáty" pre analýzu');
        console.log('   3. Klikni "📊 Report Duplikátov" pre detaily');
        console.log('   4. Použi "🔄 Porovnať Projekty" v headeri\n');
    } else {
        console.log('\n⚠️ NIEKTORÉ KOMPONENTY CHÝBAJÚ ALEBO NEFUNGUJÚ\n');
        console.log('🔧 Skontroluj:');
        console.log('   1. Či sú všetky súbory správne nahraté');
        console.log('   2. Či sú CSS a JS linky v index.html');
        console.log('   3. Či nie sú žiadne chyby v konzole (F12)\n');
    }

    // Store results in window for debugging
    window.SYSTEM_CHECK_RESULTS = {
        passed,
        failed,
        total: passed + failed,
        checks: checks,
        timestamp: new Date().toISOString()
    };

    console.log('💾 Výsledky uložené do: window.SYSTEM_CHECK_RESULTS\n');
})();
