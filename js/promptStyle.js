/**
 * Modul pre správu funkcionality "Prompt & Štýl".
 * Zabezpečuje načítavanie textu a spúšťanie ukladacieho mechanizmu.
 */
import { showNotification } from './utils.js';

let promptStyleInput = null;
let copyBtn = null;
let controller = null;

/**
 * Načíta text promptu a štýlu pre aktuálne aktívny projekt.
 */
function loadPromptStyle() {
  if (!controller || !promptStyleInput) return;
  // Dáta berieme priamo z Modelu, ktorý je vždy aktuálny
  promptStyleInput.value = controller.getModel().state.promptStyle || '';
}

/**
 * Uloží text do modelu a označí projekt ako "neuložený", čím spustí debounced save.
 */
function savePromptStyle() {
  if (!controller || !promptStyleInput) return;
  controller.getModel().state.promptStyle = promptStyleInput.value;
  controller._markAsDirty(); // Toto je kľúčové - spustí sa rovnaký save ako pri iných zmenách
}

export function initPromptStyle(ctrl) {
  controller = ctrl;
  promptStyleInput = document.getElementById('prompt-style-input');
  copyBtn = document.getElementById('copyPromptStyleBtn');

  if (promptStyleInput) {
    promptStyleInput.addEventListener('input', savePromptStyle);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      if (!promptStyleInput.value) return;

      navigator.clipboard.writeText(promptStyleInput.value)
        .then(() => showNotification('Prompt & Štýl skopírovaný!'))
        .catch(() => showNotification('Kopírovanie zlyhalo', 'danger'));
    });
  }

  return { loadPromptStyle };
}