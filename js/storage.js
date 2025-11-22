// Prompt & Style per project
const PROMPT_STYLE_KEY_PREFIX = 'lyricalBlueprint_promptstyle_';

export function loadPromptStyle(projectName) {
  if (!projectName) return '';
  return _read(PROMPT_STYLE_KEY_PREFIX + projectName) || '';
}

export function savePromptStyle(projectName, value) {
  if (!projectName) return;
  _write(PROMPT_STYLE_KEY_PREFIX + projectName, value || '');
}
// Unified storage module for projects and per-project research
import { PROJECT_KEY_PREFIX, RESEARCH_KEY_PREFIX, ACTIVE_PROJECT_KEY, META_KEY } from './constants.js';

const SCHEMA_VERSION = 1;

function _read(key){ return localStorage.getItem(key); }
function _write(key,val){ localStorage.setItem(key,val); }
function _remove(key){ localStorage.removeItem(key); }

export function init(){
  const metaRaw = _read(META_KEY);
  let meta = metaRaw ? JSON.parse(metaRaw) : { version: SCHEMA_VERSION };
  if(meta.version !== SCHEMA_VERSION){
    // place for migrations
    meta.version = SCHEMA_VERSION;
    _write(META_KEY, JSON.stringify(meta));
  } else if(!metaRaw){
    _write(META_KEY, JSON.stringify(meta));
  }
}

export function listProjects(){
  return Object.keys(localStorage)
    .filter(k => k.startsWith(PROJECT_KEY_PREFIX))
    .map(k => k.replace(PROJECT_KEY_PREFIX,''));
}

export function loadProject(name){
  const raw = _read(PROJECT_KEY_PREFIX+name);
  return raw ? JSON.parse(raw) : null;
}

export function saveProject(name,data){
  _write(PROJECT_KEY_PREFIX+name, JSON.stringify(data));
}

export function deleteProject(name){ _remove(PROJECT_KEY_PREFIX+name); _remove(RESEARCH_KEY_PREFIX+name); }

export function renameProject(oldName,newName){
  const data = _read(PROJECT_KEY_PREFIX+oldName);
  if(!data) return false;
  _write(PROJECT_KEY_PREFIX+newName, data);
  _remove(PROJECT_KEY_PREFIX+oldName);
  // move research if exists
  const r = _read(RESEARCH_KEY_PREFIX+oldName);
  if(r){ _write(RESEARCH_KEY_PREFIX+newName, r); _remove(RESEARCH_KEY_PREFIX+oldName); }
  return true;
}

export function setActive(name){ _write(ACTIVE_PROJECT_KEY, name); }
export function getActive(){ return _read(ACTIVE_PROJECT_KEY); }

// Research per project; migrate legacy global key if present
const LEGACY_RESEARCH_KEY = 'lyricalBlueprintResearch_v2.0';
export function loadResearch(projectName){
  if(!projectName) return '';
  let existing = _read(RESEARCH_KEY_PREFIX+projectName);
  if(existing) return existing;
  // migrate legacy global research only once
  const legacy = _read(LEGACY_RESEARCH_KEY);
  if(legacy){
    _write(RESEARCH_KEY_PREFIX+projectName, legacy);
    _remove(LEGACY_RESEARCH_KEY);
    return legacy;
  }
  return '';
}
export function saveResearch(projectName,text){ if(projectName) _write(RESEARCH_KEY_PREFIX+projectName, text); }

export function exportAll(){
  const projects = listProjects();
  const bundle = {
    version: SCHEMA_VERSION,
    projects: projects.map(name => ({
      name,
      data: loadProject(name) || { trackData:[], paletteItems:[] },
      research: loadResearch(name)
    }))
  };
  return JSON.stringify(bundle, null, 2);
}

export function importAll(json){
  let parsed;
  try { parsed = JSON.parse(json); } catch(e){ return { ok:false, error:'Invalid JSON' }; }
  if(!parsed.projects || !Array.isArray(parsed.projects)) return { ok:false, error:'Missing projects array' };
  parsed.projects.forEach(p => {
    saveProject(p.name, p.data);
    saveResearch(p.name, p.research||'');
  });
  return { ok:true, count: parsed.projects.length };
}
