
const SKIP_WORDS = new Set([
    'a', 'aj', 'ako', 'ale', 'aby', 'ani', 'ak',
    'do', 'da', 'de', 'di',
    'je', 'ja', 'ju', 'jej',
    'ku', 'ka', 'ki',
    'ma', 'mi', 'mu', 'me', 'mna', 'mne',
    'na', 'no', 'ni', 'nad',
    'od', 'o',
    'po', 'pre', 'pri', 'pred',
    'sa', 'si', 'so', 'sme', 'ste', 'som',
    'ta', 'to', 'ti', 'ty', 'te', 'tú', 'tu', 'ten',
    'v', 've', 'vo',
    'za', 'zo',
    'že', 'ze',
    'i', 'u', 'k', 's', 'z'
]);

const MIN_WORD_LENGTH = 4; // Slová s dĺžkou 4 a viac
const MIN_RHYME_MATCH = 2;

function reverseWord(word) {
    return word.split('').reverse().join('');
}

function normalizeText(text) {
    return text
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Odstránenie diakritiky
        .toLowerCase()
        .replace(/[.,!?;:„“"()[\]{}—–-]/g, ' ') // Zjednotená sada interpunkcie
        .replace(/\s+/g, ' ')
        .trim();
}

function extractWords(text) {
    const normalized = normalizeText(text);
    const words = normalized.split(' ');

    const uniqueWords = new Set();

    words.forEach(word => {
        const cleaned = word.trim();
        if (cleaned.length >= MIN_WORD_LENGTH && !SKIP_WORDS.has(cleaned)) { // Podmienka >= 4 teraz funguje správne
            uniqueWords.add(cleaned);
        }
    });

    return Array.from(uniqueWords);
}

function findRhymes(words) {
    const rhymeGroups = new Map();

    words.forEach(word => {
        const reversed = reverseWord(word);
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

export const RhymeAnalyzer = {
    extractWords,
    findRhymes
};
