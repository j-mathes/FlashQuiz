/* ============================================================
   FlashQuiz – app.js
   Plain vanilla JS (ES6+, "use strict")
   No frameworks, no build step.
   ============================================================ */
'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const APP_VERSION  = '4.5.4';
const DB_NAME      = 'FlashQuizDB';
const DB_VERSION   = 2;
const STORE_DS     = 'datasets';
const STORE_IMGS   = 'images';

// Default palette for auto-assigning level colours
const LEVEL_COLORS = ['#4a90d9','#27ae60','#e67e22','#8e44ad','#e74c3c','#16a085','#f39c12','#2c3e50'];

// Curated 56-colour palette for the visual colour picker (8 cols × 7 rows)
const COLOR_PALETTE = [
  '#000000','#434343','#666666','#999999','#b7b7b7','#cccccc','#e0e0e0','#ffffff',
  '#7f0000','#cc0000','#ea4335','#ff6d6d','#ff9999','#c2185b','#e91e63','#f8bbd0',
  '#4a0080','#7b1fa2','#9c27b0','#ba68c8','#7c4dff','#5c35cc','#3949ab','#9fa8da',
  '#0d47a1','#1565c0','#2196f3','#64b5f6','#006064','#0097a7','#00bcd4','#b2ebf2',
  '#004d40','#00796b','#009688','#4db6ac','#1b5e20','#388e3c','#4caf50','#a5d6a7',
  '#33691e','#689f38','#8bc34a','#dcedc8','#f57f17','#f9a825','#ffeb3b','#fff9c4',
  '#bf360c','#e64a19','#ff5722','#ffab91','#4e342e','#6d4c41','#795548','#d7ccc8',
];

// SVG icons used in the builder image buttons
const ICON_IMG_UPLOAD = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>`;
const ICON_IMG_LIBRARY = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`;

// Returns '#ffffff' or '#1a1a1a' for readable text on top of a hex colour.
function contrastColor(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.65 ? '#1a1a1a' : '#ffffff';
}

// Populate a level badge element from the row's level field.
function renderLevelBadge(el, row, levels) {
  if (!el) return;
  const def = (levels || []).find(l => l.name === row.level);
  if (!def || !row.level) { el.style.display = 'none'; el.textContent = ''; return; }
  el.textContent   = def.name;
  el.style.display = 'inline-flex';
  el.style.background = def.color;
  el.style.color   = contrastColor(def.color);
}

// ============================================================
// UTILITIES
// ============================================================
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtDate(iso) {
  const d = new Date(iso);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}
function fmtTime(iso) {
  const d  = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
function fmtDateTime(iso) {
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

/**
 * Parse a spreadsheet cell value into { type:'text'|'image', text?, src? }
 * Any lone URL is treated as an image reference (matches sample data pattern).
 */
function parseCell(value) {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  if (!v) return null;

  // data URI
  if (/^data:image\//i.test(v)) return { type: 'image', src: v };

  // [IMG:...] explicit tag
  const imgTag = v.match(/^\[IMG:(.*)\]$/i);
  if (imgTag) return { type: 'image', src: imgTag[1].trim() };

  // [LOCAL:name] – reference to the local Image Library
  const localTag = v.match(/^\[LOCAL:(.*)\]$/i);
  if (localTag) return { type: 'local-image', name: localTag[1].trim() };

  // Mixed: [IMG:url] or [LOCAL:name] on first/last line, rest is text
  const lines = v.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length >= 2) {
    const fImg   = lines[0].match(/^\[IMG:(.*)\]$/i);
    const fLocal = lines[0].match(/^\[LOCAL:(.*)\]$/i);
    const lImg   = lines[lines.length - 1].match(/^\[IMG:(.*)\]$/i);
    const lLocal = lines[lines.length - 1].match(/^\[LOCAL:(.*)\]$/i);
    const rest0  = lines.slice(1).join('\n');
    const restN  = lines.slice(0, -1).join('\n');
    if (fImg)   return { type: 'mixed', src: fImg[1].trim(),         text: rest0, imgPosition: 'before' };
    if (fLocal) return { type: 'mixed', localImage: fLocal[1].trim(), text: rest0, imgPosition: 'before' };
    if (lImg)   return { type: 'mixed', src: lImg[1].trim(),         text: restN, imgPosition: 'after' };
    if (lLocal) return { type: 'mixed', localImage: lLocal[1].trim(), text: restN, imgPosition: 'after' };
  }

  // bare URL – treat as image when it looks like one (sample data pattern)
  if (/^https?:\/\/\S+$/i.test(v)) return { type: 'image', src: v };

  // URL at start of cell followed by space+text (legacy inline format)
  const urlThenText = v.match(/^(https?:\/\/\S+)\s+([\s\S]+)$/i);
  if (urlThenText) return { type: 'mixed', src: urlThenText[1], text: urlThenText[2].trim(), imgPosition: 'before' };

  return { type: 'text', text: v };
}

/**
 * Render a CellContent object into a container element.
 */
function makeZoomable(img) {
  const wrap = document.createElement('span');
  wrap.className = 'img-zoom-wrap';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'img-zoom-btn';
  btn.setAttribute('aria-label', 'Zoom image');
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M1 5V1h4M8 1h4v4M12 8v4H8M5 12H1V8"/></svg>';
  btn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    Lightbox.show(img.src, img.alt);
  });
  wrap.appendChild(img);
  wrap.appendChild(btn);
  return wrap;
}

function renderCell(cell, container) {
  container.innerHTML = '';
  if (!cell) return;
  if (cell.type === 'image') {
    const img = document.createElement('img');
    img.src   = cell.src;
    img.alt   = '';
    img.className = 'cell-image';
    const zw = makeZoomable(img);
    img.onerror = () => {
      zw.remove();
      const err = document.createElement('div');
      err.className = 'image-error';
      err.textContent = '⚠ Image unavailable';
      container.appendChild(err);
    };
    container.appendChild(zw);
  } else if (cell.type === 'local-image') {
    // Show a placeholder, then async-swap once the image resolves from the library
    const ph = document.createElement('span');
    ph.className   = 'local-img-placeholder';
    ph.textContent = `⏳ ${cell.name}`;
    container.appendChild(ph);
    Storage.getImage(cell.name).then(imgRec => {
      if (!container.contains(ph)) return;
      container.innerHTML = '';
      if (imgRec) {
        const el = document.createElement('img');
        el.src       = imgRec.src;
        el.alt       = cell.name;
        el.className = 'cell-image';
        const zw = makeZoomable(el);
        el.onerror   = () => {
          zw.remove();
          const err = document.createElement('div');
          err.className   = 'image-error';
          err.textContent = `⚠ Image error: ${cell.name}`;
          container.appendChild(err);
        };
        container.appendChild(zw);
      } else {
        const err = document.createElement('div');
        err.className   = 'image-error';
        err.textContent = `⚠ Library image not found: ${cell.name}`;
        container.appendChild(err);
      }
    });
  } else if (cell.type === 'mixed') {
    const img = document.createElement('img');
    img.src       = cell.src;
    img.alt       = cell.text || '';
    img.className = 'cell-image';
    const zw = makeZoomable(img);
    img.onerror   = () => {
      zw.remove();
      const err = document.createElement('div');
      err.className   = 'image-error';
      err.textContent = '⚠ Image unavailable';
      container.appendChild(err);
    };
    const txt = document.createElement('p');
    txt.className   = 'cell-mixed-text';
    txt.innerHTML   = inlineMarkdown(cell.text);
    if (cell.imgPosition === 'inline') {
      const wrap = document.createElement('div');
      wrap.className = 'cell-mixed-inline';
      wrap.appendChild(zw);
      wrap.appendChild(txt);
      container.appendChild(wrap);
    } else if (cell.imgPosition === 'after') {
      container.appendChild(txt);
      container.appendChild(zw);
    } else {
      container.appendChild(zw);
      container.appendChild(txt);
    }
  } else {
    container.innerHTML = inlineMarkdown(cell.text);
  }
}

/** Short text label for a cell (used in reports, feedback) */
function cellLabel(cell) {
  if (!cell) return '';
  if (cell.type === 'image') return '[Image]';
  if (cell.type === 'local-image') return `[${cell.name}]`;
  if (cell.type === 'mixed') return `${cell.text}`;
  return cell.text;
}

/**
 * Convert a plain-text cell string to safe inline HTML.
 * Supports: **bold**, *italic*, `code`, ~~strikethrough~~, and \n line breaks.
 * HTML is escaped first so no raw markup can slip through.
 */
function inlineMarkdown(text) {
  if (!text) return '';
  let s = esc(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g,     '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g,     '<code>$1</code>');
  s = s.replace(/~~(.+?)~~/g,     '<del>$1</del>');
  s = s.replace(/\n/g,            '<br>');
  return s;
}

/** Display image src for a cell, or null if the cell has no image. */
function cellImgSrc(cell) {
  if (!cell) return null;
  if ((cell.type === 'image' || cell.type === 'mixed') && cell.src) return cell.src;
  return null;
}

/** Read a File as ArrayBuffer */
function readFileBuffer(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = e => resolve(e.target.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(file);
  });
}

/** Read a File as text */
function readFileText(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = e => resolve(e.target.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsText(file);
  });
}

/** Convert an image File to a base64 data URI */
function fileToDataURI(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = e => resolve(e.target.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

// ============================================================
// STORAGE  (localStorage + IndexedDB)
// ============================================================
const Storage = (() => {
  let _db = null;

  function lsGet(key, def = null) {
    try {
      const v = localStorage.getItem('fq_' + key);
      return v !== null ? JSON.parse(v) : def;
    } catch { return def; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem('fq_' + key, JSON.stringify(val)); return true; }
    catch (e) { console.warn('localStorage write failed:', e); return false; }
  }
  function lsDel(key) { localStorage.removeItem('fq_' + key); }

  function idbTx(store, mode) {
    if (!_db) throw new Error('IndexedDB not ready');
    return _db.transaction(store, mode).objectStore(store);
  }
  function idbPut(store, val) {
    return new Promise((res, rej) => {
      const req = idbTx(store, 'readwrite').put(val);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  }
  function idbGet(store, key) {
    return new Promise((res, rej) => {
      if (!_db) { res(null); return; }
      const req = idbTx(store, 'readonly').get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror   = () => rej(req.error);
    });
  }
  function idbDel(store, key) {
    return new Promise((res, rej) => {
      if (!_db) { res(); return; }
      const req = idbTx(store, 'readwrite').delete(key);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  }

  async function initDB() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_DS)) {
          db.createObjectStore(STORE_DS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_IMGS)) {
          db.createObjectStore(STORE_IMGS, { keyPath: 'name' });
        }
      };
      req.onsuccess = e => { _db = e.target.result; res(); };
      req.onerror   = () => rej(req.error);
    });
  }

  async function saveDataset(ds) {
    await idbPut(STORE_DS, ds);
    const metas = lsGet('ds_meta', []);
    const meta  = { id: ds.id, name: ds.name, createdAt: ds.createdAt, rowCount: ds.rows.length };
    const idx   = metas.findIndex(m => m.id === ds.id);
    if (idx >= 0) metas[idx] = meta; else metas.push(meta);
    lsSet('ds_meta', metas);
  }
  async function getDataset(id) { return idbGet(STORE_DS, id); }
  async function deleteDataset(id) {
    await idbDel(STORE_DS, id);
    lsSet('ds_meta', lsGet('ds_meta', []).filter(m => m.id !== id));
  }
  function getDatasetMetas() { return lsGet('ds_meta', []); }

  // ── Image Library ──────────────────────────────────────────
  async function saveImage(name, src, group = '') {
    return idbPut(STORE_IMGS, { name, src, group, uploadedAt: new Date().toISOString() });
  }
  async function getImage(name)    { return idbGet(STORE_IMGS, name); }
  async function deleteImage(name) { return idbDel(STORE_IMGS, name); }
  async function getAllImages() {
    return new Promise((res, rej) => {
      if (!_db) { res([]); return; }
      const req = idbTx(STORE_IMGS, 'readonly').getAll();
      req.onsuccess = () => res((req.result || []).sort((a, b) => a.name.localeCompare(b.name)));
      req.onerror   = () => rej(req.error);
    });
  }
  async function updateImagesGroup(oldGroup, newGroup) {
    const all = await getAllImages();
    const hits = all.filter(img => (img.group || '') === oldGroup);
    await Promise.all(hits.map(img => idbPut(STORE_IMGS, { ...img, group: newGroup })));
  }
  async function deleteImagesByGroup(group) {
    const all = await getAllImages();
    const hits = all.filter(img => (img.group || '') === group);
    await Promise.all(hits.map(img => idbDel(STORE_IMGS, img.name)));
  }

  function getUsers()         { return lsGet('users', []); }
  function saveUsers(u)       { lsSet('users', u); }
  function getCurrentUser()   { return lsGet('cur_user', null); }
  function setCurrentUser(u)  { lsSet('cur_user', u); }

  function getSessions()      { return lsGet('sessions', []); }
  function addSession(s)      { const ss = getSessions(); ss.push(s); lsSet('sessions', ss); }
  function clearSessions()    { lsDel('sessions'); }

  return {
    initDB, saveDataset, getDataset, deleteDataset, getDatasetMetas,
    saveImage, getImage, deleteImage, getAllImages, updateImagesGroup, deleteImagesByGroup,
    getUsers, saveUsers, getCurrentUser, setCurrentUser,
    getSessions, addSession, clearSessions,
    lsGet, lsSet, lsDel
  };
})();

// ============================================================
// IMAGE GROUP ZIP EXPORT
// ============================================================
async function exportGroupZip(groupName, images) {
  if (!window.JSZip) { Toast.show('ZIP library unavailable (offline?)', 'warning'); return; }
  const zip = new window.JSZip();
  images.forEach(img => {
    const m = img.src.match(/^data:[^;]+;base64,(.+)$/);
    if (m) zip.file(img.name, m[1], { base64: true });
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = (groupName || 'General') + '.zip'; a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// ZIP IMAGE HELPER
// ============================================================
/** Convert an ArrayBuffer + filename to a base64 data URI */
async function arrBufToDataURI(arrBuf, filename) {
  const ext  = (filename.split('.').pop() || '').toLowerCase();
  const mime = { jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif',
                 webp:'image/webp', svg:'image/svg+xml', bmp:'image/bmp',
                 tif:'image/tiff', tiff:'image/tiff' }[ext] || 'image/' + ext;
  return new Promise(res => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.readAsDataURL(new Blob([arrBuf], { type: mime }));
  });
}

// ============================================================
// BUNDLE EXPORT  (deck CSV + referenced library images as ZIP)
// ============================================================
async function exportBundle(ds, filename, bundleFmt = 'csv') {
  if (!window.JSZip) { Toast.show('ZIP library unavailable (offline?)', 'warning'); return; }

  const deckName = filename || ds.name || 'deck';

  // Collect every local library image reference in the deck
  const localNames = new Set();
  const collectCell = c => {
    if (!c) return;
    if (c.type === 'local-image') localNames.add(c.name);
    if (c.type === 'image'  && c.fromLibrary) localNames.add(c.fromLibrary);
    if (c.type === 'mixed'  && c.fromLibrary) localNames.add(c.fromLibrary);
    if (c.type === 'mixed'  && c.localImage)  localNames.add(c.localImage);
  };
  ds.rows.forEach(r => {
    collectCell(r.question);
    collectCell(r.correctAnswer);
    (r.wrongAnswers || []).forEach(collectCell);
  });

  const zip = new window.JSZip();

  // Deck file (named after deck, CSV or XLSX)
  if (bundleFmt === 'xlsx' && typeof XLSX === 'undefined') {
    Toast.show('SheetJS not loaded \u2014 bundling as CSV instead', 'warning');
    bundleFmt = 'csv';
  }
  if (bundleFmt === 'xlsx') {
    const hasLevels = ds.levels && ds.levels.length > 0;
    const toCell = c => {
      if (!c) return '';
      if (c.type === 'local-image') return `[LOCAL:${c.name}]`;
      if (c.type === 'mixed') {
        const imgPart = c.fromLibrary ? `[LOCAL:${c.fromLibrary}]`
          : (c.localImage ? `[LOCAL:${c.localImage}]` : `[IMG:${c.src}]`);
        return c.imgPosition === 'after' ? `${c.text}\n${imgPart}` : `${imgPart}\n${c.text}`;
      }
      if (c.type === 'image') return c.fromLibrary ? `[LOCAL:${c.fromLibrary}]` : c.src;
      return c.text;
    };
    const xlsxRows = ds.rows.map(r => {
      const cells = [toCell(r.question), toCell(r.correctAnswer), ...r.wrongAnswers.map(toCell)];
      if (hasLevels) {
        cells.unshift(typeof r.reference === 'string' ? (r.reference || '') : toCell(r.reference));
        cells.unshift(r.level || '');
      }
      return cells;
    });
    if (hasLevels) xlsxRows.unshift(['Level', 'Reference', 'Question', 'Correct Answer']);
    const ws = XLSX.utils.aoa_to_sheet(xlsxRows);
    Object.keys(ws).filter(k => !k.startsWith('!')).forEach(k => { ws[k].s = { alignment: { wrapText: true } }; });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    zip.file(deckName + '.xlsx', buf);
  } else {
    const csv = DataExport.datasetToCSV(ds);
    zip.file(deckName + '.csv', '\uFEFF' + csv);
  }

  // Referenced library images under images/
  let missing = 0;
  const imageList = [];
  for (const name of localNames) {
    const imgRec = await Storage.getImage(name);
    if (!imgRec) { missing++; imageList.push(`  MISSING: images/${name}`); continue; }
    const m = imgRec.src.match(/^data:[^;]+;base64,(.+)$/);
    if (m) {
      zip.file('images/' + name, m[1], { base64: true });
      imageList.push(`  images/${name}`);
    }
  }

  // Manifest
  const now    = new Date();
  const pad    = n => String(n).padStart(2, '0');
  const ts     = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const created = ds.createdAt ? ds.createdAt.replace('T', ' ').replace(/\..+/, '') : 'unknown';
  const deckFile = deckName + (bundleFmt === 'xlsx' ? '.xlsx' : '.csv');
  const levelNames = ds.levels && ds.levels.length ? ds.levels.map(l => l.name).join(', ') : 'none';
  const manifest = [
    'FlashQuiz Bundle Manifest',
    '='.repeat(40),
    `Deck name:   ${ds.name}`,
    `Created:     ${created}`,
    `Exported:    ${ts}`,
    `Questions:   ${ds.rows.length}`,
    `Levels:      ${levelNames}`,
    `Deck format: ${bundleFmt.toUpperCase()}`,
    '',
    'Files included:',
    `  ${deckFile}`,
    ...imageList,
    '',
    missing
      ? `WARNING: ${missing} image(s) referenced in deck not found in library and not included.`
      : 'All referenced images included.',
  ].join('\r\n');
  zip.file('manifest.txt', manifest);

  const blob = await zip.generateAsync({ type: 'blob' });
  DataExport._dl(blob, deckName + '.zip');
  if (missing) Toast.show(`${missing} image(s) not found in library \u2014 omitted from bundle`, 'warning');
}

// ============================================================
// SETTINGS
// ============================================================
const Settings = (() => {
  const KEY = 'settings';
  const DEFAULTS = {
    theme:              'light',   // 'light' | 'dark'
    questionFontSize:   'md',      // 'sm' | 'md' | 'lg' | 'xl'
    questionFontFamily: 'system',  // 'system' | 'serif' | 'mono'
    questionFontWeight: 'bold',    // 'normal' | 'bold'
    questionFontStyle:  'normal',  // 'normal' | 'italic'
    answerFontSize:     'md',      // 'sm' | 'md' | 'lg' | 'xl'
    answerFontFamily:   'system',  // 'system' | 'serif' | 'mono'
    answerFontWeight:   'normal',  // 'normal' | 'bold'
    answerFontStyle:    'normal',  // 'normal' | 'italic'
    verdictFontSize:   'md',      // 'sm' | 'md' | 'lg' | 'xl'
    verdictFontFamily: 'system',  // 'system' | 'serif' | 'mono'
    verdictFontWeight: 'bold',    // 'normal' | 'bold'
    verdictFontStyle:  'normal',  // 'normal' | 'italic'
    feedbackFontSize:   'sm',      // 'sm' | 'md' | 'lg' | 'xl'
    feedbackFontFamily: 'system',  // 'system' | 'serif' | 'mono'
    feedbackFontWeight: 'normal',  // 'normal' | 'bold'
    feedbackFontStyle:  'italic',  // 'normal' | 'italic'
    flipSpeed:          'normal',  // 'fast' | 'normal' | 'slow' | 'none'
    reportRowEven:      '#ffffff',  // report attempt row – even
    reportRowOdd:       '#f3f4f6',  // report attempt row – odd
  };

  function load() {
    return Object.assign({}, DEFAULTS, Storage.lsGet(KEY) || {});
  }

  function save(prefs) {
    Storage.lsSet(KEY, prefs);
  }

  function apply(prefs) {
    prefs = prefs || load();
    const body = document.body;

    body.classList.toggle('theme-dark', prefs.theme === 'dark');

    const fontSizeMap   = { sm: '.95rem', md: '1.2rem', lg: '1.5rem', xl: '1.9rem' };
    const fontFamilyMap = {
      system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      serif:  "Georgia, 'Times New Roman', serif",
      mono:   "Consolas, 'Courier New', monospace",
    };
    const fontWeightMap  = { normal: '400', bold: '700' };
    const fontStyleMap   = { normal: 'normal', italic: 'italic' };
    const flipDurationMap = { fast: '.2s', normal: '.55s', slow: '1s', none: '0s' };

    body.style.setProperty('--q-font-size',   fontSizeMap[prefs.questionFontSize]     || fontSizeMap.md);
    body.style.setProperty('--q-font-family', fontFamilyMap[prefs.questionFontFamily] || fontFamilyMap.system);
    body.style.setProperty('--q-font-weight', fontWeightMap[prefs.questionFontWeight] || '700');
    body.style.setProperty('--q-font-style',  fontStyleMap[prefs.questionFontStyle]   || 'normal');
    body.style.setProperty('--a-font-size',   fontSizeMap[prefs.answerFontSize]         || fontSizeMap.md);
    body.style.setProperty('--a-font-family', fontFamilyMap[prefs.answerFontFamily]     || fontFamilyMap.system);
    body.style.setProperty('--a-font-weight', fontWeightMap[prefs.answerFontWeight]     || '400');
    body.style.setProperty('--a-font-style',  fontStyleMap[prefs.answerFontStyle]       || 'normal');
    body.style.setProperty('--v-font-size',   fontSizeMap[prefs.verdictFontSize]        || fontSizeMap.md);
    body.style.setProperty('--v-font-family', fontFamilyMap[prefs.verdictFontFamily]    || fontFamilyMap.system);
    body.style.setProperty('--v-font-weight', fontWeightMap[prefs.verdictFontWeight]    || '700');
    body.style.setProperty('--v-font-style',  fontStyleMap[prefs.verdictFontStyle]      || 'normal');
    body.style.setProperty('--f-font-size',   fontSizeMap[prefs.feedbackFontSize]       || fontSizeMap.sm);
    body.style.setProperty('--f-font-family', fontFamilyMap[prefs.feedbackFontFamily]   || fontFamilyMap.system);
    body.style.setProperty('--f-font-weight', fontWeightMap[prefs.feedbackFontWeight]   || '400');
    body.style.setProperty('--f-font-style',  fontStyleMap[prefs.feedbackFontStyle]     || 'italic');
    body.style.setProperty('--flip-duration', flipDurationMap[prefs.flipSpeed] || flipDurationMap.normal);
    body.style.setProperty('--rpt-row-even', prefs.reportRowEven || '#ffffff');
    body.style.setProperty('--rpt-row-odd',  prefs.reportRowOdd  || '#f3f4f6');
  }

  return { DEFAULTS, load, save, apply };
})();

// ============================================================
// APP STATE
// ============================================================
const State = {
  currentUser: null,
  // flashcard
  fc: { datasetId: null, questions: [], idx: 0, flipped: false },
  // quiz
  qz: {
    datasetId: null, datasetName: null,
    questions: [],      // all Q objects for this deck
    pool: [],           // current round pool (shuffled subset)
    idx: 0,
    results: [],        // { qId, correct, selectedText } for current round
    allAttempts: [],    // { qId, round, correct, selectedText, questionLabel, correctLabel }
    score: { correct: 0, total: 0 },
    round: 1,
    answered: false,
    sessionId: null,
    startedAt: null,
  },
  // builder
  bld: { editingId: null, filterMissingImgs: false, missingImgIds: null, filterMissingLevels: false, filterLevels: new Set(), searchText: '', selectedIds: new Set(), lastCheckedId: null }
};
// levels are stored on State.fc.levels / State.qz.levels when a deck is loaded

// ============================================================
// ROUTER
// ============================================================
const Router = {
  navigate(view) {
    // Check if the current view wants to intercept navigation
    const currentActive = document.querySelector('.view.active');
    const currentView   = currentActive ? currentActive.id.replace('view-', '') : null;
    if (currentView && currentView !== view && Views[currentView] && Views[currentView].onBeforeLeave) {
      const proceed = Views[currentView].onBeforeLeave(() => Router.navigate(view));
      if (proceed === false) return;
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const el = document.getElementById('view-' + view);
    if (el) el.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.getElementById('app-nav').classList.remove('open');
    document.getElementById('hamburger').setAttribute('aria-expanded', 'false');

    const fn = Views[view] && Views[view].onEnter;
    if (fn) fn();
  }
};

// ============================================================
// TOAST
// ============================================================
const Toast = {
  show(msg, type = 'info', ms = 3000) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className   = `toast toast-${type}`;
    t.textContent = msg;
    c.appendChild(t);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => t.classList.add('toast-visible'));
    });
    setTimeout(() => {
      t.classList.remove('toast-visible');
      t.addEventListener('transitionend', () => t.remove(), { once: true });
    }, ms);
  },

  /** Persistent toast: stays until dismissed. Includes copy-to-clipboard and ✕ button. */
  showPersistent(msg, type = 'warning') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type} toast-persistent`;

    const text = document.createElement('span');
    text.className   = 'toast-text';
    text.textContent = msg;

    const copy = document.createElement('button');
    copy.className   = 'toast-btn';
    copy.title       = 'Copy to clipboard';
    copy.textContent = '📋';
    copy.addEventListener('click', () => {
      navigator.clipboard.writeText(msg).then(() => {
        copy.textContent = '✓';
        setTimeout(() => { copy.textContent = '📋'; }, 1500);
      });
    });

    const dismiss = document.createElement('button');
    dismiss.className   = 'toast-btn';
    dismiss.title       = 'Dismiss';
    dismiss.textContent = '✕';
    dismiss.addEventListener('click', () => {
      t.classList.remove('toast-visible');
      t.addEventListener('transitionend', () => t.remove(), { once: true });
    });

    t.appendChild(text);
    t.appendChild(copy);
    t.appendChild(dismiss);
    c.appendChild(t);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => t.classList.add('toast-visible'));
    });
  }
};

// ============================================================
// MODAL
// ============================================================
const Modal = {
  show({ title, body, buttons = [], wide = false }) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML   = '';
    const box = document.querySelector('.modal-box');
    box.classList.toggle('modal-box--wide', wide);
    if (typeof body === 'string') {
      const p = document.createElement('p');
      p.textContent = body;
      document.getElementById('modal-body').appendChild(p);
    } else if (body instanceof HTMLElement) {
      document.getElementById('modal-body').appendChild(body);
    }
    const actions = document.getElementById('modal-actions');
    actions.innerHTML = '';
    buttons.forEach(btn => {
      const b = document.createElement('button');
      b.textContent = btn.label;
      b.className   = 'btn ' + (btn.cls || 'btn-secondary');
      b.onclick = () => { Modal.hide(); if (btn.action) btn.action(); };
      actions.appendChild(b);
    });
    document.getElementById('modal-overlay').classList.remove('hidden');
  },
  hide() { document.getElementById('modal-overlay').classList.add('hidden'); },
  confirm(title, body, onOk, okLabel = 'Confirm', okCls = 'btn-primary') {
    Modal.show({
      title, body,
      buttons: [
        { label: 'Cancel' },
        { label: okLabel, cls: okCls, action: onOk }
      ]
    });
  }
};

// ============================================================
// LIGHTBOX
// ============================================================
const Lightbox = {
  _resetZoom: null,   // set by the pan/zoom handler below
  show(src, alt) {
    const lb  = document.getElementById('img-lightbox');
    const img = document.getElementById('img-lightbox-img');
    if (Lightbox._resetZoom) Lightbox._resetZoom();
    img.src = src;
    img.alt = alt || '';
    lb.classList.remove('hidden');
  },
  hide() {
    const lb  = document.getElementById('img-lightbox');
    const img = document.getElementById('img-lightbox-img');
    lb.classList.add('hidden');
    img.src = '';
    if (Lightbox._resetZoom) Lightbox._resetZoom();
  }
};

// ============================================================
// FILE PARSING
// ============================================================
const FileParser = {
  /** Convert a 2-D array of cell values into a Dataset object */
  rawToDataset(rawRows, name) {
    const rows = [];
    const levelMap = new Map(); // name -> color (insertion-ordered)

    // Detect new format: first non-empty row whose first cell is 'level' (header row)
    const firstNonEmpty = rawRows.findIndex(r => r && r.length > 0);
    let hasLevelCol = false;
    let dataStart   = 0;
    let refColIdx   = -1;
    if (firstNonEmpty >= 0) {
      const firstRow = rawRows[firstNonEmpty];
      if (String(firstRow[0] || '').trim().toLowerCase() === 'level') {
        hasLevelCol = true;
        dataStart   = firstNonEmpty + 1;
        // Scan for optional 'reference' column in header
        const headers = firstRow.map(h => String(h || '').trim().toLowerCase());
        refColIdx = headers.findIndex(h => h === 'reference' || h === 'ref');
      }
    }

    for (let ri = dataStart; ri < rawRows.length; ri++) {
      const raw = rawRows[ri];
      if (!raw || raw.length === 0) continue;
      let off  = hasLevelCol ? 1 : 0;
      // If the reference column falls immediately before the question slot, shift past it
      if (refColIdx >= 0 && refColIdx === off) off++;
      const levelName = hasLevelCol ? String(raw[0] || '').trim() : '';
      const q = parseCell(raw[off]);
      if (!q) continue;
      const correct = parseCell(raw[off + 1]);
      if (!correct) continue;
      const wrong = [];
      for (let i = off + 2; i < raw.length; i++) {
        const c = parseCell(raw[i]);
        if (c) wrong.push(c);
      }
      const reference = refColIdx >= 0 ? (parseCell(String(raw[refColIdx] || '').trim()) || null) : null;
      if (levelName && !levelMap.has(levelName)) {
        levelMap.set(levelName, LEVEL_COLORS[levelMap.size % LEVEL_COLORS.length]);
      }
      rows.push({ id: genId(), level: levelName, question: q, correctAnswer: correct, wrongAnswers: wrong, reference });
    }

    const levels = Array.from(levelMap.entries()).map(([name, color]) => ({ name, color }));
    return { id: genId(), name, createdAt: new Date().toISOString(), levels, rows };
  },

  /** Parse a CSV string into a 2-D array */
  parseCSV(text) {
    const rows = [];
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) rows.push(FileParser._csvLine(line));
    }
    return rows;
  },
  _csvLine(line) {
    const cells = []; let cur = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    return cells;
  },

  /** Parse Excel ArrayBuffer using SheetJS */
  parseExcel(buf, name) {
    if (typeof XLSX === 'undefined') throw new Error(
      'Excel support requires the SheetJS library. Please connect to the internet, or save your file as CSV.'
    );
    const wb  = XLSX.read(buf, { type: 'array' });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    return FileParser.rawToDataset(raw, name);
  },
};

// ============================================================
// DATA EXPORT
// ============================================================
const DataExport = {
  _sampleRows() {
    return [
      ['Level', 'Reference', 'Question', 'Correct Answer', 'Wrong 1', 'Wrong 2', 'Wrong 3'],
      ['Easy',   'France is a country in Western Europe; Paris has been its capital since 987 AD.', 'What is the capital of France?', 'Paris', 'London', 'Berlin', 'Madrid'],
      ['Easy',   '', 'Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Earth', 'Mars'],
      ['Medium', '', 'What is 7 × 8?', '56', '48', '54', '64'],
      ['Medium', 'Written circa 1594–1596; one of Shakespeare\'s most famous tragedies.', 'Who wrote "Romeo and Juliet"?', 'William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Mark Twain'],
      ['Medium', 'H₂O = 2 hydrogen atoms bonded to 1 oxygen atom.', 'What is the chemical symbol for water?', 'H2O', 'CO2', 'O2', 'H2SO4'],
      ['Hard',   '', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Eiffel_Tower_20051010.jpg/320px-Eiffel_Tower_20051010.jpg',
        'Eiffel Tower', 'Big Ben', 'Statue of Liberty', 'Colosseum'],
      ['Hard',   '', 'Which element has the atomic number 1?', 'Hydrogen', 'Helium', 'Lithium', 'Carbon'],
      ['',       '', 'How many sides does a hexagon have?', '6', '5', '7', '8'],
      ['',       '', 'What is the largest ocean on Earth?', 'Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'],
    ];
  },

  _toCSV(rows) {
    return rows.map(r =>
      r.map(c => {
        const s = String(c);
        return (s.includes(',') || s.includes('"') || s.includes('\n'))
          ? '"' + s.replace(/"/g, '""') + '"'
          : s;
      }).join(',')
    ).join('\r\n');
  },

  downloadCSV() {
    const csv  = DataExport._toCSV(DataExport._sampleRows());
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
    DataExport._dl(blob, 'sample-flashquiz.csv');
  },

  downloadXLSX() {
    if (typeof XLSX === 'undefined') {
      Toast.show('Excel export requires the SheetJS library. Use CSV instead.', 'warning');
      return;
    }
    const rows = DataExport._sampleRows();
    const ws   = XLSX.utils.aoa_to_sheet(rows);
    const wb   = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const buf  = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    DataExport._dl(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'sample-flashquiz.xlsx');
  },

  /** Export a dataset from IndexedDB/state as CSV */
  datasetToCSV(ds) {
    const hasLevels = ds.levels && ds.levels.length > 0;
    const toCell = c => {
      if (!c) return '';
      if (c.type === 'local-image') return `[LOCAL:${c.name}]`;
      if (c.type === 'mixed') {
        const imgPart = c.fromLibrary ? `[LOCAL:${c.fromLibrary}]`
          : (c.localImage ? `[LOCAL:${c.localImage}]` : `[IMG:${c.src}]`);
        return c.imgPosition === 'after' ? `${c.text}\n${imgPart}` : `${imgPart}\n${c.text}`;
      }
      if (c.type === 'image') return c.fromLibrary ? `[LOCAL:${c.fromLibrary}]` : c.src;
      return c.text;
    };
    const rows = ds.rows.map(r => {
      const cells = [toCell(r.question), toCell(r.correctAnswer), ...r.wrongAnswers.map(toCell)];
      if (hasLevels) {
        cells.unshift(typeof r.reference === 'string' ? (r.reference || '') : toCell(r.reference)); // reference before question
        cells.unshift(r.level || '');     // level before reference
      }
      return cells;
    });
    if (hasLevels) rows.unshift(['Level', 'Reference', 'Question', 'Correct Answer']);
    return DataExport._toCSV(rows);
  },

  datasetToXLSX(ds, filename) {
    const hasLevels = ds.levels && ds.levels.length > 0;
    const toCell = c => {
      if (!c) return '';
      if (c.type === 'local-image') return `[LOCAL:${c.name}]`;
      if (c.type === 'mixed') {
        const imgPart = c.fromLibrary ? `[LOCAL:${c.fromLibrary}]`
          : (c.localImage ? `[LOCAL:${c.localImage}]` : `[IMG:${c.src}]`);
        return c.imgPosition === 'after' ? `${c.text}\n${imgPart}` : `${imgPart}\n${c.text}`;
      }
      if (c.type === 'image') return c.fromLibrary ? `[LOCAL:${c.fromLibrary}]` : c.src;
      return c.text;
    };
    const rows = ds.rows.map(r => {
      const cells = [toCell(r.question), toCell(r.correctAnswer), ...r.wrongAnswers.map(toCell)];
      if (hasLevels) {
        cells.unshift(typeof r.reference === 'string' ? (r.reference || '') : toCell(r.reference)); // reference before question
        cells.unshift(r.level || '');     // level before reference
      }
      return cells;
    });
    if (hasLevels) rows.unshift(['Level', 'Reference', 'Question', 'Correct Answer']);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    Object.keys(ws).filter(k => !k.startsWith('!')).forEach(k => {
      ws[k].s = { alignment: { wrapText: true } };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    DataExport._dl(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), (filename || ds.name || 'deck') + '.xlsx');
  },

  _dl(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
};

// ============================================================
// BACKUP
// ============================================================
const Backup = {

  // Returns all users who have a saved in-progress quiz snapshot.
  // Pass an array of userIds to restrict, or omit to check all users.
  _getProgressSnapshots(userIds) {
    const users = userIds
      ? Storage.getUsers().filter(u => userIds.includes(u.id))
      : Storage.getUsers();
    return users
      .map(u => ({ key: 'quiz_progress_' + u.id, snap: Storage.lsGet('quiz_progress_' + u.id, null), user: u }))
      .filter(({ snap }) => snap !== null);
  },

  export() {
    const snaps = Backup._getProgressSnapshots();
    if (!snaps.length) { Backup._doExport(false); return; }

    const listHtml = snaps.map(({ snap, user }) =>
      `<li>${esc(user.name)}: <em>${esc(snap.datasetName || 'Unknown deck')}</em></li>`
    ).join('');
    const bodyEl = document.createElement('div');
    bodyEl.style.fontSize = '.95rem';
    bodyEl.style.lineHeight = '1.8';
    bodyEl.innerHTML =
      `<p><strong>${snaps.length}</strong> in-progress quiz(es) found:</p>` +
      `<ul style="margin:.4rem 0 .75rem 1.25rem">${listHtml}</ul>` +
      `<p style="font-size:.85rem;color:var(--clr-warning)">⚠ The matching quiz deck must already exist on the target device — deck data is not included in the export.</p>`;
    Modal.show({
      title: 'Include In-Progress Quizzes?',
      body:  bodyEl,
      buttons: [
        { label: 'Skip',    action: () => Backup._doExport(false) },
        { label: 'Include', cls: 'btn-primary', action: () => Backup._doExport(true) }
      ]
    });
  },

  _doExport(includeProgress) {
    const backup = {
      version:    1,
      exportedAt: new Date().toISOString(),
      users:      Storage.getUsers(),
      sessions:   Storage.getSessions(),
      settings:   Settings.load()
    };
    if (includeProgress) {
      backup.quizProgress = Backup._getProgressSnapshots().map(({ snap }) => snap);
    }
    Backup._download(backup, `flashquiz-backup-${new Date().toISOString().slice(0, 10)}.json`);
    Toast.show('Backup downloaded', 'success');
  },

  exportUser(user) {
    const sessions = Storage.getSessions().filter(s => s.userId === user.id);
    const [progEntry] = Backup._getProgressSnapshots([user.id]);
    const backup = {
      version:    1,
      exportedAt: new Date().toISOString(),
      users:      [user],
      sessions,
      settings:   null,
      ...(progEntry ? { quizProgress: [progEntry.snap] } : {})
    };
    const safeName = user.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    Backup._download(backup, `flashquiz-backup-${safeName}-${new Date().toISOString().slice(0, 10)}.json`);
    Toast.show(`Backup for ${user.name} downloaded`, 'success');
  },

  _download(backup, filename) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  async import(file) {
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      Toast.show('Could not read file — not valid JSON', 'error');
      return;
    }
    if (backup.version !== 1 || !Array.isArray(backup.users) || !Array.isArray(backup.sessions)) {
      Toast.show('File does not appear to be a FlashQuiz backup', 'error');
      return;
    }

    const existingUsers    = Storage.getUsers();
    const existingSessions = Storage.getSessions();
    const newUserCount     = backup.users.filter(u => !existingUsers.some(e => e.id === u.id)).length;
    const newSessCount     = backup.sessions.filter(s => !existingSessions.some(e => e.id === s.id)).length;
    const progSnaps        = Array.isArray(backup.quizProgress) ? backup.quizProgress : [];
    const newProgCount     = progSnaps.filter(s => !Storage.lsGet('quiz_progress_' + s.userId, null)).length;

    const lines = [
      `<strong>${backup.users.length}</strong> user(s) in backup — <strong>${newUserCount}</strong> new`,
      `<strong>${backup.sessions.length}</strong> session(s) in backup — <strong>${newSessCount}</strong> new`,
      progSnaps.length ? `<strong>${progSnaps.length}</strong> in-progress quiz(es) — <strong>${newProgCount}</strong> new` : null,
      backup.settings ? 'App settings will also be restored.' : null
    ].filter(Boolean).join('<br>');

    const bodyEl = document.createElement('div');
    bodyEl.style.fontSize = '.95rem';
    bodyEl.style.lineHeight = '1.8';
    bodyEl.innerHTML = lines;
    if (progSnaps.length) {
      bodyEl.innerHTML += '<p style="margin-top:.5rem;font-size:.82rem;color:var(--clr-warning)">⚠ In-progress quizzes will only resume correctly if the matching deck already exists on this device.</p>';
    }
    bodyEl.innerHTML += '<p style="margin-top:.6rem;font-size:.85rem;color:var(--clr-text-muted)">Records already present (same ID) are skipped — nothing is deleted.</p>';

    Modal.show({
      title: 'Import Backup',
      body:  bodyEl,
      buttons: [
        { label: 'Cancel' },
        { label: 'Import & Merge', cls: 'btn-primary', action: () => Backup._merge(backup) }
      ]
    });
  },

  _merge(backup) {
    // Users
    const existingUsers = Storage.getUsers();
    const existingUserIds = new Set(existingUsers.map(u => u.id));
    const mergedUsers = [...existingUsers, ...backup.users.filter(u => !existingUserIds.has(u.id))];
    Storage.saveUsers(mergedUsers);

    // Sessions
    const existingSessions = Storage.getSessions();
    const existingSessIds  = new Set(existingSessions.map(s => s.id));
    const mergedSessions   = [...existingSessions, ...backup.sessions.filter(s => !existingSessIds.has(s.id))];
    Storage.lsSet('sessions', mergedSessions);

    // Settings
    if (backup.settings) {
      Settings.save(backup.settings);
      Settings.apply(backup.settings);
    }

    // Quiz progress snapshots — skip if a snapshot already exists for that user
    let addedP = 0;
    if (Array.isArray(backup.quizProgress)) {
      backup.quizProgress.forEach(snap => {
        const key = 'quiz_progress_' + snap.userId;
        if (!Storage.lsGet(key, null)) {
          Storage.lsSet(key, snap);
          addedP++;
        }
      });
    }

    const addedU = mergedUsers.length    - existingUsers.length;
    const addedS = mergedSessions.length - existingSessions.length;

    Views.users.render();
    Views.users.updateNavUser();
    const parts = [`${addedU} user(s)`, `${addedS} session(s)`];
    if (addedP) parts.push(`${addedP} quiz progress snapshot(s)`);
    Toast.show(`Imported: ${parts.join(', ')}`, 'success', 4000);
  }
};
// ============================================================
async function resolveCellImg(cell) {
  if (!cell) return cell;
  if (cell.type === 'local-image') {
    const imgRec = await Storage.getImage(cell.name);
    return imgRec
      ? { type: 'image', src: imgRec.src }
      : { type: 'text', text: `⚠ Missing library image: ${cell.name}` };
  }
  if (cell.type === 'mixed' && cell.localImage) {
    const imgRec = await Storage.getImage(cell.localImage);
    if (!imgRec) return { type: 'text', text: `${cell.text} [⚠ Missing: ${cell.localImage}]` };
    return { ...cell, src: imgRec.src, localImage: undefined };
  }
  return cell;
}

async function resolveLocalImages(rows) {
  return Promise.all(rows.map(async r => ({
    ...r,
    question:      await resolveCellImg(r.question),
    correctAnswer: await resolveCellImg(r.correctAnswer),
    wrongAnswers:  await Promise.all(r.wrongAnswers.map(resolveCellImg)),
    referenceCell: await resolveCellImg(
      typeof r.reference === 'string' ? parseCell(r.reference || '') : (r.reference || null)
    )
  })));
}

// ============================================================
// SHARED: DATASET PICKER
// ============================================================
function renderDatasetPicker(listEl, onSelect) {
  const metas = Storage.getDatasetMetas();
  listEl.innerHTML = '';
  if (!metas.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div>
      <p>No datasets loaded yet.<br>Go to <strong>Data</strong> to import a file.</p></div>`;
    return;
  }
  metas.forEach(m => {
    const item = document.createElement('div');
    item.className = 'deck-picker-item';
    item.innerHTML = `
      <div>
        <div class="dpi-name">${esc(m.name)}</div>
        <div class="dpi-meta">${m.rowCount} question${m.rowCount !== 1 ? 's' : ''} · Added ${fmtDate(m.createdAt)}</div>
      </div>
      <span class="dpi-arrow">›</span>`;
    item.addEventListener('click', () => onSelect(m));
    listEl.appendChild(item);
  });
}

/** HTML-escape helper */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// LEVEL FILTER HELPER
// ============================================================
const LevelFilter = {
  _pending: {}, // { 'fc': { ds, eligibleFn }, 'quiz': { ds, eligibleFn } }

  // Build and show the filter panel.
  // eligibleFn(row) pre-filters rows before counting (e.g. must have wrongAnswers for quiz).
  show(prefix, ds, eligibleFn) {
    LevelFilter._pending[prefix] = { ds, eligibleFn };
    const levels    = ds.levels || [];
    const allRows   = eligibleFn ? ds.rows.filter(eligibleFn) : ds.rows;
    const badgesEl  = document.getElementById(`${prefix}-lf-badges`);
    const startBtn  = document.getElementById(`btn-${prefix}-lf-start`);
    const nameEl    = document.getElementById(`${prefix}-lf-deck-name`);

    nameEl.textContent = ds.name;
    badgesEl.innerHTML = '';

    const update = () => {
      const filter = LevelFilter.readFilter(prefix);
      const count  = allRows.filter(r => LevelFilter._rowMatches(r, filter)).length;
      startBtn.textContent = `Start (${count})`;
      startBtn.disabled    = count === 0;
    };

    levels.forEach(lv => {
      const b = document.createElement('span');
      b.className          = 'level-badge lf-badge-toggle';
      b.textContent        = lv.name;
      b.style.background   = lv.color;
      b.style.color        = contrastColor(lv.color);
      b.dataset.level      = lv.name;
      b.dataset.selected   = '1';
      b.addEventListener('click', e => {
        e.stopPropagation();
        const on = b.dataset.selected !== '1';
        b.dataset.selected = on ? '1' : '0';
        b.classList.toggle('lf-badge-off', !on);
        update();
      });
      badgesEl.appendChild(b);
    });

    // "Unlabeled" toggle if any eligible rows have no level
    const unlabeled = allRows.filter(r => !r.level);
    if (unlabeled.length) {
      const b = document.createElement('span');
      b.className        = 'level-badge lf-badge-toggle lf-badge-unlabeled';
      b.textContent      = `Unlabeled (${unlabeled.length})`;
      b.dataset.noLevel  = '1';
      b.dataset.selected = '1';
      b.addEventListener('click', e => {
        e.stopPropagation();
        const on = b.dataset.selected !== '1';
        b.dataset.selected = on ? '1' : '0';
        b.classList.toggle('lf-badge-off', !on);
        update();
      });
      badgesEl.appendChild(b);
    }

    update();
    document.getElementById(`${prefix}-deck-list`).classList.add('hidden');
    document.getElementById(`${prefix}-level-filter`).classList.remove('hidden');
  },

  hide(prefix) {
    document.getElementById(`${prefix}-level-filter`).classList.add('hidden');
    document.getElementById(`${prefix}-deck-list`).classList.remove('hidden');
  },

  selectAll(prefix) {
    document.querySelectorAll(`#${prefix}-lf-badges .lf-badge-toggle`).forEach(b => {
      b.dataset.selected = '1';
      b.classList.remove('lf-badge-off');
    });
    LevelFilter._updateCount(prefix);
  },

  selectNone(prefix) {
    document.querySelectorAll(`#${prefix}-lf-badges .lf-badge-toggle`).forEach(b => {
      b.dataset.selected = '0';
      b.classList.add('lf-badge-off');
    });
    LevelFilter._updateCount(prefix);
  },

  _updateCount(prefix) {
    const p = LevelFilter._pending[prefix];
    if (!p) return;
    const allRows = p.eligibleFn ? p.ds.rows.filter(p.eligibleFn) : p.ds.rows;
    const filter  = LevelFilter.readFilter(prefix);
    const count   = allRows.filter(r => LevelFilter._rowMatches(r, filter)).length;
    const startBtn = document.getElementById(`btn-${prefix}-lf-start`);
    if (startBtn) { startBtn.textContent = `Start (${count})`; startBtn.disabled = count === 0; }
  },

  readFilter(prefix) {
    const badges = document.querySelectorAll(`#${prefix}-lf-badges .lf-badge-toggle`);
    const selectedLevels = [];
    let includeUnlabeled = false;
    badges.forEach(b => {
      if (b.dataset.selected === '1') {
        if (b.dataset.noLevel) includeUnlabeled = true;
        else selectedLevels.push(b.dataset.level);
      }
    });
    return { levels: selectedLevels, includeUnlabeled };
  },

  _rowMatches(row, filter) {
    if (!row.level) return filter.includeUnlabeled;
    return filter.levels.includes(row.level);
  },

  applyFilter(rows, filter) {
    if (!filter) return rows;
    return rows.filter(r => LevelFilter._rowMatches(r, filter));
  },

  // Returns a display label like "Easy, Medium" when filtering, null when everything is included.
  filterLabel(ds, filter) {
    if (!filter) return null;
    const levels         = ds.levels || [];
    const unlabeledExist = ds.rows.some(r => !r.level);
    const allSelected    = filter.levels.length === levels.length &&
                           (!unlabeledExist || filter.includeUnlabeled);
    if (allSelected) return null;
    const parts = [...filter.levels];
    if (filter.includeUnlabeled) parts.push('Unlabeled');
    return parts.join(', ') || null;
  }
};

// ============================================================
// VIEW: HOME
// ============================================================
const Views = {};
Views.home = {
  onEnter() {
    const user = State.currentUser;
    const greeting = document.getElementById('home-greeting');
    greeting.textContent = user ? `Welcome back, ${user.name}! 👋` : 'Continuing as Anonymous';
    greeting.style.display = '';
  }
};

// ============================================================
// VIEW: USERS
// ============================================================
Views.users = {
  onEnter() { Views.users.render(); },
  render() {
    const list  = document.getElementById('users-list');
    const users = Storage.getUsers();
    list.innerHTML = '';

    if (!users.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">👤</div>
        <p>No users yet. Add one above or continue anonymously.</p></div>`;
      return;
    }
    users.forEach(u => {
      const isActive = State.currentUser && State.currentUser.id === u.id;
      const div = document.createElement('div');
      div.className = 'user-item' + (isActive ? ' active-user' : '');
      div.innerHTML = `
        <span class="user-name">${esc(u.name)}</span>
        <span class="user-meta">Added ${fmtDate(u.createdAt)}</span>
        ${isActive ? '<span class="round-badge">Active</span>' : ''}
        <button class="btn btn-secondary" data-action="select" data-id="${u.id}">Select</button>
        <button class="btn btn-ghost"      data-action="export" data-id="${u.id}">⬇ Export</button>
        <button class="btn btn-danger"    data-action="delete" data-id="${u.id}">Delete</button>`;
      list.appendChild(div);
    });

    list.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        const id     = e.currentTarget.dataset.id;
        const action = e.currentTarget.dataset.action;
        const user   = Storage.getUsers().find(u => u.id === id);
        if (!user) return;
        if (action === 'select') {
          State.currentUser = user;
          Storage.setCurrentUser(user);
          Views.users.updateNavUser();
          Toast.show(`Switched to ${user.name}`, 'success');
          Views.users.render();
        } else if (action === 'export') {
          Backup.exportUser(user);
        } else if (action === 'delete') {
          Modal.confirm('Delete User', `Delete "${user.name}"? Their session history will remain.`, () => {
            const updated = Storage.getUsers().filter(u => u.id !== id);
            Storage.saveUsers(updated);
            if (State.currentUser && State.currentUser.id === id) {
              State.currentUser = null;
              Storage.setCurrentUser(null);
              Views.users.updateNavUser();
            }
            Views.users.render();
            Toast.show('User deleted', 'info');
          }, 'Delete', 'btn-danger');
        }
      });
    });
  },
  updateNavUser() {
    document.getElementById('nav-user-name').textContent =
      State.currentUser ? State.currentUser.name : 'Anonymous';
  }
};

// ============================================================
// VIEW: DATA
// ============================================================
Views.data = {
  onEnter() { Views.data.renderList(); Views.data.renderImageLib(); },
  renderList() {
    const list  = document.getElementById('datasets-list');
    const metas = Storage.getDatasetMetas();
    list.innerHTML = '';

    if (!metas.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div>
        <p>No datasets loaded. Import a CSV or Excel file above.</p></div>`;
      return;
    }
    metas.forEach(m => {
      const div = document.createElement('div');
      div.className = 'dataset-item';
      div.innerHTML = `
        <div class="dataset-item-info">
          <div class="dataset-name">${esc(m.name)}</div>
          <div class="dataset-meta">${m.rowCount} question${m.rowCount !== 1 ? 's' : ''} · ${fmtDate(m.createdAt)}</div>
        </div>
        <div class="dataset-actions">
          <button class="btn btn-secondary" data-action="preview" data-id="${m.id}">Preview</button>
          <button class="btn btn-secondary" data-action="export"  data-id="${m.id}">⬇ CSV</button>
          <button class="btn btn-secondary" data-action="bundle"  data-id="${m.id}">⬇ Bundle</button>
          <button class="btn btn-danger"    data-action="delete"  data-id="${m.id}">Delete</button>
        </div>`;
      list.appendChild(div);
    });

    list.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id     = e.currentTarget.dataset.id;
        const action = e.currentTarget.dataset.action;
        const meta   = Storage.getDatasetMetas().find(m => m.id === id);
        if (!meta) return;

        if (action === 'delete') {
          Modal.confirm('Delete Dataset', `Delete "${meta.name}"?  This cannot be undone.`, async () => {
            await Storage.deleteDataset(id);
            Views.data.renderList();
            Toast.show('Dataset deleted', 'info');
          }, 'Delete', 'btn-danger');

        } else if (action === 'export') {
          const ds = await Storage.getDataset(id);
          if (!ds) return;
          const csv  = DataExport.datasetToCSV(ds);
          const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
          const url  = URL.createObjectURL(blob);
          const a    = Object.assign(document.createElement('a'), { href: url, download: ds.name + '.csv' });
          document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(url);

        } else if (action === 'bundle') {
          const ds = await Storage.getDataset(id);
          if (!ds) return;
          await exportBundle(ds);

        } else if (action === 'preview') {
          const ds = await Storage.getDataset(id);
          if (!ds) return;
          const frag = document.createDocumentFragment();
          const ul   = document.createElement('ul');
          ul.style.cssText = 'padding-left:1.2em;max-height:300px;overflow-y:auto;font-size:.9rem;';
          ds.rows.slice(0, 20).forEach((r, i) => {
            const li = document.createElement('li');
            li.style.padding = '.25em 0';
            li.textContent   = `${i + 1}. ${cellLabel(r.question)} → ${cellLabel(r.correctAnswer)} (${r.wrongAnswers.length} wrong)`;
            ul.appendChild(li);
          });
          if (ds.rows.length > 20) {
            const more = document.createElement('li');
            more.style.color = 'var(--clr-text-muted)';
            more.textContent = `…and ${ds.rows.length - 20} more`;
            ul.appendChild(more);
          }
          frag.appendChild(ul);
          Modal.show({ title: `Preview: ${ds.name}`, body: ul, buttons: [{ label: 'Close' }] });
        }
      });
    });
  },

  async renderImageLib() {
    const grid  = document.getElementById('image-lib-grid');
    if (!grid) return;
    const count   = document.getElementById('image-lib-count');
    const images  = await Storage.getAllImages();

    // Populate datalist with dataset names + existing custom groups
    const dl = document.getElementById('image-lib-group-list');
    if (dl) {
      const prev = document.getElementById('image-lib-group')?.value || '';
      dl.innerHTML = '';
      const opts = new Set(Storage.getDatasetMetas().map(m => m.name));
      images.forEach(img => { if (img.group) opts.add(img.group); });
      [...opts].sort().forEach(g => {
        const opt = document.createElement('option'); opt.value = g; dl.appendChild(opt);
      });
      if (document.getElementById('image-lib-group')) {
        document.getElementById('image-lib-group').value = prev;
      }
    }

    if (count) count.textContent = images.length
      ? `${images.length} image${images.length !== 1 ? 's' : ''} stored` : '';
    grid.innerHTML = '';
    if (!images.length) {
      grid.innerHTML = '<div class="empty-state" style="padding:1rem"><p>No images yet. Click <strong>+ Upload Images</strong>.</p></div>';
      return;
    }

    // Group images
    const groups = {};
    images.forEach(img => {
      const g = img.group || '';
      if (!groups[g]) groups[g] = [];
      groups[g].push(img);
    });
    const keys = Object.keys(groups).sort((a, b) => {
      if (a === '') return -1; if (b === '') return 1;
      return a.localeCompare(b);
    });

    keys.forEach(key => {
      const label = key || 'General';
      const section = document.createElement('div');
      section.className = 'image-lib-section';

      // Group header with action buttons
      const header = document.createElement('div');
      header.className = 'image-lib-group-header';
      header.innerHTML = `
        <span class="image-lib-group-name">${esc(label)}</span>
        <span class="image-lib-group-count">${groups[key].length} image${groups[key].length !== 1 ? 's' : ''}</span>
        <div class="image-lib-group-actions">
          <button class="btn btn-ghost btn-xs" data-group-action="upload" title="Upload images to this group">📤 Upload</button>
          <button class="btn btn-ghost btn-xs" data-group-action="rename" title="Rename group">✏️ Rename</button>
          <button class="btn btn-ghost btn-xs" data-group-action="export" title="Export group as ZIP">⬇ Export</button>
          <button class="btn btn-danger btn-xs"  data-group-action="delete" title="Delete all images in group">🗑 Delete All</button>
        </div>`;

      // Upload to group
      header.querySelector('[data-group-action="upload"]').addEventListener('click', () => {
        const groupInp = document.getElementById('image-lib-group');
        if (groupInp) groupInp.value = key;
        document.getElementById('image-lib-input').click();
      });

      // Rename
      header.querySelector('[data-group-action="rename"]').addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'text'; inp.value = key; inp.placeholder = 'Leave empty for General';
        inp.style.cssText = 'width:100%;margin-top:.5rem;box-sizing:border-box';
        const wrap = document.createElement('div');
        wrap.innerHTML = `<p>New name for <strong>${esc(label)}</strong> (empty = General):</p>`;
        wrap.appendChild(inp);
        Modal.show({ title: 'Rename Group', body: wrap, buttons: [
          { label: 'Cancel' },
          { label: 'Rename', cls: 'btn-primary', action: async () => {
            const newName = inp.value.trim();
            if (newName === key) return;
            await Storage.updateImagesGroup(key, newName);
            Views.data.renderImageLib();
            Toast.show(`Renamed to "${newName || 'General'}"`, 'success');
          }}
        ]});
        setTimeout(() => { inp.select(); inp.focus(); }, 50);
      });

      // Export as ZIP
      header.querySelector('[data-group-action="export"]').addEventListener('click', () => {
        exportGroupZip(label, groups[key]);
      });

      // Delete group
      header.querySelector('[data-group-action="delete"]').addEventListener('click', () => {
        Modal.confirm(
          `Delete Group: ${label}`,
          `Remove all ${groups[key].length} image(s) in "${label}"? This cannot be undone.`,
          async () => {
            await Storage.deleteImagesByGroup(key);
            Views.data.renderImageLib();
            Toast.show(`Group "${label}" deleted`, 'info');
          }, 'Delete All', 'btn-danger'
        );
      });

      section.appendChild(header);

      const subGrid = document.createElement('div');
      subGrid.className = 'image-lib-grid';
      groups[key].forEach(img => {
        const item = document.createElement('div');
        item.className = 'image-lib-item';
        item.innerHTML = `
          <img src="${esc(img.src)}" alt="${esc(img.name)}" class="image-lib-thumb">
          <span class="image-lib-name" title="${esc(img.name)}">${esc(img.name)}</span>
          <button class="btn btn-danger image-lib-del" data-name="${esc(img.name)}" title="Remove">&#x2715;</button>`;
        subGrid.appendChild(item);
      });
      section.appendChild(subGrid);
      grid.appendChild(section);
    });

    grid.querySelectorAll('.image-lib-del').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const name = btn.dataset.name;
        Modal.confirm('Remove Image', `Remove "${name}" from the library?`, async () => {
          await Storage.deleteImage(name);
          Views.data.renderImageLib();
          Toast.show(`"${name}" removed`, 'info');
        }, 'Remove', 'btn-danger');
      });
    });
  },

  async uploadImages(files) {
    const groupInp = document.getElementById('image-lib-group');
    const group = groupInp ? groupInp.value.trim() : '';
    let added = 0, skipped = 0;
    for (const file of [...files]) {
      // ZIP → unpack images into the current group (or zip filename as group name)
      if (/\.zip$/i.test(file.name)) {
        if (!window.JSZip) { Toast.show('ZIP support requires JSZip (offline?)', 'warning'); skipped++; continue; }
        const buf     = await readFileBuffer(file);
        const zip     = await window.JSZip.loadAsync(buf);
        const zipGroup = group || file.name.replace(/\.zip$/i, '');
        for (const entry of Object.values(zip.files)) {
          if (entry.dir) continue;
          const fname = entry.name.split('/').pop();
          if (!/\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff?)$/i.test(fname)) continue;
          const src = await arrBufToDataURI(await entry.async('arraybuffer'), fname);
          await Storage.saveImage(fname, src, zipGroup);
          added++;
        }
        continue;
      }
      if (!file.type.startsWith('image/')) { skipped++; continue; }
      if (file.size > 5 * 1024 * 1024) {
        Toast.show(`"${file.name}" exceeds 5 MB – skipped`, 'warning');
        skipped++;
        continue;
      }
      const src = await fileToDataURI(file);
      await Storage.saveImage(file.name, src, group);
      added++;
    }
    if (added)   Toast.show(`${added} image${added !== 1 ? 's' : ''} added to library`, 'success');
    if (skipped) Toast.show(`${skipped} file${skipped !== 1 ? 's' : ''} skipped`, 'warning');
    Views.data.renderImageLib();
  },

  async handleFile(file) {
    const idle    = document.getElementById('upload-idle');
    const working = document.getElementById('upload-working');
    const status  = document.getElementById('upload-status-text');

    idle.classList.add('hidden');
    working.classList.remove('hidden');
    status.textContent = 'Parsing file…';

    try {
      const name = file.name.replace(/\.[^.]+$/, '');

      if (/\.zip$/i.test(file.name)) {
        if (!window.JSZip) throw new Error('ZIP support requires the JSZip library. Please connect to the internet.');
        const buf = await readFileBuffer(file);
        const zip = await window.JSZip.loadAsync(buf);
        await Views.data._importZip(zip, name, status);
        return;
      }

      let ds;
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const buf = await readFileBuffer(file);
        ds = FileParser.parseExcel(buf, name);
      } else {
        const txt = await readFileText(file);
        const raw = FileParser.parseCSV(txt);
        ds = FileParser.rawToDataset(raw, name);
      }

      if (!ds.rows.length) throw new Error('No valid rows found in the file.');

      status.textContent = `Saving ${ds.rows.length} questions…`;
      await Storage.saveDataset(ds);
      Toast.show(`Imported "${ds.name}" – ${ds.rows.length} questions`, 'success');
      Views.data.renderList();
    } catch (err) {
      Toast.show('Import failed: ' + err.message, 'error', 5000);
    } finally {
      idle.classList.remove('hidden');
      working.classList.add('hidden');
    }
  },

  /** Handle a JSZip object: bundle (deck + images) or image-only ZIP */
  async _importZip(zip, zipName, statusEl) {
    const setStatus = t => { if (statusEl) statusEl.textContent = t; };
    const entries   = Object.values(zip.files).filter(f => !f.dir);
    const deckEntry = entries.find(f => /\.(csv|xlsx|xls)$/i.test(f.name));

    // ── Parse manifest if present ───────────────────────────────
    const manifestEntry   = entries.find(f => f.name.toLowerCase().endsWith('manifest.txt'));
    const manifestMissing = []; // files listed in manifest but absent from ZIP
    const manifestExtra   = []; // content files in ZIP but not listed in manifest
    if (manifestEntry) {
      const mText = await manifestEntry.async('string');
      // Extract every content path listed in the manifest
      const listedPaths = new Set();
      for (const line of mText.split(/\r?\n/)) {
        const m = line.match(/^\s+(images\/.+|.+\.(csv|xlsx|xls))\s*$/i);
        if (!m) continue;
        listedPaths.add(m[1].trim());
      }
      const zipFileNames = new Set(entries.map(e => e.name.replace(/\\/g, '/')));
      // Missing: listed in manifest but not in ZIP
      for (const p of listedPaths) {
        if (!zipFileNames.has(p)) manifestMissing.push(p);
      }
      // Extra: content files in ZIP not listed in manifest (exclude manifest.txt itself)
      for (const entry of entries) {
        const normalized = entry.name.replace(/\\/g, '/');
        if (/manifest\.txt$/i.test(normalized)) continue;
        if (!listedPaths.has(normalized)) manifestExtra.push(normalized);
      }
    }

    if (deckEntry) {
      // ── Bundle: restore images then import deck ──────────────
      setStatus('Importing images…');
      let imgCount = 0;
      for (const entry of entries) {
        const fname = entry.name.split('/').pop();
        if (!/\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff?)$/i.test(fname)) continue;
        const src = await arrBufToDataURI(await entry.async('arraybuffer'), fname);
        await Storage.saveImage(fname, src, '');
        imgCount++;
      }
      if (imgCount) Views.data.renderImageLib();

      setStatus('Parsing deck…');
      const deckName = deckEntry.name.split('/').pop().replace(/\.[^.]+$/, '');
      let ds;
      if (/\.(xlsx|xls)$/i.test(deckEntry.name)) {
        const buf = await deckEntry.async('arraybuffer');
        ds = FileParser.parseExcel(buf, deckName);
      } else {
        const txt = await deckEntry.async('string');
        const raw = FileParser.parseCSV(txt.replace(/^\uFEFF/, ''));
        ds = FileParser.rawToDataset(raw, deckName);
      }
      if (!ds.rows.length) throw new Error('No valid rows found in the deck file inside the ZIP.');

      setStatus(`Saving ${ds.rows.length} questions…`);
      await Storage.saveDataset(ds);
      Views.data.renderList();

      const imgNote = imgCount ? `, ${imgCount} image(s)` : '';
      Toast.show(`Imported "${ds.name}" – ${ds.rows.length} question(s)${imgNote}`, 'success');

      if (manifestMissing.length) {
        Toast.showPersistent(`⚠ ${manifestMissing.length} file(s) listed in manifest were missing from the ZIP: ${manifestMissing.join(', ')}`, 'warning');
      }
      if (manifestExtra.length) {
        Toast.showPersistent(`ℹ ${manifestExtra.length} file(s) in the ZIP were not listed in the manifest: ${manifestExtra.join(', ')}`, 'info');
      }
    } else {
      // ── Image-only ZIP: import all images as a library group ──
      setStatus('Importing images from ZIP…');
      let imgCount = 0, skipped = 0;
      for (const entry of entries) {
        const fname = entry.name.split('/').pop();
        if (!/\.(png|jpg|jpeg|gif|webp|svg|bmp|tiff?)$/i.test(fname)) { skipped++; continue; }
        const src = await arrBufToDataURI(await entry.async('arraybuffer'), fname);
        await Storage.saveImage(fname, src, zipName);
        imgCount++;
      }
      Views.data.renderImageLib();
      Toast.show(`Imported ${imgCount} image(s) to library group "${zipName}"`, 'success');
      if (skipped) Toast.show(`${skipped} non-image file(s) skipped`, 'warning');
      if (manifestMissing.length) {
        Toast.showPersistent(`⚠ ${manifestMissing.length} file(s) listed in manifest were missing from the ZIP: ${manifestMissing.join(', ')}`, 'warning');
      }
      if (manifestExtra.length) {
        Toast.showPersistent(`ℹ ${manifestExtra.length} file(s) in the ZIP were not listed in the manifest: ${manifestExtra.join(', ')}`, 'info');
      }
    }
  }
};

// ============================================================
// VIEW: BUILDER
// ============================================================
Views.builder = {
  onEnter() { Views.builder.renderDeckList(); },

  renderDeckList() {
    const list  = document.getElementById('builder-deck-list');
    const metas = Storage.getDatasetMetas();
    list.innerHTML = '';

    if (!metas.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔨</div>
        <p>No decks yet. Click <strong>+ New Deck</strong> to create one.</p></div>`;
    } else {
      metas.forEach(m => {
        const div = document.createElement('div');
        div.className = 'builder-deck-item card';
        div.innerHTML = `
          <div class="deck-name">${esc(m.name)}</div>
          <div class="dataset-meta">${m.rowCount} Q · ${fmtDate(m.createdAt)}</div>
          <button class="btn btn-secondary" data-action="split" data-id="${m.id}">✂ Split</button>
          <button class="btn btn-secondary" data-action="edit"  data-id="${m.id}">✏ Edit</button>
          <button class="btn btn-danger"    data-action="del"   data-id="${m.id}">Delete</button>`;
        list.appendChild(div);
      });

      list.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async e => {
          const id     = e.currentTarget.dataset.id;
          const action = e.currentTarget.dataset.action;
          if (action === 'edit') {
            const ds = await Storage.getDataset(id);
            if (ds) Views.builder.openEditor(ds);
          } else if (action === 'split') {
            const ds = await Storage.getDataset(id);
            if (ds) Views.builder.split.open(ds);
          } else if (action === 'del') {
            const meta = Storage.getDatasetMetas().find(m => m.id === id);
            Modal.confirm('Delete Deck', `Delete "${meta ? meta.name : id}"?`, async () => {
              await Storage.deleteDataset(id);
              Views.builder.renderDeckList();
            }, 'Delete', 'btn-danger');
          }
        });
      });
    }

    // hide editor / split / combine when rendering deck list
    if (!State.bld.editingId) {
      document.getElementById('builder-editor').classList.add('hidden');
    }
    document.getElementById('builder-split')?.classList.add('hidden');
    document.getElementById('builder-combine')?.classList.add('hidden');
    document.getElementById('builder-deck-list').classList.remove('hidden');
  },

  newDeck() {
    const ds = { id: genId(), name: 'New Deck', createdAt: new Date().toISOString(), rows: [] };
    Views.builder.openEditor(ds);
  },

  openEditor(ds) {
    State.bld.editingId = ds.id;
    State.bld.draft = JSON.parse(JSON.stringify(ds)); // deep clone
    State.bld.filterMissingImgs   = false;
    State.bld.missingImgIds       = null;
    State.bld.filterMissingLevels = false;
    State.bld.filterLevels        = new Set();
    State.bld.searchText          = '';
    const searchInput = document.getElementById('builder-search-input');
    if (searchInput) searchInput.value = '';
    const searchCount = document.getElementById('builder-search-count');
    if (searchCount) searchCount.textContent = '';

    document.getElementById('deck-name-input').value  = ds.name;
    const missingBtn = document.getElementById('btn-builder-missing-imgs');
    if (missingBtn) missingBtn.classList.remove('active');
    const missingLvBtn = document.getElementById('btn-builder-missing-levels');
    if (missingLvBtn) missingLvBtn.classList.remove('active');
    const levelsBtn = document.getElementById('btn-builder-levels');
    if (levelsBtn) levelsBtn.classList.remove('active');
    State.bld.selectedIds = new Set();
    State.bld.lastCheckedId = null;
    document.getElementById('builder-split')?.classList.add('hidden');
    document.getElementById('builder-combine')?.classList.add('hidden');
    document.getElementById('builder-deck-list').innerHTML = '';
    document.getElementById('builder-editor').classList.remove('hidden');

    Views.builder.renderQuestions();
  },

  renderQuestions() {
    const container = document.getElementById('builder-questions-list');
    container.innerHTML = '';
    const rows   = State.bld.draft.rows;
    const levels = State.bld.draft.levels || [];
    const levelNames = new Set(levels.map(l => l.name));

    // ── Level filter badge row ──
    const lfEl = document.getElementById('builder-level-filter');
    if (lfEl) {
      lfEl.innerHTML = '';
      if (levels.length) {
        lfEl.classList.remove('hidden');
        const hasUntagged = rows.some(r => !r.level || !levelNames.has(r.level));
        // Prune stale '' entry if no untagged rows exist
        if (!hasUntagged) State.bld.filterLevels.delete('');

        const allActive = State.bld.filterLevels.size === 0;
        const allBtn = document.createElement('button');
        allBtn.className = 'level-badge lf-badge-toggle bld-lf-all' + (allActive ? '' : ' lf-badge-off');
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', e => { e.stopPropagation(); State.bld.filterLevels = new Set(); Views.builder.renderQuestions(); });
        lfEl.appendChild(allBtn);

        levels.forEach(l => {
          const on  = !State.bld.filterLevels.has(l.name);
          const btn = document.createElement('button');
          btn.className = 'level-badge lf-badge-toggle' + (on ? '' : ' lf-badge-off');
          btn.style.background = l.color;
          btn.style.color      = contrastColor(l.color);
          btn.textContent      = l.name;
          btn.addEventListener('click', e => {
            e.stopPropagation();
            if (State.bld.filterLevels.has(l.name)) State.bld.filterLevels.delete(l.name);
            else                                     State.bld.filterLevels.add(l.name);
            Views.builder.renderQuestions();
          });
          lfEl.appendChild(btn);
        });

        if (hasUntagged) {
          const on  = !State.bld.filterLevels.has('');
          const btn = document.createElement('button');
          btn.className = 'lf-badge-toggle lf-badge-unlabeled' + (on ? '' : ' lf-badge-off');
          btn.textContent = 'Unlabeled';
          btn.addEventListener('click', e => {
            e.stopPropagation();
            if (State.bld.filterLevels.has('')) State.bld.filterLevels.delete('');
            else                                State.bld.filterLevels.add('');
            Views.builder.renderQuestions();
          });
          lfEl.appendChild(btn);
        }
      } else {
        lfEl.classList.add('hidden');
        State.bld.filterLevels = new Set();
      }
    }

    if (!rows.length) {
      container.innerHTML = `<div class="empty-state"><p>No questions yet. Click <strong>+ Add Question</strong>.</p></div>`;
      Views.builder.updateBulkBar();
      return;
    }

    const missingIds = State.bld.missingImgIds;

    let filtered = rows.map((row, idx) => ({ row, idx }));
    if (State.bld.filterMissingImgs) {
      filtered = filtered.filter(({ row }) => missingIds && missingIds.has(row.id));
    }
    if (State.bld.filterMissingLevels) {
      filtered = filtered.filter(({ row }) => !row.level || !levelNames.has(row.level));
    }
    if (State.bld.filterLevels.size > 0) {
      filtered = filtered.filter(({ row }) => !State.bld.filterLevels.has(row.level || ''));
    }
    const needle = State.bld.searchText.trim().toLowerCase();
    if (needle) {
      filtered = filtered.filter(({ row }) => {
        const getText = cell => (cell && (cell.type === 'text' || cell.type === 'mixed') ? (cell.text || '') : '');
        const refCell = row.referenceCell ?? (typeof row.reference === 'string' ? parseCell(row.reference) : row.reference);
        const haystack = [
          getText(row.question),
          getText(row.correctAnswer),
          ...(row.wrongAnswers || []).map(getText),
          getText(refCell),
        ].join('\n').toLowerCase();
        return haystack.includes(needle);
      });
    }

    const countEl = document.getElementById('builder-search-count');
    if (countEl) {
      countEl.textContent = needle ? `${filtered.length} of ${rows.length}` : '';
    }

    if (!filtered.length) {
      const lvlActive = State.bld.filterLevels.size > 0;
      const reason = needle
        ? `No questions match "${esc(needle)}".`
        : lvlActive
          ? 'No questions match the selected level filter.'
          : State.bld.filterMissingImgs && State.bld.filterMissingLevels
            ? 'No questions match both filters.'
            : State.bld.filterMissingImgs
              ? 'No questions match \u2014 every question has an image. \ud83c\udf89'
              : 'No questions match \u2014 every question has a level assigned. \ud83c\udf89';
      container.innerHTML = `<div class="empty-state"><p>${reason}</p></div>`;
      Views.builder.updateBulkBar();
      return;
    }

    filtered.forEach(({ row, idx }) => {
      container.appendChild(Views.builder.makeQuestionCard(row, idx));
    });
    Views.builder.updateBulkBar();
  },

  updateBulkBar() {
    const bar = document.getElementById('builder-bulk-bar');
    if (!bar) return;
    const hasLevels = (State.bld.draft?.levels?.length ?? 0) > 0;
    const count = State.bld.selectedIds.size;
    bar.classList.toggle('hidden', !hasLevels || count === 0);
    const countEl = document.getElementById('bulk-count');
    if (countEl) countEl.textContent = `${count} question${count !== 1 ? 's' : ''} selected`;
    const pop = document.getElementById('bulk-level-pop');
    if (pop) {
      const levels = State.bld.draft?.levels || [];
      pop.innerHTML = levels.map(l =>
        `<button class="level-picker-opt level-badge" data-level="${esc(l.name)}" style="background:${esc(l.color)};color:${contrastColor(l.color)};display:inline-flex">${esc(l.name)}</button>`
      ).join('')
        + (levels.length ? `<hr class="level-picker-sep">` : '')
        + `<button class="level-picker-opt level-picker-none" data-level="">\u2014 Clear level \u2014</button>`;
    }
  },

  bulkAssignLevel(levelName) {
    let count = 0;
    State.bld.draft.rows.forEach(r => {
      if (State.bld.selectedIds.has(r.id)) { r.level = levelName; count++; }
    });
    Views.builder.renderQuestions();
    Toast.show(
      levelName
        ? `Assigned "${levelName}" to ${count} question${count !== 1 ? 's' : ''}`
        : `Cleared level from ${count} question${count !== 1 ? 's' : ''}`,
      'success'
    );
  },

  makeQuestionCard(row, idx) {
    const card = document.createElement('div');
    card.className   = 'builder-q-card';
    card.dataset.rowId = row.id;

    const q  = row.question      || { type: 'text', text: '' };
    const ca = row.correctAnswer || { type: 'text', text: '' };
    const qText  = (q.type  === 'text' || q.type  === 'mixed') ? esc(q.text  || '') : '';
    const caText = (ca.type === 'text' || ca.type === 'mixed') ? esc(ca.text || '') : '';
    const qHasImg  = q.type  === 'image' || q.type  === 'mixed' || q.type  === 'local-image';
    const caHasImg = ca.type === 'image' || ca.type === 'mixed' || ca.type === 'local-image';
    const qPos  = q.imgPosition  || 'before';
    const caPos = ca.imgPosition || 'before';
    // lib tag name: for local-image use .name; for mixed/image with library ref use fromLibrary or localImage
    const qLibName  = q.type  === 'local-image' ? q.name  : (q.fromLibrary  || q.localImage  || null);
    const caLibName = ca.type === 'local-image' ? ca.name : (ca.fromLibrary || ca.localImage || null);

    // Level picker — compact badge button + mini popover (only when deck has levels)
    const levels = State.bld.draft.levels || [];
    let levelPickerHtml = '';
    if (levels.length) {
      const curLv = levels.find(l => l.name === row.level);
      const btnHtml = curLv
        ? `<button class="level-badge level-picker-btn" data-role="level-picker-btn" style="background:${esc(curLv.color)};color:${contrastColor(curLv.color)};display:inline-flex;cursor:pointer" title="Change level">${esc(curLv.name)}</button>`
        : `<button class="level-picker-btn level-picker-none" data-role="level-picker-btn" title="Assign level">+ Level</button>`;
      const opts = `<button class="level-picker-opt level-picker-none" data-level="">— None —</button>`
        + levels.map(l => `<div class="level-picker-row"><button class="level-picker-opt level-badge" data-level="${esc(l.name)}" style="background:${esc(l.color)};color:${contrastColor(l.color)};display:inline-flex">${esc(l.name)}</button><button class="level-picker-bulk" data-level="${esc(l.name)}" data-bulk="all" title="Assign to all questions">all</button><button class="level-picker-bulk" data-level="${esc(l.name)}" data-bulk="untagged" title="Assign to questions with no level">untagged</button></div>`).join('');
      levelPickerHtml = `<div class="level-picker" data-role="level-picker">${btnHtml}<div class="level-picker-pop">${opts}</div></div>`;
    }

    const refRaw    = typeof row.reference === 'string' ? (parseCell(row.reference) || null) : (row.reference || null);
    const refText    = refRaw && (refRaw.type === 'text' || refRaw.type === 'mixed') ? esc(refRaw.text || '') : '';
    const refHasImg  = !!(refRaw && (refRaw.type === 'image' || refRaw.type === 'mixed' || refRaw.type === 'local-image'));
    const refPos     = (refRaw && refRaw.imgPosition) || 'before';
    const refLibName = refRaw ? (refRaw.type === 'local-image' ? refRaw.name : (refRaw.fromLibrary || refRaw.localImage || null)) : null;
    const wrongHtml = row.wrongAnswers.map((w, wi) => {
      const wt = (w.type === 'text' || w.type === 'mixed') ? esc(w.text || '') : '';
      const wh = w.type === 'image' || w.type === 'mixed' || w.type === 'local-image';
      const wLibName = w.type === 'local-image' ? w.name : (w.fromLibrary || w.localImage || null);
      const wp = w.imgPosition || 'before';
      return `
      <div class="wrong-answer-row" data-wi="${wi}">
        <textarea class="wrong-text" rows="2" placeholder="Wrong answer ${wi + 1}\u2026">${wt}</textarea>
        <button class="builder-img-btn" title="Upload image" data-role="wrong-img" data-wi="${wi}">${ICON_IMG_UPLOAD}</button>
        <button class="builder-img-btn" title="Pick from library" data-role="wrong-lib" data-wi="${wi}">${ICON_IMG_LIBRARY}</button>
        ${wh ? `<img src="${esc(w.src || '')}" class="builder-img-preview" data-role="wrong-img-preview-${wi}"><button class="builder-img-clear" data-clear-for="wrong" data-wi="${wi}">\u2715 Remove</button>` : ''}
        ${wLibName ? `<span class="local-img-tag wrong-lib-tag">📚 ${esc(wLibName)}</span>` : ''}
        <div class="img-pos-row${w.type === 'mixed' ? '' : ' hidden'}" data-role="wrong-pos-row-${wi}">
          <span class="img-pos-label">Image:</span>
          <button class="img-pos-opt${wp === 'before' ? ' active' : ''}" data-role="wrong-pos-before-${wi}">Above</button>
          <button class="img-pos-opt${wp === 'inline' ? ' active' : ''}" data-role="wrong-pos-inline-${wi}">Inline</button>
          <button class="img-pos-opt${wp === 'after' ? ' active' : ''}" data-role="wrong-pos-after-${wi}">Below</button>
        </div>
        <button class="btn btn-ghost" data-role="del-wrong" data-wi="${wi}" title="Remove this wrong answer">✕</button>
      </div>`;
    }).join('');

    card.innerHTML = `
      <div class="builder-q-card-header">
        <div class="builder-q-header-left">
          ${(State.bld.draft?.levels?.length ?? 0) > 0 ? `<input type="checkbox" class="q-select-cb" title="Select (Shift+click for range)" ${State.bld.selectedIds.has(row.id) ? 'checked' : ''}>` : ''}
          <span class="builder-q-num">Q ${idx + 1}</span>
          ${levelPickerHtml}
        </div>
        <button class="btn btn-secondary btn-sm" data-role="preview-q" title="Preview this question">👁 Preview</button>
        <button class="btn btn-danger btn-sm" data-role="del-q">✕ Remove</button>
      </div>

      <div class="builder-field-label">Question</div>
      <div class="builder-field-row">
        <textarea class="q-text" rows="2" placeholder="Question text…">${qText}</textarea>
        <button class="builder-img-btn" title="Upload image" data-role="q-img">${ICON_IMG_UPLOAD}</button>
        <button class="builder-img-btn" title="Pick from library" data-role="q-lib">${ICON_IMG_LIBRARY}</button>
      </div>
      ${qHasImg ? `<img src="${esc(q.src || '')}" class="builder-img-preview" data-role="q-img-preview"><button class="builder-img-clear" data-clear-for="q">\u2715 Remove</button>` : ''}
      ${qLibName ? `<span class="local-img-tag q-lib-tag">📚 ${esc(qLibName)}</span>` : ''}
      <div class="img-pos-row${(q.type === 'mixed') ? '' : ' hidden'}" data-role="q-pos-row">
        <span class="img-pos-label">Image:</span>
        <button class="img-pos-opt${qPos === 'before' ? ' active' : ''}" data-role="q-pos-before">Above</button>
        <button class="img-pos-opt${qPos === 'inline' ? ' active' : ''}" data-role="q-pos-inline">Inline</button>
        <button class="img-pos-opt${qPos === 'after' ? ' active' : ''}" data-role="q-pos-after">Below</button>
      </div>

      <div class="builder-field-label" style="margin-top:.6rem">Correct Answer</div>
      <div class="builder-field-row">
        <textarea class="ca-text" rows="2" placeholder="Correct answer\u2026">${caText}</textarea>
        <button class="builder-img-btn" title="Upload image" data-role="ca-img">${ICON_IMG_UPLOAD}</button>
        <button class="builder-img-btn" title="Pick from library" data-role="ca-lib">${ICON_IMG_LIBRARY}</button>
      </div>
      ${caHasImg ? `<img src="${esc(ca.src || '')}" class="builder-img-preview" data-role="ca-img-preview"><button class="builder-img-clear" data-clear-for="ca">\u2715 Remove</button>` : ''}
      ${caLibName ? `<span class="local-img-tag ca-lib-tag">📚 ${esc(caLibName)}</span>` : ''}
      <div class="img-pos-row${(ca.type === 'mixed') ? '' : ' hidden'}" data-role="ca-pos-row">
        <span class="img-pos-label">Image:</span>
        <button class="img-pos-opt${caPos === 'before' ? ' active' : ''}" data-role="ca-pos-before">Above</button>
        <button class="img-pos-opt${caPos === 'inline' ? ' active' : ''}" data-role="ca-pos-inline">Inline</button>
        <button class="img-pos-opt${caPos === 'after' ? ' active' : ''}" data-role="ca-pos-after">Below</button>
      </div>

      <div class="wrong-answers-section">
        <div class="builder-field-label" style="margin-top:.6rem">Wrong Answers</div>
        ${wrongHtml}
        <button class="btn btn-ghost mt-1" data-role="add-wrong">+ Add Wrong Answer</button>
      </div>

      <div class="builder-reference-section">
        <div class="builder-field-label" style="margin-top:.6rem">Reference <span class="builder-optional-tag">(optional)</span></div>
        <div class="builder-field-row">
          <textarea class="ref-text" rows="2" placeholder="Reference text shown after answering\u2026">${refText}</textarea>
          <button class="builder-img-btn" title="Upload image" data-role="ref-img">${ICON_IMG_UPLOAD}</button>
          <button class="builder-img-btn" title="Pick from library" data-role="ref-lib">${ICON_IMG_LIBRARY}</button>
        </div>
        ${refHasImg ? `<img src="${esc(refRaw.src || '')}" class="builder-img-preview" data-role="ref-img-preview"><button class="builder-img-clear" data-clear-for="ref">\u2715 Remove</button>` : ''}
        ${refLibName ? `<span class="local-img-tag ref-lib-tag">\ud83d\udcda ${esc(refLibName)}</span>` : ''}
        <div class="img-pos-row${refRaw && refRaw.type === 'mixed' ? '' : ' hidden'}" data-role="ref-pos-row">
          <span class="img-pos-label">Image:</span>
          <button class="img-pos-opt${refPos === 'before' ? ' active' : ''}" data-role="ref-pos-before">Above</button>
          <button class="img-pos-opt${refPos === 'inline' ? ' active' : ''}" data-role="ref-pos-inline">Inline</button>
          <button class="img-pos-opt${refPos === 'after' ? ' active' : ''}" data-role="ref-pos-after">Below</button>
        </div>
      </div>`;

    Views.builder.wireCard(card, row, idx);

    // Async-load library images for local-image / mixed+localImage cells
    const asyncFillPreview = (cell, role) => {
      const libName = cell.type === 'local-image' ? cell.name : (cell.localImage || null);
      if (!libName) return;
      Storage.getImage(libName).then(imgRec => {
        const img = card.querySelector(`[data-role="${role}"]`);
        if (img && imgRec) img.src = imgRec.src;
      });
    };
    asyncFillPreview(q,  'q-img-preview');
    asyncFillPreview(ca, 'ca-img-preview');
    asyncFillPreview(refRaw || {}, 'ref-img-preview');
    row.wrongAnswers.forEach((w, wi) => asyncFillPreview(w, `wrong-img-preview-${wi}`));

    return card;
  },

  wireCard(card, row, idx) {
    const rows = State.bld.draft.rows;

    card.querySelector('[data-role="preview-q"]').addEventListener('click', e => {
      e.stopPropagation();
      Views.builder.previewQuestion(row, idx);
    });

    card.querySelector('[data-role="del-q"]').addEventListener('click', () => {
      Modal.confirm('Remove Question', 'Remove this question?', () => {
        rows.splice(idx, 1);
        Views.builder.renderQuestions();
      });
    });

    // ── question select checkbox (supports Shift+click range) ──────
    const cb = card.querySelector('.q-select-cb');
    if (cb) {
      cb.addEventListener('click', e => {
        if (e.shiftKey && State.bld.lastCheckedId !== null) {
          const allCards = Array.from(document.querySelectorAll('.builder-q-card'));
          const thisIdx  = allCards.indexOf(card);
          const lastCard = allCards.find(c => c.dataset.rowId === State.bld.lastCheckedId);
          const lastIdx  = lastCard ? allCards.indexOf(lastCard) : thisIdx;
          const lo = Math.min(thisIdx, lastIdx), hi = Math.max(thisIdx, lastIdx);
          allCards.slice(lo, hi + 1).forEach(c => {
            const cbox = c.querySelector('.q-select-cb');
            if (cbox) {
              cbox.checked = cb.checked;
              if (cb.checked) State.bld.selectedIds.add(c.dataset.rowId);
              else            State.bld.selectedIds.delete(c.dataset.rowId);
            }
          });
        } else {
          if (cb.checked) State.bld.selectedIds.add(row.id);
          else            State.bld.selectedIds.delete(row.id);
        }
        State.bld.lastCheckedId = row.id;
        Views.builder.updateBulkBar();
      });
    }

    // ── helpers ───────────────────────────────────────────────
    const setImgPreview = (role, src, insertAfterEl) => {
      let p = card.querySelector(`[data-role="${role}"]`);
      if (p) { p.src = src; }
      else {
        p = Object.assign(document.createElement('img'), { src, className: 'builder-img-preview' });
        p.dataset.role = role;
        if (insertAfterEl) insertAfterEl.after(p);
        // add clear button after preview if one doesn't exist
        const clearFor = role.includes('wrong') ? 'wrong' : role.replace('-img-preview', '');
        const wi = role.match(/(\d+)$/)?.[1];
        const clrBtn = document.createElement('button');
        clrBtn.className = 'builder-img-clear';
        clrBtn.dataset.clearFor = clearFor;
        if (wi !== undefined) clrBtn.dataset.wi = wi;
        clrBtn.textContent = '\u2715 Remove';
        p.after(clrBtn);
      }
      return p;
    };

    const updatePosRow = (posRowRole, beforeRole, afterRole, cell) => {
      const el = card.querySelector(`[data-role="${posRowRole}"]`);
      if (!el) return;
      const isMixed = cell && cell.type === 'mixed';
      el.classList.toggle('hidden', !isMixed);
      if (isMixed) {
        const pos = cell.imgPosition || 'before';
        const inlineRole = beforeRole.replace('before', 'inline');
        [[beforeRole,'before'],[inlineRole,'inline'],[afterRole,'after']].forEach(([role, p]) => {
          const btn = el.querySelector(`[data-role="${role}"]`);
          if (btn) btn.classList.toggle('active', pos === p);
        });
      }
    };

    // ── wire a fixed field (question or correctAnswer) ────────
    const wireField = (prefix, textSel, getF, setF) => {
      const textEl   = card.querySelector(textSel);
      const fieldRow = () => card.querySelector(`[data-role="${prefix}-img"]`).closest('.builder-field-row');
      const upPos    = c => updatePosRow(`${prefix}-pos-row`, `${prefix}-pos-before`, `${prefix}-pos-after`, c);

      textEl.addEventListener('input', () => {
        const t = textEl.value, cur = getF();
        const hasImg = cur && (cur.type === 'image' || cur.type === 'mixed') && cur.src;
        setF(hasImg
          ? (t ? { type:'mixed', src:cur.src, fromLibrary:cur.fromLibrary, text:t, imgPosition:cur.imgPosition||'before' }
               : { type:'image', src:cur.src, fromLibrary:cur.fromLibrary })
          : { type:'text', text:t });
        upPos(getF());
      });

      card.querySelector(`[data-role="${prefix}-img"]`).addEventListener('click', () =>
        Views.builder.pickImage((uri, name) => {
          const cur = getF(), t = textEl.value;
          setF(t ? { type:'mixed', text:t, src:uri, fromLibrary:name, imgPosition:(cur&&cur.imgPosition)||'before' }
                 : { type:'image', src:uri, fromLibrary:name });
          const p = setImgPreview(`${prefix}-img-preview`, uri, fieldRow());
          const oldTag = card.querySelector(`.${prefix}-lib-tag`); if (oldTag) oldTag.remove();
          const tag = document.createElement('span');
          tag.className = `local-img-tag ${prefix}-lib-tag`; tag.textContent = `📚 ${name}`;
          p.after(tag);
          upPos(getF());
        })
      );

      card.querySelector(`[data-role="${prefix}-lib"]`).addEventListener('click', () =>
        Views.builder.pickFromLibrary((src, name) => {
          const cur = getF(), t = textEl.value;
          setF(t ? { type:'mixed', text:t, src, fromLibrary:name, imgPosition:(cur&&cur.imgPosition)||'before' }
                 : { type:'image', src, fromLibrary:name });
          const p = setImgPreview(`${prefix}-img-preview`, src, fieldRow());
          const oldTag = card.querySelector(`.${prefix}-lib-tag`); if (oldTag) oldTag.remove();
          const tag = document.createElement('span');
          tag.className = `local-img-tag ${prefix}-lib-tag`; tag.textContent = `📚 ${name}`;
          p.after(tag);
          upPos(getF());
        })
      );

      card.querySelector(`[data-role="${prefix}-pos-before"]`).addEventListener('click', () => {
        const cur = getF();
        if (cur && cur.type === 'mixed') { setF({...cur, imgPosition:'before'}); upPos(getF()); }
      });
      card.querySelector(`[data-role="${prefix}-pos-inline"]`).addEventListener('click', () => {
        const cur = getF();
        if (cur && cur.type === 'mixed') { setF({...cur, imgPosition:'inline'}); upPos(getF()); }
      });
      card.querySelector(`[data-role="${prefix}-pos-after"]`).addEventListener('click', () => {
        const cur = getF();
        if (cur && cur.type === 'mixed') { setF({...cur, imgPosition:'after'}); upPos(getF()); }
      });
    };

    wireField('q',  '.q-text',  () => row.question,     v => { row.question = v; });
    wireField('ca', '.ca-text', () => row.correctAnswer, v => { row.correctAnswer = v; });
    // normalise reference to cell object (handles old plain-string data stored in saved decks)
    if (typeof row.reference === 'string') row.reference = parseCell(row.reference) || null;
    wireField('ref', '.ref-text', () => row.reference, v => { row.reference = v; });

    // ── level picker ──────────────────────────────────────────
    const levelPicker = card.querySelector('[data-role="level-picker"]');
    if (levelPicker) {
      const pickerBtn = levelPicker.querySelector('[data-role="level-picker-btn"]');
      const pop       = levelPicker.querySelector('.level-picker-pop');
      pickerBtn.addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = pop.classList.contains('open');
        document.querySelectorAll('.level-picker-pop.open').forEach(p => p.classList.remove('open'));
        if (!isOpen) pop.classList.add('open');
      });
      pop.addEventListener('click', e => e.stopPropagation());
      pop.querySelectorAll('.level-picker-opt').forEach(opt => {
        opt.addEventListener('click', () => {
          row.level = opt.dataset.level;
          if (row.level) {
            const lv = (State.bld.draft.levels || []).find(l => l.name === row.level);
            if (lv) {
              pickerBtn.textContent = lv.name;
              pickerBtn.className   = 'level-badge level-picker-btn';
              pickerBtn.style.cssText = `background:${lv.color};color:${contrastColor(lv.color)};display:inline-flex;cursor:pointer`;
            }
          } else {
            pickerBtn.textContent = '+ Level';
            pickerBtn.className   = 'level-picker-btn level-picker-none';
            pickerBtn.style.cssText = '';
          }
          pop.classList.remove('open');
        });
      });
      pop.querySelectorAll('.level-picker-bulk').forEach(btn => {
        btn.addEventListener('click', () => {
          const lv = btn.dataset.level;
          const isAll = btn.dataset.bulk === 'all';
          let count = 0;
          State.bld.draft.rows.forEach(r => { if (isAll || !r.level) { r.level = lv; count++; } });
          Views.builder.renderQuestions();
          pop.classList.remove('open');
          Toast.show(`Assigned "${lv}" to ${count} question${count !== 1 ? 's' : ''}`, 'success');
        });
      });
    }

    // ── wrong answers ─────────────────────────────────────────
    card.querySelectorAll('.wrong-text').forEach(ta => {
      ta.addEventListener('input', () => {
        const wi = parseInt(ta.closest('[data-wi]').dataset.wi, 10);
        const t = ta.value, cur = row.wrongAnswers[wi];
        const hasSrcImg   = cur && (cur.type === 'image' || cur.type === 'mixed') && cur.src;
        const hasLocalRef = cur && (cur.type === 'local-image' || (cur.type === 'mixed' && cur.localImage && !cur.src));
        const localName   = hasLocalRef ? (cur.name || cur.localImage) : null;
        if (hasSrcImg) {
          row.wrongAnswers[wi] = t ? { type:'mixed', src:cur.src, fromLibrary:cur.fromLibrary, text:t, imgPosition:cur.imgPosition||'before' }
                                   : { type:'image', src:cur.src, fromLibrary:cur.fromLibrary };
        } else if (hasLocalRef) {
          row.wrongAnswers[wi] = t ? { type:'mixed', localImage:localName, text:t, imgPosition:cur.imgPosition||'before' }
                                   : { type:'local-image', name:localName };
        } else {
          row.wrongAnswers[wi] = { type:'text', text:t };
        }
        updatePosRow(`wrong-pos-row-${wi}`, `wrong-pos-before-${wi}`, `wrong-pos-after-${wi}`, row.wrongAnswers[wi]);
      });
    });

    card.querySelectorAll('[data-role="wrong-img"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const wi = parseInt(btn.dataset.wi, 10);
        Views.builder.pickImage((uri, name) => {
          const section = card.querySelector(`.wrong-answer-row[data-wi="${wi}"]`);
          const t = section.querySelector('.wrong-text').value, cur = row.wrongAnswers[wi];
          row.wrongAnswers[wi] = t ? { type:'mixed', text:t, src:uri, fromLibrary:name, imgPosition:(cur&&cur.imgPosition)||'before' }
                                   : { type:'image', src:uri, fromLibrary:name };
          const p = setImgPreview(`wrong-img-preview-${wi}`, uri, btn);
          let tag = section.querySelector('.wrong-lib-tag');
          if (!tag) { tag = document.createElement('span'); tag.className = 'local-img-tag wrong-lib-tag'; p.after(tag); }
          tag.textContent = `📚 ${name}`;
          updatePosRow(`wrong-pos-row-${wi}`, `wrong-pos-before-${wi}`, `wrong-pos-after-${wi}`, row.wrongAnswers[wi]);
        });
      });
    });

    card.querySelectorAll('[data-role="wrong-lib"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const wi = parseInt(btn.dataset.wi, 10);
        Views.builder.pickFromLibrary((src, name) => {
          const section = card.querySelector(`.wrong-answer-row[data-wi="${wi}"]`);
          const t = section.querySelector('.wrong-text').value, cur = row.wrongAnswers[wi];
          row.wrongAnswers[wi] = t ? { type:'mixed', text:t, src, fromLibrary:name, imgPosition:(cur&&cur.imgPosition)||'before' }
                                   : { type:'image', src, fromLibrary:name };
          const p = setImgPreview(`wrong-img-preview-${wi}`, src, btn);
          let tag = section.querySelector('.wrong-lib-tag');
          if (!tag) { tag = document.createElement('span'); tag.className = 'local-img-tag wrong-lib-tag'; p.after(tag); }
          tag.textContent = `📚 ${name}`;
          updatePosRow(`wrong-pos-row-${wi}`, `wrong-pos-before-${wi}`, `wrong-pos-after-${wi}`, row.wrongAnswers[wi]);
        });
      });
    });

    card.querySelectorAll('[data-role^="wrong-pos-before-"]').forEach(btn => {
      const wi = parseInt(btn.dataset.role.replace('wrong-pos-before-', ''), 10);
      btn.addEventListener('click', () => {
        const cur = row.wrongAnswers[wi];
        if (cur && cur.type === 'mixed') {
          row.wrongAnswers[wi] = {...cur, imgPosition:'before'};
          updatePosRow(`wrong-pos-row-${wi}`, `wrong-pos-before-${wi}`, `wrong-pos-after-${wi}`, row.wrongAnswers[wi]);
        }
      });
    });

    card.querySelectorAll('[data-role^="wrong-pos-inline-"]').forEach(btn => {
      const wi = parseInt(btn.dataset.role.replace('wrong-pos-inline-', ''), 10);
      btn.addEventListener('click', () => {
        const cur = row.wrongAnswers[wi];
        if (cur && cur.type === 'mixed') {
          row.wrongAnswers[wi] = {...cur, imgPosition:'inline'};
          updatePosRow(`wrong-pos-row-${wi}`, `wrong-pos-before-${wi}`, `wrong-pos-after-${wi}`, row.wrongAnswers[wi]);
        }
      });
    });

    card.querySelectorAll('[data-role^="wrong-pos-after-"]').forEach(btn => {
      const wi = parseInt(btn.dataset.role.replace('wrong-pos-after-', ''), 10);
      btn.addEventListener('click', () => {
        const cur = row.wrongAnswers[wi];
        if (cur && cur.type === 'mixed') {
          row.wrongAnswers[wi] = {...cur, imgPosition:'after'};
          updatePosRow(`wrong-pos-row-${wi}`, `wrong-pos-before-${wi}`, `wrong-pos-after-${wi}`, row.wrongAnswers[wi]);
        }
      });
    });

    card.querySelectorAll('[data-role="del-wrong"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const wi = parseInt(btn.dataset.wi, 10);
        row.wrongAnswers.splice(wi, 1);
        Views.builder.renderQuestions();
      });
    });

    card.querySelector('[data-role="add-wrong"]').addEventListener('click', () => {
      row.wrongAnswers.push({ type: 'text', text: '' });
      Views.builder.renderQuestions();
    });

    // ── clear image buttons (delegated) ──────────────────────
    card.addEventListener('click', e => {
      const btn = e.target.closest('.builder-img-clear');
      if (!btn) return;
      const f = btn.dataset.clearFor;
      const wi = btn.dataset.wi !== undefined ? parseInt(btn.dataset.wi, 10) : -1;
      if (f === 'q' || f === 'ca') {
        const textEl = card.querySelector(f === 'q' ? '.q-text' : '.ca-text');
        const t = textEl ? textEl.value : '';
        if (f === 'q') row.question = { type: 'text', text: t };
        else           row.correctAnswer = { type: 'text', text: t };
        const p = card.querySelector(`[data-role="${f}-img-preview"]`); if (p) p.remove();
        const tag = card.querySelector(`.${f}-lib-tag`); if (tag) tag.remove();
        btn.remove();
        updatePosRow(`${f}-pos-row`, `${f}-pos-before`, `${f}-pos-after`, f === 'q' ? row.question : row.correctAnswer);
      } else if (f === 'wrong' && wi >= 0) {
        const section = card.querySelector(`.wrong-answer-row[data-wi="${wi}"]`);
        const t = section?.querySelector('.wrong-text')?.value || '';
        row.wrongAnswers[wi] = { type: 'text', text: t };
        const p = card.querySelector(`[data-role="wrong-img-preview-${wi}"]`); if (p) p.remove();
        const tag = section?.querySelector('.wrong-lib-tag'); if (tag) tag.remove();
        btn.remove();
        updatePosRow(`wrong-pos-row-${wi}`, `wrong-pos-before-${wi}`, `wrong-pos-after-${wi}`, row.wrongAnswers[wi]);
      } else if (f === 'ref') {
        const t = card.querySelector('.ref-text')?.value || '';
        row.reference = t ? { type: 'text', text: t } : null;
        const p = card.querySelector('[data-role="ref-img-preview"]'); if (p) p.remove();
        const tag = card.querySelector('.ref-lib-tag'); if (tag) tag.remove();
        btn.remove();
        updatePosRow('ref-pos-row', 'ref-pos-before', 'ref-pos-after', row.reference);
      }
    });
  },

  async pickFromLibrary(onPick) {
    const images = await Storage.getAllImages();
    if (!images.length) {
      Toast.show('No images in library. Upload some on the Data page first.', 'warning', 4000);
      return;
    }
    const container = document.createElement('div');
    container.className = 'image-lib-picker';

    // Group images
    const groups = {};
    images.forEach(img => {
      const g = img.group || '';
      if (!groups[g]) groups[g] = [];
      groups[g].push(img);
    });
    const keys = Object.keys(groups).sort((a, b) => {
      if (a === '') return -1;
      if (b === '') return 1;
      return a.localeCompare(b);
    });
    const showHeaders = keys.length > 1;

    keys.forEach(key => {
      if (showHeaders) {
        const header = document.createElement('div');
        header.className = 'image-lib-group-header';
        header.textContent = key || 'General';
        container.appendChild(header);
      }
      const subGrid = document.createElement('div');
      subGrid.className = 'image-lib-grid';
      groups[key].forEach(img => {
        const btn = document.createElement('button');
        btn.className = 'image-lib-pick-btn';
        btn.innerHTML = `<img src="${esc(img.src)}" class="image-lib-thumb" alt="${esc(img.name)}">
          <span class="image-lib-name">${esc(img.name)}</span>`;
        btn.addEventListener('click', () => { Modal.hide(); onPick(img.src, img.name); });
        subGrid.appendChild(btn);
      });
      container.appendChild(subGrid);
    });
    Modal.show({ title: '📚 Pick from Library', body: container, wide: true, buttons: [{ label: 'Cancel' }] });
  },

  pickImage(onPick) {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        Toast.show('Image must be under 2 MB', 'warning'); return;
      }
      const uri = await fileToDataURI(file);
      const name = file.name;
      const group = State.bld.draft ? State.bld.draft.name : '';
      await Storage.saveImage(name, uri, group);
      onPick(uri, name);
    };
    input.click();
  },

  addQuestion() {
    State.bld.draft.rows.push({
      id: genId(),
      level:         '',
      question:      { type: 'text', text: '' },
      correctAnswer: { type: 'text', text: '' },
      wrongAnswers:  [{ type: 'text', text: '' }],
      reference:     null
    });
    Views.builder.renderQuestions();
    // scroll to bottom
    setTimeout(() => {
      const ql = document.getElementById('builder-questions-list');
      ql.lastElementChild && ql.lastElementChild.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  },

  async save() {
    const draft = State.bld.draft;
    draft.name  = document.getElementById('deck-name-input').value.trim() || 'Untitled Deck';

    // sync textarea values to draft
    document.querySelectorAll('.builder-q-card').forEach(card => {
      const rowId = card.dataset.rowId;
      const row   = draft.rows.find(r => r.id === rowId);
      if (!row) return;
      const qText  = card.querySelector('.q-text').value.trim();
      const caText = card.querySelector('.ca-text').value.trim();
      if (row.question.type === 'text' && qText)       row.question      = { type: 'text', text: qText };
      if (row.question.type === 'mixed')                row.question      = { ...row.question, text: qText };
      if (row.correctAnswer.type === 'text' && caText)  row.correctAnswer = { type: 'text', text: caText };
      if (row.correctAnswer.type === 'mixed')           row.correctAnswer = { ...row.correctAnswer, text: caText };
      card.querySelectorAll('.wrong-text').forEach((ta, wi) => {
        if (row.wrongAnswers[wi]) {
          const t = ta.value.trim();
          if (row.wrongAnswers[wi].type === 'text')  row.wrongAnswers[wi] = { type: 'text', text: t };
          if (row.wrongAnswers[wi].type === 'mixed') row.wrongAnswers[wi] = { ...row.wrongAnswers[wi], text: t };
        }
      });
      const refTextEl = card.querySelector('.ref-text');
      if (refTextEl) {
        const refTxt = refTextEl.value.trim();
        if (!row.reference || typeof row.reference === 'string' || row.reference.type === 'text') {
          row.reference = refTxt ? { type: 'text', text: refTxt } : null;
        } else if (row.reference.type === 'mixed') {
          row.reference = { ...row.reference, text: refTxt };
        }
        // image / local-image: no text component — leave cell unchanged
      }
    });

    // filter empty rows
    draft.rows = draft.rows.filter(r => {
      const q = r.question; const c = r.correctAnswer;
      const qOk = q.type === 'image' ? q.src : q.type === 'local-image' ? q.name : q.text;
      const cOk = c.type === 'image' ? c.src : c.type === 'local-image' ? c.name : c.text;
      return qOk && cOk;
    });

    // migrate any inline data-URI images (no fromLibrary) to the image library
    try {
      const extFromDataURI = src => {
        const m = src.match(/^data:image\/([a-z0-9+]+);/i);
        if (!m) return 'png';
        const t = m[1].toLowerCase();
        return t === 'jpeg' ? 'jpg' : t === 'svg+xml' ? 'svg' : t;
      };
      let imgIdx = 0;
      const migrateCell = async cell => {
        if (!cell) return;
        if ((cell.type === 'image' || cell.type === 'mixed') &&
            cell.src && /^data:image\//i.test(cell.src) && !cell.fromLibrary) {
          const name = `${draft.name}-img-${++imgIdx}.${extFromDataURI(cell.src)}`;
          await Storage.saveImage(name, cell.src, draft.name);
          cell.fromLibrary = name;
        }
      };
      for (const row of draft.rows) {
        await migrateCell(row.question);
        await migrateCell(row.correctAnswer);
        for (const w of (row.wrongAnswers || [])) await migrateCell(w);
      }
      if (imgIdx) Toast.show(`Saved ${imgIdx} image(s) to library`, 'success');
    } catch (err) {
      Toast.show(`Image migration failed: ${err.message}`, 'error');
    }

    await Storage.saveDataset(draft);
    Toast.show(`Deck "${draft.name}" saved (${draft.rows.length} questions)`, 'success');
    State.bld.editingId = null;
    document.getElementById('builder-editor').classList.add('hidden');
    Views.builder.renderDeckList();
  },

  async previewQuestion(row, idx) {
    // Resolve [LOCAL:name] references to real data URIs before rendering
    const [resolved] = await resolveLocalImages([row]);
    const levels = State.bld.draft?.levels || [];
    const lv = levels.find(l => l.name === resolved.level);
    const refCell = resolved.referenceCell ?? parseCell(resolved.reference || '') ?? null;
    const levelBadgeHtml = lv
      ? `<span class="level-badge" style="background:${esc(lv.color)};color:${contrastColor(lv.color)};display:inline-flex">${esc(lv.name)}</span>`
      : '';

    const wrap = document.createElement('div');
    wrap.className = 'preview-wrap';
    wrap.innerHTML = `
      <div class="preview-tabs" role="tablist">
        <button class="preview-tab active" data-ptab="flashcard">🃏 Flashcard</button>
        <button class="preview-tab" data-ptab="quiz">✏️ Quiz</button>
      </div>
      <div class="preview-pane" data-ppane="flashcard"></div>
      <div class="preview-pane preview-pane-hidden" data-ppane="quiz"></div>`;

    // ── Flashcard pane ──────────────────────────────────────────
    const fcPane = wrap.querySelector('[data-ppane="flashcard"]');
    fcPane.innerHTML = `
      <p class="preview-hint">Click the card to flip</p>
      <div class="fc-card preview-fc-card" tabindex="0" role="button" aria-label="Flip card">
        <div class="fc-card-inner" id="pv-fc-inner">
          <div class="fc-face fc-front">
            <div class="fc-card-top">
              <div class="fc-label-badge">Question</div>
              ${levelBadgeHtml}
            </div>
            <div class="fc-content" id="pv-fc-front"></div>
            <div class="fc-hint">Click or press Space to reveal</div>
          </div>
          <div class="fc-face fc-back">
            <div class="fc-label-badge fc-back-badge">Answer</div>
            <div class="fc-content" id="pv-fc-back"></div>
            <div id="pv-fc-ref" class="fc-back-reference hidden"></div>
          </div>
        </div>
      </div>`;

    // ── Quiz pane ───────────────────────────────────────────────
    const qzPane = wrap.querySelector('[data-ppane="quiz"]');
    const choices = shuffle([
      { cell: resolved.correctAnswer, correct: true },
      ...resolved.wrongAnswers.map(w => ({ cell: w, correct: false }))
    ]);
    if (!choices.some(c => c.correct)) {
      qzPane.innerHTML = '<p class="preview-hint">Add at least one wrong answer to preview quiz mode.</p>';
    } else {
      qzPane.innerHTML = `
        <div class="question-content" id="pv-qz-q" style="margin-bottom:.85rem"></div>
        <div class="quiz-choices" id="pv-qz-choices">
          ${choices.map((c, i) => `
            <button class="choice-btn" data-correct="${c.correct}" data-ci="${i}">
              <span class="choice-letter">${i + 1}</span>
              <span class="choice-content" id="pv-choice-${i}"></span>
            </button>`).join('')}
        </div>
        <div id="pv-qz-feedback" class="quiz-feedback hidden">
          <div id="pv-fb-msg" class="feedback-msg"></div>
          ${refCell ? '<div id="pv-fb-ref" class="feedback-reference hidden"></div>' : ''}
        </div>`;
    }

    Modal.show({
      title: `👁 Preview — Q ${idx + 1}`,
      body:  wrap,
      wide:  true,
      buttons: [{ label: 'Close' }]
    });

    // Focus the card on first open so Space/Enter flips immediately
    requestAnimationFrame(() => fcPane.querySelector('.preview-fc-card')?.focus());

    // Render flashcard cells
    renderCell(resolved.question,       document.getElementById('pv-fc-front'));
    renderCell(resolved.correctAnswer,  document.getElementById('pv-fc-back'));
    if (refCell) {
      const refEl = document.getElementById('pv-fc-ref');
      renderCell(refCell, refEl);
      refEl.classList.remove('hidden');
    }

    // Flashcard flip — toggle 'flipped' on the outer .fc-card (CSS targets .fc-card.flipped)
    const fcCard = fcPane.querySelector('.preview-fc-card');
    const doFlip = () => fcCard.classList.toggle('flipped');
    fcCard.addEventListener('click', doFlip);
    fcCard.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doFlip(); }
    });

    // Render quiz question + choices
    const qzQ = document.getElementById('pv-qz-q');
    if (qzQ) {
      renderCell(resolved.question, qzQ);
      choices.forEach((c, i) => {
        const el = document.getElementById(`pv-choice-${i}`);
        if (el) renderCell(c.cell, el);
      });

      // Quiz answer interaction
      const feedback = document.getElementById('pv-qz-feedback');
      qzPane.querySelectorAll('.choice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          const correct = btn.dataset.correct === 'true';
          qzPane.querySelectorAll('.choice-btn').forEach(b => {
            b.classList.add(b.dataset.correct === 'true' ? 'correct' : 'wrong');
            b.disabled = true;
          });
          const msgEl = document.getElementById('pv-fb-msg');
          msgEl.textContent = correct ? '✅ Correct!' : '❌ Incorrect';
          msgEl.className   = `feedback-msg ${correct ? 'correct' : 'wrong'}`;
          feedback.classList.remove('hidden');
          const fbRef = document.getElementById('pv-fb-ref');
          if (fbRef && refCell) {
            renderCell(refCell, fbRef);
            fbRef.classList.remove('hidden');
          }
        });
      });

      // Quiz keyboard: digit keys 1–9 select answers
      const pickChoice = idx => {
        const btn = qzPane.querySelectorAll('.choice-btn')[idx];
        if (btn && !btn.disabled) btn.click();
      };
      wrap.addEventListener('keydown', e => {
        if (wrap.closest('#modal-overlay')?.classList.contains('hidden')) return;
        const n = parseInt(e.key, 10);
        if (!isNaN(n) && n >= 1 && n <= choices.length &&
            !qzPane.classList.contains('preview-pane-hidden')) {
          e.preventDefault();
          pickChoice(n - 1);
        }
      });
    }

    // Tab switching — reset both panes on each switch; move focus to the interactive element
    wrap.querySelectorAll('.preview-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        wrap.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        wrap.querySelectorAll('.preview-pane').forEach(p =>
          p.classList.toggle('preview-pane-hidden', p.dataset.ppane !== tab.dataset.ptab)
        );
        // Reset flashcard to front face
        fcCard.classList.remove('flipped');
        // Reset quiz choices and feedback
        qzPane.querySelectorAll('.choice-btn').forEach(b => {
          b.classList.remove('correct', 'wrong');
          b.disabled = false;
        });
        const fb = document.getElementById('pv-qz-feedback');
        if (fb) fb.classList.add('hidden');
        // Move focus so Space/Enter and digit keys work immediately
        requestAnimationFrame(() => {
          if (tab.dataset.ptab === 'flashcard') {
            fcCard.focus();
          } else {
            const first = qzPane.querySelector('.choice-btn:not(:disabled)');
            if (first) first.focus();
          }
        });
      });
    });
  },

  async saveAsCopy() {
    const draft = State.bld.draft;
    if (!draft) return;
    const baseName = (document.getElementById('deck-name-input').value.trim() || draft.name || 'Untitled Deck');
    const copy = JSON.parse(JSON.stringify(draft));
    copy.id        = genId();
    copy.name      = `Copy of ${baseName}`;
    copy.createdAt = new Date().toISOString();
    copy.rows      = copy.rows.filter(r => {
      const q = r.question; const c = r.correctAnswer;
      const qOk = q.type === 'image' ? q.src : q.type === 'local-image' ? q.name : q.text;
      const cOk = c.type === 'image' ? c.src : c.type === 'local-image' ? c.name : c.text;
      return qOk && cOk;
    });
    if (!copy.rows.length) { Toast.show('No complete questions to copy', 'warning'); return; }
    await Storage.saveDataset(copy);
    Toast.show(`Saved as "${copy.name}" (${copy.rows.length} questions)`, 'success');
  },

  showLevelsDialog() {
    const draft = State.bld.draft;
    if (!draft) return;
    draft.levels = draft.levels || [];

    const swatchMarkup = COLOR_PALETTE.map(c =>
      `<button class="clr-swatch" data-color="${c}" style="background:${c}" title="${c}"></button>`
    ).join('');

    const renderRows = () => {
      const container = document.getElementById('levels-rows-container');
      if (!container) return;
      container.innerHTML = '';
      draft.levels.forEach((lv, i) => {
        const row = document.createElement('div');
        row.className = 'level-row';
        row.innerHTML = `
          <div class="clr-picker-wrap">
            <button class="clr-swatch-btn" style="background:${esc(lv.color)}" title="Pick colour"></button>
            <div class="clr-palette-pop" hidden>
              <div class="clr-palette-grid">${swatchMarkup}</div>
              <div class="clr-custom-row">
                <span class="clr-custom-label">Custom:</span>
                <input type="color" class="clr-custom-input" value="${esc(lv.color)}">
              </div>
            </div>
          </div>
          <input type="text" class="input level-name-input" value="${esc(lv.name)}" placeholder="Level name\u2026" maxlength="40">
          <span class="level-badge" style="background:${esc(lv.color)};color:${contrastColor(lv.color)};display:inline-flex">${esc(lv.name || '?')}</span>
          <button class="btn btn-ghost btn-sm lv-assign-btn" data-assign-bulk="all" title="Assign this level to all questions">All Qs</button>
          <button class="btn btn-ghost btn-sm lv-assign-btn" data-assign-bulk="untagged" title="Assign to questions with no level currently">Untagged</button>
          <button class="btn btn-danger btn-sm" data-del="${i}" title="Remove level">\u2715</button>`;

        const swatchBtn = row.querySelector('.clr-swatch-btn');
        const pop       = row.querySelector('.clr-palette-pop');
        const customIn  = row.querySelector('.clr-custom-input');
        const nameIn    = row.querySelector('.level-name-input');
        const badge     = row.querySelector('.level-badge');

        const applyColor = color => {
          lv.color = color;
          swatchBtn.style.background = color;
          customIn.value = color;
          badge.style.background = color;
          badge.style.color = contrastColor(color);
        };

        swatchBtn.addEventListener('click', e => {
          e.stopPropagation();
          const isOpen = !pop.hidden;
          document.querySelectorAll('.clr-palette-pop').forEach(p => { p.hidden = true; });
          if (!isOpen) {
            pop.hidden = false;
            const rect = swatchBtn.getBoundingClientRect();
            const popW = 220, popH = 230;
            let left = rect.left;
            let top  = rect.bottom + 4;
            if (left + popW > window.innerWidth  - 8) left = window.innerWidth  - popW - 8;
            if (top  + popH > window.innerHeight - 8) top  = rect.top - popH - 4;
            pop.style.left = Math.max(8, left) + 'px';
            pop.style.top  = Math.max(8, top)  + 'px';
          }
        });
        pop.addEventListener('click', e => e.stopPropagation());

        pop.querySelectorAll('.clr-swatch').forEach(s => {
          s.addEventListener('click', () => { applyColor(s.dataset.color); pop.hidden = true; });
        });
        customIn.addEventListener('input', () => applyColor(customIn.value));

        nameIn.addEventListener('input', () => {
          lv.name = nameIn.value;
          badge.textContent = lv.name || '?';
        });
        row.querySelector('[data-del]').addEventListener('click', () => {
          draft.levels.splice(i, 1);
          renderRows();
        });
        row.querySelector('[data-assign-bulk="all"]').addEventListener('click', () => {
          if (!lv.name.trim()) { Toast.show('Give this level a name first', 'warning'); return; }
          State.bld.draft.rows.forEach(r => { r.level = lv.name; });
          Toast.show(`Assigned "${lv.name}" to all ${State.bld.draft.rows.length} questions`, 'success');
        });
        row.querySelector('[data-assign-bulk="untagged"]').addEventListener('click', () => {
          if (!lv.name.trim()) { Toast.show('Give this level a name first', 'warning'); return; }
          let count = 0;
          State.bld.draft.rows.forEach(r => { if (!r.level) { r.level = lv.name; count++; } });
          Toast.show(
            count ? `Assigned "${lv.name}" to ${count} untagged question${count !== 1 ? 's' : ''}` : 'No untagged questions',
            count ? 'success' : 'info'
          );
        });

        container.appendChild(row);
      });
    };

    // Close all palette pops when clicking outside
    const closeAllPops = () =>
      document.querySelectorAll('.clr-palette-pop').forEach(p => { p.hidden = true; });
    document.addEventListener('click', closeAllPops);

    const wrap = document.createElement('div');
    wrap.className = 'levels-manager';
    wrap.innerHTML = `
      <p style="margin:0 0 .4rem;font-size:.85rem;color:var(--clr-text-muted)">
        Define the levels for this deck (e.g. Easy, Medium, Hard). Each question can then be tagged with a level.
        Colours are shown as a badge on flashcards and quiz questions.
      </p>
      <div id="levels-rows-container" class="levels-manager"></div>
      <button id="btn-add-level" class="btn btn-primary btn-sm" style="align-self:flex-start">+ Add Level</button>`;

    Modal.show({
      title: '\ud83c\udff7 Manage Levels',
      body: wrap,
      wide: true,
      buttons: [{ label: 'Done', cls: 'btn-primary', action: () => {
        document.removeEventListener('click', closeAllPops);
        draft.levels = draft.levels.filter(l => l.name.trim());
        Views.builder.renderQuestions();
        Modal.hide();
      }}]
    });

    renderRows();

    document.getElementById('btn-add-level').addEventListener('click', () => {
      draft.levels.push({
        name: '',
        color: LEVEL_COLORS[draft.levels.length % LEVEL_COLORS.length]
      });
      renderRows();
      const container = document.getElementById('levels-rows-container');
      const last = container && container.lastElementChild;
      if (last) last.querySelector('.level-name-input')?.focus();
    });
  },

  showExportDialog() {
    const draft = State.bld.draft;
    if (!draft || !draft.rows.length) { Toast.show('Nothing to export', 'warning'); return; }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:.9rem';
    wrap.innerHTML = `
      <div>
        <label style="display:block;font-size:.85rem;margin-bottom:.3rem;color:var(--clr-text-muted)">File name</label>
        <input id="export-filename" type="text" class="deck-name-input" style="width:100%;box-sizing:border-box"
          value="${esc(draft.name || 'deck')}" maxlength="100" autocomplete="off">
      </div>
      <div>
        <label style="display:block;font-size:.85rem;margin-bottom:.4rem;color:var(--clr-text-muted)">Format</label>
        <div style="display:flex;gap:1.2rem;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
            <input type="radio" name="export-fmt" value="csv" checked> CSV (.csv)
          </label>
          <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
            <input type="radio" name="export-fmt" value="xlsx"> Excel (.xlsx)
          </label>
          <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
            <input type="radio" name="export-fmt" value="bundle"> Bundle ZIP (deck + images)
          </label>
        </div>
        <div id="bundle-fmt-row" style="display:none;margin-top:.5rem;padding:.4rem .6rem;background:var(--clr-surface-2,#f0f0f0);border-radius:.4rem">
          <span style="font-size:.82rem;color:var(--clr-text-muted);margin-right:.6rem">Deck format inside ZIP:</span>
          <label style="display:inline-flex;align-items:center;gap:.3rem;cursor:pointer;font-size:.85rem;margin-right:.8rem">
            <input type="radio" name="bundle-deck-fmt" value="csv" checked> CSV
          </label>
          <label style="display:inline-flex;align-items:center;gap:.3rem;cursor:pointer;font-size:.85rem">
            <input type="radio" name="bundle-deck-fmt" value="xlsx"> Excel (.xlsx)
          </label>
        </div>
        <p style="font-size:.78rem;color:var(--clr-text-muted);margin:.4rem 0 0">Excel preserves multi-line cells (text&thinsp;+&thinsp;image) correctly when opened in Excel. Bundle packages the deck and all its library images into one ZIP for easy transfer.</p>
      </div>`;

    Modal.show({ title: '⬇ Export Deck', body: wrap, wide: true, buttons: [
      { label: 'Cancel' },
      { label: 'Export', cls: 'btn-primary', action: () => {
        const filename = (document.getElementById('export-filename').value.trim() || draft.name || 'deck');
        const fmt = wrap.querySelector('input[name="export-fmt"]:checked').value;
        if (fmt === 'bundle') {
          const bundleDeckFmt = wrap.querySelector('input[name="bundle-deck-fmt"]:checked').value;
          exportBundle(draft, filename, bundleDeckFmt);
        } else if (fmt === 'xlsx') {
          if (typeof XLSX === 'undefined') { Toast.show('SheetJS not loaded — use CSV instead', 'warning'); return; }
          DataExport.datasetToXLSX(draft, filename);
        } else {
          const csv  = DataExport.datasetToCSV(draft);
          const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
          const url  = URL.createObjectURL(blob);
          const a    = Object.assign(document.createElement('a'), { href: url, download: filename + '.csv' });
          document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(url);
        }
      }}
    ]});
    setTimeout(() => {
      const inp = document.getElementById('export-filename');
      if (inp) { inp.select(); inp.focus(); }
      // Show/hide bundle sub-options when format radios change
      const fmtRadios    = wrap.querySelectorAll('input[name="export-fmt"]');
      const bundleFmtRow = wrap.querySelector('#bundle-fmt-row');
      const toggleBundle = () => {
        const isBundle = wrap.querySelector('input[name="export-fmt"]:checked')?.value === 'bundle';
        bundleFmtRow.style.display = isBundle ? 'block' : 'none';
      };
      fmtRadios.forEach(r => r.addEventListener('change', toggleBundle));
    }, 50);
  },

  closeEditor() {
    if (State.bld.draft) {
      Modal.confirm('Close Editor', 'Unsaved changes will be lost. Close anyway?', () => {
        State.bld.editingId = null;
        State.bld.draft     = null;
        document.getElementById('builder-editor').classList.add('hidden');
        Views.builder.renderDeckList();
      });
    }
  }
};

// ============================================================
// VIEW: BUILDER – SPLIT
// ============================================================
Views.builder.split = {
  open(ds) {
    const levels = ds.levels || [];
    State.bld.sp = {
      ds,
      selectedIds:      new Set(ds.rows.map(r => r.id)),
      lastChecked:      null,
      search:           '',
      activeLevels:     new Set(levels.map(l => l.name)),
      includeUnlabeled: true
    };
    document.getElementById('builder-deck-list').classList.add('hidden');
    document.getElementById('builder-editor').classList.add('hidden');
    document.getElementById('builder-combine').classList.add('hidden');
    document.getElementById('builder-split').classList.remove('hidden');
    Views.builder.split.render();
  },

  close() {
    document.getElementById('builder-split').classList.add('hidden');
    State.bld.sp = null;
    Views.builder.renderDeckList();
  },

  render() {
    const { ds, selectedIds, search, activeLevels, includeUnlabeled } = State.bld.sp;
    const panel  = document.getElementById('builder-split');
    const levels = ds.levels || [];
    const needle = search.trim().toLowerCase();

    let filtered = needle
      ? ds.rows.filter(r => {
          const refCell = r.referenceCell ?? (typeof r.reference === 'string' ? parseCell(r.reference) : r.reference);
          const haystack = [r.question, r.correctAnswer, ...(r.wrongAnswers || []), refCell]
            .map(cellLabel).join(' ').toLowerCase();
          return haystack.includes(needle);
        })
      : ds.rows;

    // Visibility filter by active levels
    filtered = filtered.filter(r =>
      r.level ? activeLevels.has(r.level) : includeUnlabeled
    );

    const totalSel   = selectedIds.size;
    const hasUnlabel = ds.rows.some(r => !r.level);
    const levelFilterHtml = levels.length ? `
      <div class="sc-level-filters">
        ${levels.map(l => `<button class="level-badge lf-badge-toggle${activeLevels.has(l.name) ? '' : ' lf-badge-off'}" data-lf="${esc(l.name)}" style="background:${esc(l.color)};color:${contrastColor(l.color)}">${esc(l.name)}</button>`).join('')}
        ${hasUnlabel ? `<button class="level-badge lf-badge-toggle lf-badge-unlabeled${includeUnlabeled ? '' : ' lf-badge-off'}" data-lf="">Unlabeled</button>` : ''}
      </div>` : '';

    panel.innerHTML = `
      <div class="sc-header card">
        <div class="sc-title-row">
          <button id="btn-split-back" class="btn btn-ghost">\u2190 Back</button>
          <h3 class="sc-title">\u2702 Split: <em>${esc(ds.name)}</em></h3>
        </div>
        ${levelFilterHtml}
        <div class="sc-toolbar">
          <button id="btn-split-all"  class="btn btn-ghost btn-sm">Select All</button>
          <button id="btn-split-none" class="btn btn-ghost btn-sm">Deselect All</button>
          <span class="sc-count">${totalSel} of ${ds.rows.length} selected${filtered.length < ds.rows.length ? ` \u00b7 ${filtered.length} shown` : ''}</span>
          <input type="search" id="split-search" class="sc-search builder-search-input"
            placeholder="\ud83d\udd0d Filter questions\u2026" value="${esc(search)}">
        </div>
      </div>
      <div class="sc-list" id="split-q-list">
        ${filtered.length === 0
          ? `<div class="empty-state"><p>No questions match.</p></div>`
          : filtered.map(r => {
              const lv    = levels.find(l => l.name === r.level);
              const badge = lv
                ? `<span class="level-badge sc-level-chip" style="background:${esc(lv.color)};color:${contrastColor(lv.color)}">${esc(lv.name)}</span>`
                : '';
              return `<div class="sc-q-item${selectedIds.has(r.id) ? ' sc-q-sel' : ''}" data-id="${esc(r.id)}">
                <input type="checkbox" class="sc-cb" ${selectedIds.has(r.id) ? 'checked' : ''}>
                ${badge}
                <span class="sc-q-body">
                  <span class="sc-q-text">${esc(cellLabel(r.question))}</span>
                  <span class="sc-q-sub">\u2192 ${esc(cellLabel(r.correctAnswer))}</span>
                </span>
              </div>`;
            }).join('')
        }
      </div>
      <div class="sc-footer card">
        <div class="sc-name-row">
          <label class="sc-label">New deck name</label>
          <input type="text" id="split-name-input" class="deck-name-input sc-name-input"
            placeholder="${esc(ds.name)} (split)" maxlength="80" value="${esc(ds.name + ' (split)')}">
        </div>
        <div class="sc-save-row">
          <button id="btn-split-save"   class="btn btn-success">\ud83d\udcbe Save as New Deck</button>
          <button id="btn-split-export" class="btn btn-secondary">\u2b07 Export</button>
        </div>
      </div>`;

    document.getElementById('btn-split-back').addEventListener('click', () => Views.builder.split.close());

    // Level visibility toggles — toggling OFF also deselects that level's questions
    // so the export always matches exactly what is visibly checked
    panel.querySelectorAll('[data-lf]').forEach(btn => {
      btn.addEventListener('click', () => {
        const lf = btn.dataset.lf;
        if (lf === '') {
          State.bld.sp.includeUnlabeled = !State.bld.sp.includeUnlabeled;
          if (!State.bld.sp.includeUnlabeled) {
            ds.rows.filter(r => !r.level).forEach(r => State.bld.sp.selectedIds.delete(r.id));
          }
        } else if (State.bld.sp.activeLevels.has(lf)) {
          State.bld.sp.activeLevels.delete(lf);
          ds.rows.filter(r => r.level === lf).forEach(r => State.bld.sp.selectedIds.delete(r.id));
        } else {
          State.bld.sp.activeLevels.add(lf);
        }
        Views.builder.split.render();
      });
    });

    document.getElementById('btn-split-all').addEventListener('click', () => {
      filtered.forEach(r => State.bld.sp.selectedIds.add(r.id));
      Views.builder.split.render();
    });
    document.getElementById('btn-split-none').addEventListener('click', () => {
      filtered.forEach(r => State.bld.sp.selectedIds.delete(r.id));
      Views.builder.split.render();
    });
    document.getElementById('split-search').addEventListener('input', e => {
      State.bld.sp.search = e.target.value;
      Views.builder.split.render();
    });

    // Row click — div click events carry shiftKey, fixing shift-range selection
    panel.querySelectorAll('.sc-q-item').forEach(item => {
      item.addEventListener('click', e => {
        const id    = item.dataset.id;
        const nowOn = !State.bld.sp.selectedIds.has(id);
        if (e.shiftKey && State.bld.sp.lastChecked) {
          const ids = filtered.map(r => r.id);
          const i1  = ids.indexOf(State.bld.sp.lastChecked);
          const i2  = ids.indexOf(id);
          const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
          for (let i = lo; i <= hi; i++) {
            if (nowOn) State.bld.sp.selectedIds.add(ids[i]);
            else       State.bld.sp.selectedIds.delete(ids[i]);
          }
        } else {
          if (nowOn) State.bld.sp.selectedIds.add(id);
          else       State.bld.sp.selectedIds.delete(id);
          State.bld.sp.lastChecked = id;
        }
        Views.builder.split.render();
      });
    });

    document.getElementById('btn-split-save').addEventListener('click',   () => Views.builder.split.saveAsDeck());
    document.getElementById('btn-split-export').addEventListener('click', () => Views.builder.split.exportSelected());
  },

  _buildDs() {
    const { ds, selectedIds } = State.bld.sp;
    const name   = document.getElementById('split-name-input')?.value.trim() || ds.name + ' (split)';
    const rows   = ds.rows.filter(r => selectedIds.has(r.id)).map(r => ({ ...r, id: genId() }));
    const used   = new Set(rows.map(r => r.level).filter(Boolean));
    const levels = (ds.levels || []).filter(l => used.has(l.name));
    return { id: genId(), name, createdAt: new Date().toISOString(), levels, rows };
  },

  saveAsDeck() {
    if (!State.bld.sp.selectedIds.size) { Toast.show('Select at least one question', 'warning'); return; }
    const newDs = Views.builder.split._buildDs();
    Modal.confirm(
      'Save as New Deck',
      `Save ${newDs.rows.length} question${newDs.rows.length !== 1 ? 's' : ''} as \u201c${newDs.name}\u201d?`,
      async () => {
        await Storage.saveDataset(newDs);
        Toast.show(`Saved \u201c${newDs.name}\u201d (${newDs.rows.length} questions)`, 'success');
        Views.builder.split.close();
      },
      'Save', 'btn-success'
    );
  },

  exportSelected() {
    if (!State.bld.sp.selectedIds.size) { Toast.show('Select at least one question', 'warning'); return; }
    const saved = State.bld.draft;
    State.bld.draft = Views.builder.split._buildDs();
    Views.builder.showExportDialog();
    setTimeout(() => { State.bld.draft = saved; }, 100);
  }
};

// ============================================================
// VIEW: BUILDER – COMBINE
// ============================================================
Views.builder.combine = {
  open() {
    State.bld.cm = {
      selectedIds:    new Set(),
      loadedDecks:    [],
      levelColors:    new Map(),
      conflicts:      [],
      duplicates:     [],
      resolvedColors: new Map()
    };
    document.getElementById('builder-deck-list').classList.add('hidden');
    document.getElementById('builder-editor').classList.add('hidden');
    document.getElementById('builder-split').classList.add('hidden');
    document.getElementById('builder-combine').classList.remove('hidden');
    Views.builder.combine.renderStep1();
  },

  close() {
    document.getElementById('builder-combine').classList.add('hidden');
    State.bld.cm = null;
    Views.builder.renderDeckList();
  },

  // ── Helpers ─────────────────────────────────────────────

  _detectDups(decks) {
    const qMap = new Map(); // normalized question text → entries
    decks.forEach(d => {
      (d.rows || []).forEach(r => {
        const key = cellLabel(r.question).trim().toLowerCase();
        if (!key) return;
        if (!qMap.has(key)) qMap.set(key, []);
        qMap.get(key).push({ row: r, deckName: d.name });
      });
    });
    const dups = [];
    for (const [, entries] of qMap) {
      if (entries.length < 2) continue;
      const ansKey = e =>
        [cellLabel(e.row.correctAnswer), ...(e.row.wrongAnswers || []).map(w => cellLabel(w))]
          .map(s => s.trim().toLowerCase()).sort().join('|||');
      const allSameAnswers = entries.every(e => ansKey(e) === ansKey(entries[0]));
      const levels         = entries.map(e => e.row.level || '');
      const allSameLevels  = levels.every(l => l === levels[0]);
      const idxAll = new Set(entries.map((_, i) => i));
      let type, treatAsDuplicate, keepIndices;
      if (!allSameLevels) {
        // Different levels → treated as separate questions by default
        type = 'diff-levels'; treatAsDuplicate = false; keepIndices = new Set(idxAll);
      } else if (allSameAnswers) {
        // Identical in every way
        type = 'exact'; treatAsDuplicate = true; keepIndices = new Set([0]);
      } else {
        // Same question text, same level, different answers
        type = 'diff-answers'; treatAsDuplicate = true; keepIndices = new Set(idxAll);
      }
      dups.push({ questionLabel: cellLabel(entries[0].row.question),
        entries, type, treatAsDuplicate, keepIndices, allSameAnswers, allSameLevels });
    }
    return dups;
  },

  _lvBadge(levelName) {
    if (!levelName) return '';
    const lv = (State.bld.cm.loadedDecks || []).flatMap(d => d.levels || []).find(l => l.name === levelName);
    const bg = lv ? esc(lv.color) : 'var(--clr-border)';
    const fg = lv ? contrastColor(lv.color) : 'var(--clr-text-muted)';
    return `<span class="level-badge" style="background:${bg};color:${fg}">${esc(levelName)}</span>`;
  },

  // ── Step navigation helpers ─────────────────────────────

  _goForwardFrom(step) {
    const { conflicts, duplicates } = State.bld.cm;
    if (step < 2 && conflicts.length)  return Views.builder.combine.renderStep2();
    if (step < 3 && duplicates.length) return Views.builder.combine.renderStep3();
    Views.builder.combine.renderStep4();
  },

  _goBackFrom(step) {
    const { conflicts, duplicates } = State.bld.cm;
    if (step > 3 && duplicates.length)  return Views.builder.combine.renderStep3();
    if (step > 2 && conflicts.length)   return Views.builder.combine.renderStep2();
    Views.builder.combine.renderStep1();
  },

  // ── Step 1: Select Decks ────────────────────────────────

  renderStep1() {
    const panel = document.getElementById('builder-combine');
    const metas = Storage.getDatasetMetas();
    const sel   = State.bld.cm.selectedIds;

    panel.innerHTML = `
      <div class="sc-header card">
        <div class="sc-title-row">
          <button id="btn-cm-back-1" class="btn btn-ghost">\u2190 Back</button>
          <h3 class="sc-title">\u2295 Combine Decks <span class="sc-step">Select Decks</span></h3>
        </div>
        <p class="sc-sub">Select two or more decks to merge into a new deck.</p>
      </div>
      <div class="sc-list sc-deck-list" id="cm-deck-list">
        ${!metas.length
          ? `<div class="empty-state"><p>No decks available.</p></div>`
          : metas.map(m => `
            <label class="sc-deck-item${sel.has(m.id) ? ' sc-q-sel' : ''}" data-id="${esc(m.id)}">
              <input type="checkbox" class="cm-deck-cb" data-id="${esc(m.id)}" ${sel.has(m.id) ? 'checked' : ''}>
              <span class="sc-deck-name">${esc(m.name)}</span>
              <span class="sc-deck-meta">${m.rowCount} question${m.rowCount !== 1 ? 's' : ''} \u00b7 ${fmtDate(m.createdAt)}</span>
            </label>`).join('')
        }
      </div>
      <div class="sc-footer card">
        <button id="btn-cm-next-1" class="btn btn-primary" ${sel.size < 2 ? 'disabled' : ''}>Next \u2192</button>
      </div>`;

    document.getElementById('btn-cm-back-1').addEventListener('click', () => Views.builder.combine.close());
    panel.querySelectorAll('.cm-deck-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const newSel = new Set();
        panel.querySelectorAll('.cm-deck-cb:checked').forEach(c => newSel.add(c.dataset.id));
        State.bld.cm.selectedIds = newSel;
        document.getElementById('btn-cm-next-1').disabled = newSel.size < 2;
        panel.querySelectorAll('.sc-deck-item').forEach(item => {
          item.classList.toggle('sc-q-sel', newSel.has(item.dataset.id));
        });
      });
    });

    document.getElementById('btn-cm-next-1').addEventListener('click', async () => {
      const btn = document.getElementById('btn-cm-next-1');
      btn.disabled = true; btn.textContent = 'Loading\u2026';
      const ids   = [...State.bld.cm.selectedIds];
      const decks = (await Promise.all(ids.map(id => Storage.getDataset(id)))).filter(Boolean);
      State.bld.cm.loadedDecks = decks;

      // Detect level conflicts
      const levelColors = new Map();
      decks.forEach(d => {
        (d.levels || []).forEach(l => {
          if (!levelColors.has(l.name)) levelColors.set(l.name, []);
          const existing = levelColors.get(l.name);
          if (!existing.some(e => e.color === l.color)) existing.push({ color: l.color, deckName: d.name });
        });
      });
      State.bld.cm.levelColors = levelColors;
      const conflicts = [];
      for (const [name, entries] of levelColors) {
        if (entries.length > 1) conflicts.push({ name, entries });
      }
      State.bld.cm.conflicts = conflicts;
      State.bld.cm.resolvedColors = new Map();
      for (const [name, entries] of levelColors) {
        State.bld.cm.resolvedColors.set(name, entries[0].color);
      }

      // Detect duplicate questions
      State.bld.cm.duplicates = Views.builder.combine._detectDups(decks);

      Views.builder.combine._goForwardFrom(1);
    });
  },

  // ── Step 2: Level Conflicts ─────────────────────────────

  renderStep2() {
    const panel     = document.getElementById('builder-combine');
    const conflicts = State.bld.cm.conflicts;

    panel.innerHTML = `
      <div class="sc-header card">
        <div class="sc-title-row">
          <button id="btn-cm-back-2" class="btn btn-ghost">\u2190 Back</button>
          <h3 class="sc-title">\u2295 Combine Decks <span class="sc-step">Level Conflicts</span></h3>
        </div>
        <p class="sc-sub">These level names appear in multiple decks with different colors. Choose which color to keep in the combined deck.</p>
      </div>
      <div class="sc-list sc-conflicts-list">
        ${conflicts.map((c, ci) => `
          <div class="sc-conflict card">
            <div class="sc-conflict-name">Level: <strong>${esc(c.name)}</strong></div>
            ${c.entries.map((e, ei) => `
              <label class="sc-conflict-opt">
                <input type="radio" name="cm-conflict-${ci}" value="${esc(e.color)}" ${ei === 0 ? 'checked' : ''}>
                <span class="level-badge" style="background:${esc(e.color)};color:${contrastColor(e.color)}">${esc(c.name)}</span>
                <span class="sc-conflict-src">from <em>${esc(e.deckName)}</em></span>
              </label>`).join('')}
          </div>`).join('')}
      </div>
      <div class="sc-footer card">
        <button id="btn-cm-next-2" class="btn btn-primary">Next \u2192</button>
      </div>`;

    document.getElementById('btn-cm-back-2').addEventListener('click', () => Views.builder.combine.renderStep1());
    document.getElementById('btn-cm-next-2').addEventListener('click', () => {
      conflicts.forEach((c, ci) => {
        const checked = panel.querySelector(`input[name="cm-conflict-${ci}"]:checked`);
        if (checked) State.bld.cm.resolvedColors.set(c.name, checked.value);
      });
      Views.builder.combine._goForwardFrom(2);
    });
  },

  // ── Step 3: Duplicate Questions ─────────────────────────

  renderStep3() {
    const panel      = document.getElementById('builder-combine');
    const duplicates = State.bld.cm.duplicates;

    const dupHtml = duplicates.map((dup, di) => {
      const typeInfo = {
        'exact':       { label: '\ud83d\udd01 Exact Duplicate',                  hint: 'cls-dup-exact' },
        'diff-levels': { label: '\u26a0\ufe0f Same Question \u2013 Different Levels',   hint: 'sc-dup-warn' },
        'diff-answers':{ label: '\u26a0\ufe0f Same Question \u2013 Different Answers',  hint: 'sc-dup-warn' }
      }[dup.type];

      const entriesHtml = dup.entries.map(e => {
        const correctTxt = cellLabel(e.row.correctAnswer);
        const wrongTxts  = (e.row.wrongAnswers || []).map(w => cellLabel(w)).filter(Boolean);
        return `<div class="sc-dup-entry">
          <span class="sc-dup-deck">${esc(e.deckName)}</span>
          ${Views.builder.combine._lvBadge(e.row.level)}
          <span class="sc-dup-ans">Correct: ${esc(correctTxt)}${wrongTxts.length ? ` &nbsp;·&nbsp; Wrong: ${esc(wrongTxts.join(', '))}` : ''}</span>
        </div>`;
      }).join('');

      let resHtml = '';
      if (dup.type === 'exact') {
        const isKeepOne = dup.keepIndices.size === 1;
        const isKeepAll = dup.keepIndices.size === dup.entries.length;
        resHtml = `
          <div class="sc-dup-res">
            <label class="sc-dup-opt"><input type="radio" name="dup-${di}" value="keep-one" ${isKeepOne ? 'checked' : ''}> Keep one copy <span class="sc-dup-note">(auto-deduplicated)</span></label>
            <label class="sc-dup-opt"><input type="radio" name="dup-${di}" value="keep-all" ${isKeepAll ? 'checked' : ''}> Keep all copies</label>
            <label class="sc-dup-opt"><input type="radio" name="dup-${di}" value="exclude"  ${!isKeepOne && !isKeepAll ? 'checked' : ''}> Exclude from combined deck</label>
          </div>`;
      } else if (dup.type === 'diff-levels') {
        const isTreated = dup.treatAsDuplicate;
        const keepIdx   = isTreated ? ([...dup.keepIndices][0] ?? 0) : -1;
        resHtml = `
          <div class="sc-dup-res">
            <p class="sc-dup-note">Treated as separate questions (different levels) — both will be included.</p>
            <label class="sc-dup-opt"><input type="checkbox" class="cm-treat-as-dup" data-di="${di}" ${isTreated ? 'checked' : ''}> Treat as duplicate</label>
            ${isTreated ? `
              <div class="sc-dup-keep-which">
                ${dup.entries.map((e, ei) => `
                  <label class="sc-dup-opt"><input type="radio" name="dup-keep-${di}" value="${ei}" ${keepIdx === ei ? 'checked' : ''}> Keep ${esc(e.deckName)}\u2019s version ${Views.builder.combine._lvBadge(e.row.level)}</label>`).join('')}
                <label class="sc-dup-opt"><input type="radio" name="dup-keep-${di}" value="x" ${keepIdx === -2 ? 'checked' : ''}> Exclude from combined deck</label>
              </div>` : ''}
          </div>`;
      } else { // diff-answers
        resHtml = `
          <div class="sc-dup-res">
            <p class="sc-dup-note">Which version(s) to include?</p>
            ${dup.entries.map((e, ei) => `
              <label class="sc-dup-opt"><input type="checkbox" class="cm-dup-keep" data-di="${di}" data-ei="${ei}" ${dup.keepIndices.has(ei) ? 'checked' : ''}> Include ${esc(e.deckName)}\u2019s version ${Views.builder.combine._lvBadge(e.row.level)}</label>`).join('')}
          </div>`;
      }

      return `<div class="sc-dup-item card">
        <div class="sc-dup-type ${typeInfo.hint}">${typeInfo.label}</div>
        <div class="sc-dup-question">${esc(dup.questionLabel)}</div>
        ${dup.allSameAnswers && dup.allSameLevels ? '<p class="sc-dup-note">All instances have identical answers.</p>' : ''}
        ${entriesHtml}
        ${resHtml}
      </div>`;
    }).join('');

    panel.innerHTML = `
      <div class="sc-header card">
        <div class="sc-title-row">
          <button id="btn-cm-back-3" class="btn btn-ghost">\u2190 Back</button>
          <h3 class="sc-title">\u2295 Combine Decks <span class="sc-step">Duplicate Questions</span></h3>
        </div>
        <p class="sc-sub">${duplicates.length} duplicate question group${duplicates.length !== 1 ? 's' : ''} found. Review each and choose how to resolve it.</p>
      </div>
      <div class="sc-list sc-dup-list">${dupHtml}</div>
      <div class="sc-footer card">
        <button id="btn-cm-next-3" class="btn btn-primary">Next \u2192</button>
      </div>`;

    document.getElementById('btn-cm-back-3').addEventListener('click', () =>
      Views.builder.combine._goBackFrom(3)
    );

    // Exact duplicate radios
    panel.querySelectorAll('[name^="dup-"]:not([name^="dup-keep-"])').forEach(r => {
      r.addEventListener('change', e => {
        const di  = parseInt(e.target.name.replace('dup-', ''), 10);
        const dup = State.bld.cm.duplicates[di];
        if (e.target.value === 'keep-one') dup.keepIndices = new Set([0]);
        else if (e.target.value === 'keep-all') dup.keepIndices = new Set(dup.entries.map((_, i) => i));
        else dup.keepIndices = new Set();
      });
    });

    // "Treat as duplicate" checkboxes (diff-levels)
    panel.querySelectorAll('.cm-treat-as-dup').forEach(cb => {
      cb.addEventListener('change', e => {
        const di  = parseInt(e.target.dataset.di, 10);
        const dup = State.bld.cm.duplicates[di];
        dup.treatAsDuplicate = e.target.checked;
        dup.keepIndices = e.target.checked
          ? new Set([0])
          : new Set(dup.entries.map((_, i) => i));
        Views.builder.combine.renderStep3();
      });
    });

    // Keep-which radios (diff-levels treated-as-dup)
    panel.querySelectorAll('[name^="dup-keep-"]').forEach(r => {
      r.addEventListener('change', e => {
        const di  = parseInt(e.target.name.replace('dup-keep-', ''), 10);
        const dup = State.bld.cm.duplicates[di];
        dup.keepIndices = e.target.value === 'x' ? new Set() : new Set([parseInt(e.target.value, 10)]);
      });
    });

    // Per-entry checkboxes (diff-answers)
    panel.querySelectorAll('.cm-dup-keep').forEach(cb => {
      cb.addEventListener('change', e => {
        const di  = parseInt(e.target.dataset.di, 10);
        const ei  = parseInt(e.target.dataset.ei, 10);
        const dup = State.bld.cm.duplicates[di];
        if (e.target.checked) dup.keepIndices.add(ei);
        else dup.keepIndices.delete(ei);
      });
    });

    document.getElementById('btn-cm-next-3').addEventListener('click', () =>
      Views.builder.combine.renderStep4()
    );
  },

  // ── Step 4: Save ────────────────────────────────────────

  renderStep4() {
    const panel  = document.getElementById('builder-combine');
    const { loadedDecks, levelColors, resolvedColors, duplicates } = State.bld.cm;

    // Calculate final question count after dup resolution
    const excludedIds = new Set();
    duplicates.forEach(dup => {
      dup.entries.forEach((entry, i) => {
        if (!dup.keepIndices.has(i)) excludedIds.add(entry.row.id);
      });
    });
    const totalQ = loadedDecks.reduce((s, d) =>
      s + d.rows.filter(r => !excludedIds.has(r.id)).length, 0);

    const levelHtml = [...levelColors].map(([name]) => {
      const color = resolvedColors.get(name) || '#999';
      return `<span class="level-badge" style="background:${esc(color)};color:${contrastColor(color)}">${esc(name)}</span>`;
    }).join(' ');
    const suggested = loadedDecks.map(d => d.name).join(' + ');

    const dupSummary = duplicates.length
      ? `<p class="sc-dup-note" style="margin:.1rem 0">${duplicates.length} duplicate group${duplicates.length !== 1 ? 's' : ''} resolved</p>`
      : '';

    panel.innerHTML = `
      <div class="sc-header card">
        <div class="sc-title-row">
          <button id="btn-cm-back-4" class="btn btn-ghost">\u2190 Back</button>
          <h3 class="sc-title">\u2295 Combine Decks <span class="sc-step">Save</span></h3>
        </div>
      </div>
      <div class="sc-footer card" style="gap:1rem">
        <div class="sc-combine-summary">
          <p>Merging <strong>${loadedDecks.length}</strong> deck${loadedDecks.length !== 1 ? 's' : ''}:</p>
          <ul class="sc-combine-deck-names">${loadedDecks.map(d => `<li>${esc(d.name)}</li>`).join('')}</ul>
          <p class="sc-combine-total"><strong>${totalQ}</strong> question${totalQ !== 1 ? 's' : ''} after resolution</p>
          ${dupSummary}
          ${levelHtml ? `<div class="sc-combine-levels">${levelHtml}</div>` : ''}
        </div>
        <div class="sc-name-row">
          <label class="sc-label">New deck name</label>
          <input type="text" id="cm-name-input" class="deck-name-input sc-name-input"
            placeholder="Combined Deck" maxlength="80" value="${esc(suggested)}">
        </div>
        <div class="sc-save-row">
          <button id="btn-cm-save"   class="btn btn-success">\ud83d\udcbe Save as New Deck</button>
          <button id="btn-cm-export" class="btn btn-secondary">\u2b07 Export</button>
        </div>
      </div>`;

    document.getElementById('btn-cm-back-4').addEventListener('click', () =>
      Views.builder.combine._goBackFrom(4)
    );
    document.getElementById('btn-cm-save').addEventListener('click',   () => Views.builder.combine.saveAsDeck());
    document.getElementById('btn-cm-export').addEventListener('click', () => Views.builder.combine.exportCombined());
  },

  // ── Build & save ────────────────────────────────────────

  _buildDs() {
    const { loadedDecks, levelColors, resolvedColors, duplicates } = State.bld.cm;
    const name = document.getElementById('cm-name-input')?.value.trim() || 'Combined Deck';

    // Determine which rows to exclude based on duplicate resolutions
    const excludedIds = new Set();
    (duplicates || []).forEach(dup => {
      dup.entries.forEach((entry, i) => {
        if (!dup.keepIndices.has(i)) excludedIds.add(entry.row.id);
      });
    });

    const levels = [...levelColors].map(([lname]) => ({
      name:  lname,
      color: resolvedColors.get(lname) || LEVEL_COLORS[0]
    }));
    const rows = loadedDecks.flatMap(d =>
      d.rows.filter(r => !excludedIds.has(r.id)).map(r => ({ ...r, id: genId() }))
    );
    return { id: genId(), name, createdAt: new Date().toISOString(), levels, rows };
  },

  saveAsDeck() {
    const newDs = Views.builder.combine._buildDs();
    Modal.confirm(
      'Save Combined Deck',
      `Save ${newDs.rows.length} question${newDs.rows.length !== 1 ? 's' : ''} as \u201c${newDs.name}\u201d?`,
      async () => {
        await Storage.saveDataset(newDs);
        Toast.show(`Saved \u201c${newDs.name}\u201d (${newDs.rows.length} questions)`, 'success');
        Views.builder.combine.close();
      },
      'Save', 'btn-success'
    );
  },

  exportCombined() {
    const saved = State.bld.draft;
    State.bld.draft = Views.builder.combine._buildDs();
    Views.builder.showExportDialog();
    setTimeout(() => { State.bld.draft = saved; }, 100);
  }
};

// ============================================================
// VIEW: FLASHCARDS
// ============================================================
Views.flashcards = {
  onEnter() {
    document.getElementById('fc-selector').classList.remove('hidden');
    document.getElementById('fc-player').classList.add('hidden');
    document.getElementById('fc-level-filter').classList.add('hidden');
    document.getElementById('fc-deck-list').classList.remove('hidden');
    Views.flashcards.renderResumeCard();
    renderDatasetPicker(document.getElementById('fc-deck-list'), meta => {
      Views.flashcards.showLevelFilter(meta.id);
    });
  },

  async showLevelFilter(datasetId) {
    const ds = await Storage.getDataset(datasetId);
    if (!ds) { Toast.show('Could not load dataset', 'error'); return; }
    if (!(ds.levels || []).length) {
      Views.flashcards.startWithDs(ds, null);
      return;
    }
    LevelFilter.show('fc', ds, null);
  },

  async startWithDs(ds, levelFilter) {
    const filteredRows = LevelFilter.applyFilter(ds.rows, levelFilter);
    State.fc.datasetId = ds.id;
    State.fc.levels    = ds.levels || [];
    State.fc.questions = shuffle(await resolveLocalImages(filteredRows));
    State.fc.idx       = 0;
    State.fc.flipped   = false;
    State.fc.viewedIds = new Set();

    // build per-level totals from the filtered deck
    const levelTotals = {};
    filteredRows.forEach(r => { if (r.level) levelTotals[r.level] = (levelTotals[r.level] || 0) + 1; });

    // create session before showCard so the first card is counted
    const session = {
      id: genId(), userId: State.currentUser ? State.currentUser.id : null,
      userName: State.currentUser ? State.currentUser.name : 'Anonymous',
      datasetId: ds.id, datasetName: ds.name, mode: 'flashcard',
      startedAt: new Date().toISOString(), endedAt: null,
      cardsViewed: 0, totalCards: filteredRows.length,
      levelFilterLabel: LevelFilter.filterLabel(ds, levelFilter),
      levels: ds.levels || [], levelTotals, levelViewed: {}
    };
    State.fc.sessionRef = session;

    document.getElementById('fc-selector').classList.add('hidden');
    document.getElementById('fc-player').classList.remove('hidden');
    document.getElementById('btn-fc-save').classList.toggle('hidden', !State.currentUser);
    Views.flashcards.showCard(0);
  },

  showCard(idx) {
    const qs = State.fc.questions;
    if (!qs.length) return;

    State.fc.idx     = idx;
    State.fc.flipped = false;

    // track unique cards viewed per level
    const row = qs[idx];
    const sid = row.id;
    if (State.fc.sessionRef && State.fc.viewedIds && !State.fc.viewedIds.has(sid)) {
      State.fc.viewedIds.add(sid);
      if (row.level) {
        const lv = State.fc.sessionRef.levelViewed;
        lv[row.level] = (lv[row.level] || 0) + 1;
      }
    }

    const card = document.getElementById('fc-card');
    card.classList.remove('flipped');
    renderCell(row.question,      document.getElementById('fc-front-content'));
    renderCell(row.correctAnswer, document.getElementById('fc-back-content'));

    const fcRefEl   = document.getElementById('fc-back-reference');
    const fcRefCell = row.referenceCell ?? parseCell(row.reference || '');
    if (fcRefCell) {
      renderCell(fcRefCell, fcRefEl);
      fcRefEl.classList.remove('hidden');
    } else {
      fcRefEl.classList.add('hidden');
    }

    document.getElementById('fc-progress').textContent = `${idx + 1} / ${qs.length}`;
    renderLevelBadge(document.getElementById('fc-level-badge'), row, State.fc.levels);

    // dots
    const dots = document.getElementById('fc-dots');
    dots.innerHTML = '';
    for (let i = 0; i < qs.length; i++) {
      const d = document.createElement('div');
      d.className = 'fc-dot' + (i === idx ? ' current' : i < idx ? ' seen' : '');
      dots.appendChild(d);
    }

    document.getElementById('btn-fc-prev').disabled = idx === 0;
    document.getElementById('btn-fc-next').textContent = idx === qs.length - 1 ? 'Done ✓' : 'Next →';
  },

  flip() {
    State.fc.flipped = !State.fc.flipped;
    document.getElementById('fc-card').classList.toggle('flipped', State.fc.flipped);
  },

  next() {
    const qs = State.fc.questions;
    if (State.fc.idx < qs.length - 1) {
      Views.flashcards.showCard(State.fc.idx + 1);
    } else {
      // done
      Views.flashcards._clearProgress();
      Views.flashcards.finishSession();
      Modal.show({
        title: 'Deck Complete! 🎉',
        body: `You reviewed all ${qs.length} cards.`,
        buttons: [
          { label: 'Restart',   action: () => Views.flashcards.restart() },
          { label: 'Back', cls: 'btn-secondary', action: () => Views.flashcards.exit() }
        ]
      });
    }
  },

  prev() {
    if (State.fc.idx > 0) Views.flashcards.showCard(State.fc.idx - 1);
  },

  restart() {
    State.fc.questions = shuffle(State.fc.questions);
    Views.flashcards.showCard(0);
  },

  exit() {
    Views.flashcards.finishSession();
    document.getElementById('fc-player').classList.add('hidden');
    document.getElementById('fc-level-filter').classList.add('hidden');
    document.getElementById('fc-deck-list').classList.remove('hidden');
    document.getElementById('fc-selector').classList.remove('hidden');
    document.getElementById('btn-fc-save').classList.add('hidden');
    Views.flashcards.renderResumeCard();
    renderDatasetPicker(document.getElementById('fc-deck-list'), meta => {
      Views.flashcards.showLevelFilter(meta.id);
    });
  },

  finishSession() {
    if (State.fc.sessionRef && !State.fc.sessionRef.endedAt) {
      const s = State.fc.sessionRef;
      s.endedAt    = new Date().toISOString();
      s.cardsViewed = State.fc.idx + 1;
      Storage.addSession(s);
      State.fc.sessionRef = null;
    }
  },

  // ── Progress save / resume ──────────────────────────────────

  _progressKey() {
    return State.currentUser ? 'fc_progress_' + State.currentUser.id : null;
  },

  _clearProgress() {
    const key = Views.flashcards._progressKey();
    if (key) Storage.lsDel(key);
  },

  saveProgress() {
    const key = Views.flashcards._progressKey();
    if (!key) return;
    const fc   = State.fc;
    const sess = fc.sessionRef || {};
    const snapshot = {
      userId:           State.currentUser.id,
      savedAt:          new Date().toISOString(),
      datasetId:        fc.datasetId,
      datasetName:      sess.datasetName || '',
      levels:           fc.levels || [],
      levelFilterLabel: sess.levelFilterLabel || null,
      questionIds:      fc.questions.map(q => q.id),
      idx:              fc.idx,
      viewedIds:        [...fc.viewedIds],
      levelViewed:      sess.levelViewed || {},
      levelTotals:      sess.levelTotals || {},
      startedAt:        sess.startedAt   || new Date().toISOString(),
      sessionId:        sess.id          || genId()
    };
    Storage.lsSet(key, snapshot);
    Toast.show('Progress saved', 'success');
  },

  renderResumeCard() {
    const card = document.getElementById('fc-resume-card');
    const key  = Views.flashcards._progressKey();
    if (!key) { card.classList.add('hidden'); return; }
    const snap = Storage.lsGet(key, null);
    if (!snap) { card.classList.add('hidden'); return; }

    document.getElementById('fc-resume-deck-name').textContent = snap.datasetName || 'Unknown';
    const viewed = (snap.viewedIds || []).length;
    const total  = (snap.questionIds || []).length;
    const pct    = total ? Math.round(viewed / total * 100) : 0;
    const detail = [
      `${viewed}\u202f/\u202f${total} cards viewed (${pct}%)`,
      snap.levelFilterLabel ? `\ud83c\udff7 ${snap.levelFilterLabel}` : null,
      `Saved ${fmtDateTime(snap.savedAt)}`
    ].filter(Boolean).join(' \u00b7 ');
    document.getElementById('fc-resume-detail').textContent = detail;
    card.classList.remove('hidden');
  },

  async resumeProgress() {
    const key  = Views.flashcards._progressKey();
    if (!key) return;
    const snap = Storage.lsGet(key, null);
    if (!snap) { Toast.show('No saved progress found', 'warning'); return; }

    const ds = await Storage.getDataset(snap.datasetId);
    if (!ds) {
      Toast.show('Original dataset no longer available', 'error');
      Storage.lsDel(key);
      Views.flashcards.renderResumeCard();
      return;
    }

    const resolvedRows = await resolveLocalImages(ds.rows);
    const rowMap    = new Map(resolvedRows.map(r => [r.id, r]));
    const questions = (snap.questionIds || []).map(id => rowMap.get(id)).filter(Boolean);

    if (!questions.length) {
      Toast.show('Saved progress is incompatible with the current dataset', 'error');
      Storage.lsDel(key);
      Views.flashcards.renderResumeCard();
      return;
    }

    const session = {
      id:               snap.sessionId || genId(),
      userId:           State.currentUser ? State.currentUser.id   : null,
      userName:         State.currentUser ? State.currentUser.name : 'Anonymous',
      datasetId:        ds.id,  datasetName: ds.name,  mode: 'flashcard',
      startedAt:        snap.startedAt || new Date().toISOString(),  endedAt: null,
      cardsViewed:      (snap.viewedIds || []).length,
      totalCards:       questions.length,
      levelFilterLabel: snap.levelFilterLabel || null,
      levels:           ds.levels  || [],
      levelTotals:      snap.levelTotals || {},
      levelViewed:      snap.levelViewed  || {}
    };

    State.fc.datasetId  = ds.id;
    State.fc.levels     = snap.levels || ds.levels || [];
    State.fc.questions  = questions;
    State.fc.idx        = Math.min(snap.idx, questions.length - 1);
    State.fc.flipped    = false;
    State.fc.viewedIds  = new Set(snap.viewedIds || []);
    State.fc.sessionRef = session;

    document.getElementById('fc-selector').classList.add('hidden');
    document.getElementById('fc-player').classList.remove('hidden');
    document.getElementById('btn-fc-save').classList.remove('hidden');
    Views.flashcards.showCard(State.fc.idx);
    Toast.show('Flashcard session resumed', 'success');
  },

  onBeforeLeave(proceed) {
    if (document.getElementById('fc-player').classList.contains('hidden')) return true;
    const user = State.currentUser;
    if (user) {
      Modal.show({
        title: 'Exit Flashcards',
        body:  'Save your progress so you can resume this session later?',
        buttons: [
          { label: 'Cancel' },
          { label: 'Exit without saving', cls: 'btn-ghost', action: () => {
            Views.flashcards._clearProgress();
            Views.flashcards.exit();
            proceed();
          }},
          { label: '\ud83d\udcbe Save & Exit', cls: 'btn-primary', action: () => {
            Views.flashcards.saveProgress();
            Views.flashcards.exit();
            proceed();
          }}
        ]
      });
    } else {
      Modal.show({
        title: 'Exit Flashcards',
        body:  'Return to deck selection?',
        buttons: [
          { label: 'Cancel' },
          { label: 'Exit', cls: 'btn-ghost', action: () => { Views.flashcards.exit(); proceed(); }}
        ]
      });
    }
    return false;
  }
};

// ============================================================
// VIEW: QUIZ
// ============================================================
Views.quiz = {
  onEnter() {
    document.getElementById('quiz-selector').classList.remove('hidden');
    document.getElementById('quiz-player').classList.add('hidden');
    document.getElementById('quiz-summary').classList.add('hidden');
    document.getElementById('quiz-level-filter').classList.add('hidden');
    document.getElementById('quiz-deck-list').classList.remove('hidden');
    document.getElementById('btn-quiz-save').classList.add('hidden');
    renderDatasetPicker(document.getElementById('quiz-deck-list'), meta => {
      Views.quiz.showLevelFilter(meta.id, meta.name);
    });
    Views.quiz.renderResumeCard();
  },

  // Returns false (blocking navigation) if a quiz is in progress, showing the appropriate modal.
  // `proceed` is a callback that the modal's confirm action calls to continue navigation.
  onBeforeLeave(proceed) {
    if (document.getElementById('quiz-player').classList.contains('hidden')) return true;
    const user = State.currentUser;
    if (user) {
      Modal.show({
        title: 'Exit Quiz',
        body: 'Save your progress so you can resume this quiz later?',
        buttons: [
          { label: 'Cancel' },
          { label: 'Exit without saving', cls: 'btn-ghost', action: () => { Views.quiz.onEnter(); proceed(); } },
          { label: '💾 Save & Exit', cls: 'btn-primary', action: () => { Views.quiz.saveProgress(); Views.quiz.onEnter(); proceed(); } }
        ]
      });
    } else {
      Modal.show({
        title: 'Exit Quiz',
        body: "You're playing anonymously — progress cannot be saved. Exit anyway?",
        buttons: [
          { label: 'Cancel' },
          { label: 'Exit anyway', cls: 'btn-warning', action: () => { Views.quiz.onEnter(); proceed(); } }
        ]
      });
    }
    return false;
  },

  async showLevelFilter(datasetId) {
    const ds = await Storage.getDataset(datasetId);
    if (!ds) { Toast.show('Could not load dataset', 'error'); return; }
    if (!ds.rows.some(r => r.wrongAnswers.length > 0)) {
      Toast.show('This deck has no wrong answers – cannot run quiz mode', 'warning', 4000);
      return;
    }
    if (!(ds.levels || []).length) {
      Views.quiz.startWithDs(ds, null);
      return;
    }
    LevelFilter.show('quiz', ds, r => r.wrongAnswers.length > 0);
  },

  async startWithDs(ds, levelFilter) {
    const resolvedRows = await resolveLocalImages(ds.rows);
    const eligible   = resolvedRows.filter(r => r.wrongAnswers.length > 0);
    const questions  = LevelFilter.applyFilter(eligible, levelFilter);

    if (!questions.length) {
      Toast.show('No questions match the selected levels', 'warning', 4000);
      return;
    }

    State.qz = {
      datasetId: ds.id, datasetName: ds.name,
      levels: ds.levels || [],
      levelFilterLabel: LevelFilter.filterLabel(ds, levelFilter),
      questions,
      pool: [], idx: 0,
      results: [], allAttempts: [],
      score: { correct: 0, total: 0 },
      levelScores: {},
      round: 1, answered: false,
      showCorrect: document.getElementById('quiz-opt-show-correct')?.checked ?? true,
      autoRetry:   document.getElementById('quiz-opt-auto-retry')?.checked  ?? false,
      sessionId: genId(), startedAt: new Date().toISOString()
    };

    State.qz.pool = shuffle(State.qz.questions);

    document.getElementById('quiz-selector').classList.add('hidden');
    document.getElementById('quiz-summary').classList.add('hidden');
    document.getElementById('quiz-player').classList.remove('hidden');
    document.getElementById('btn-quiz-save').classList.toggle('hidden', !State.currentUser);

    Views.quiz.buildGrid();
    Views.quiz.showQuestion(0);
  },

  updateScoreDisplay() {
    const { correct, total } = State.qz.score;
    const pct = total ? Math.round(correct / total * 100) : 0;
    document.getElementById('qscore-correct').textContent = correct;
    document.getElementById('qscore-total').textContent   = total;
    document.getElementById('qscore-pct').textContent     = total ? ` (${pct}%)` : '';

    const bar    = document.getElementById('quiz-level-scores');
    const levels = State.qz.levels || [];
    const ls     = State.qz.levelScores || {};
    const active = levels
      .filter(l => ls[l.name] && ls[l.name].total > 0)
      .map(l => [l.name, ls[l.name]]);

    if (!active.length || !levels.length) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    bar.innerHTML = active.map(([name, s]) => {
      const lvl  = levels.find(l => l.name === name);
      const bg   = lvl ? esc(lvl.color) : 'var(--clr-border)';
      const fg   = lvl ? esc(contrastColor(lvl.color)) : 'var(--clr-text)';
      const lpct = s.total ? Math.round(s.correct / s.total * 100) : 0;
      return `<span class="level-score-chip level-badge" style="background:${bg};color:${fg}">${esc(name)}: ${s.correct}/${s.total} (${lpct}%)</span>`;
    }).join('');
  },

  buildGrid() {
    const grid = document.getElementById('quiz-grid');
    grid.innerHTML = '';
    State.qz.pool.forEach((_, i) => {
      const sq = document.createElement('div');
      sq.className     = 'grid-sq';
      sq.dataset.qidx  = i;
      sq.title         = `Question ${i + 1}`;
      grid.appendChild(sq);
    });
  },

  updateGridSquare(idx, cls) {
    const sq = document.querySelector(`.grid-sq[data-qidx="${idx}"]`);
    if (sq) sq.className = 'grid-sq ' + cls;
  },

  showQuestion(idx) {
    const pool = State.qz.pool;
    if (idx >= pool.length) { Views.quiz.endRound(); return; }

    State.qz.idx      = idx;
    State.qz.answered = false;

    const row = pool[idx];

    document.getElementById('quiz-round-badge').textContent = `Round ${State.qz.round}`;
    Views.quiz.updateScoreDisplay();
    document.getElementById('quiz-q-meta').textContent = `Question ${idx + 1} of ${pool.length}`;
    renderLevelBadge(document.getElementById('quiz-level-badge'), row, State.qz.levels);

    // render question
    const qContent = document.getElementById('quiz-q-content');
    qContent.innerHTML = '';
    renderCell(row.question, qContent);

    // hide feedback
    document.getElementById('quiz-feedback').classList.add('hidden');
    document.getElementById('feedback-correct-reveal').classList.add('hidden');

    // build answer choices (correct + all wrong answers, shuffled)
    const wrongs   = shuffle(row.wrongAnswers);
    let choices  = shuffle([
      { cell: row.correctAnswer, isCorrect: true },
      ...wrongs.map(w => ({ cell: w, isCorrect: false }))
    ]);

    // True/False detection: if exactly 2 choices and they look like T/F, put True first
    const tfTrue  = /^(true|t|yes|correct)$/i;
    const tfFalse = /^(false|f|no|incorrect)$/i;
    if (choices.length === 2) {
      const labels = choices.map(c => (c.cell.text || '').trim());
      if (labels.some(l => tfTrue.test(l)) && labels.some(l => tfFalse.test(l))) {
        choices.sort((a, b) => {
          const at = (a.cell.text || '').trim(), bt = (b.cell.text || '').trim();
          if (tfTrue.test(at)) return -1;
          if (tfTrue.test(bt)) return  1;
          return 0;
        });
      }
    }

    const choicesEl = document.getElementById('quiz-choices');
    choicesEl.innerHTML = '';
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    choices.forEach((ch, ci) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.dataset.correct = ch.isCorrect ? '1' : '0';

      const letterSpan  = document.createElement('span');
      letterSpan.className = 'choice-letter';
      letterSpan.textContent = letters[ci] + '.';
      btn.appendChild(letterSpan);

      const contentDiv = document.createElement('div');
      contentDiv.className = 'choice-content';
      renderCell(ch.cell, contentDiv);
      btn.appendChild(contentDiv);

      btn.addEventListener('click', () => Views.quiz.answer(btn, ch, row));
      choicesEl.appendChild(btn);
    });

    // mark current grid square
    Views.quiz.updateGridSquare(idx, 'sq-current');
  },

  answer(btn, choice, row) {
    if (State.qz.answered) return;
    State.qz.answered = true;

    const isCorrect = choice.isCorrect;
    State.qz.score.total++;
    if (isCorrect) State.qz.score.correct++;

    // per-level tracking
    const idx     = State.qz.idx;
    const lvlName = State.qz.pool[idx]?.level || '';
    if (lvlName) {
      if (!State.qz.levelScores[lvlName]) State.qz.levelScores[lvlName] = { correct: 0, total: 0 };
      State.qz.levelScores[lvlName].total++;
      if (isCorrect) State.qz.levelScores[lvlName].correct++;
    }

    // style buttons
    document.querySelectorAll('.choice-btn').forEach(b => {
      b.disabled = true;
      if (b === btn) {
        b.classList.add(isCorrect ? 'correct' : 'wrong');
      } else if (!isCorrect && State.qz.showCorrect && b.dataset.correct === '1') {
        b.classList.add('correct');
      }
    });

    // show feedback
    const feedbackEl  = document.getElementById('quiz-feedback');
    const msgEl       = document.getElementById('feedback-msg');
    const revealEl    = document.getElementById('feedback-correct-reveal');
    feedbackEl.classList.remove('hidden');
    msgEl.className   = 'feedback-msg ' + (isCorrect ? 'correct' : 'wrong');
    msgEl.textContent = isCorrect ? '✅ Correct!' : '❌ Incorrect';

    if (!isCorrect && State.qz.showCorrect) {
      revealEl.classList.remove('hidden');
      revealEl.innerHTML = '';
      const label = document.createElement('span');
      label.innerHTML = '<strong>Correct answer: </strong>';
      revealEl.appendChild(label);
      renderCell(row.correctAnswer, revealEl);
    }

    // reference (optional) — always shown on correct answers; on wrong answers only when showCorrect is enabled
    const refEl   = document.getElementById('feedback-reference');
    const refCell = row.referenceCell ?? parseCell(row.reference || '');
    if (refCell && (isCorrect || State.qz.showCorrect)) {
      renderCell(refCell, refEl);
      refEl.classList.remove('hidden');
    } else {
      refEl.classList.add('hidden');
    }

    // update score display
    Views.quiz.updateScoreDisplay();

    // update grid
    Views.quiz.updateGridSquare(idx, isCorrect ? 'sq-correct' : 'sq-wrong');

    // record result
    const attempt = {
      qId: row.id,
      round: State.qz.round,
      correct: isCorrect,
      level: row.level || '',
      selectedText:  cellLabel(choice.cell),
      selectedSrc:   cellImgSrc(choice.cell),
      questionLabel: cellLabel(row.question),
      questionSrc:   cellImgSrc(row.question),
      correctLabel:  cellLabel(row.correctAnswer),
      correctSrc:    cellImgSrc(row.correctAnswer)
    };
    State.qz.results.push({ qId: row.id, correct: isCorrect });
    State.qz.allAttempts.push(attempt);
  },

  endRound() {
    const results  = State.qz.results;
    const wrongIds = results.filter(r => !r.correct).map(r => r.qId);

    document.getElementById('quiz-player').classList.add('hidden');
    document.getElementById('quiz-summary').classList.remove('hidden');

    const totalQ   = State.qz.pool.length;
    const correct  = results.filter(r => r.correct).length;
    const pct      = totalQ ? Math.round(correct / totalQ * 100) : 0;

    const scoreEl = document.getElementById('summary-score');
    scoreEl.textContent = `${correct} / ${totalQ}  (${pct}%)`;
    scoreEl.className   = 'summary-score' + (pct === 100 ? ' score-perfect' : '');

    // breakdown table
    const bdEl = document.getElementById('summary-breakdown');
    bdEl.innerHTML = '';

    // per-round summary
    const levels = State.qz.levels || [];
    const roundNums = [...new Set(State.qz.allAttempts.map(a => a.round))].sort((a, b) => a - b);
    roundNums.forEach(rn => {
      const rAttempts = State.qz.allAttempts.filter(a => a.round === rn);
      const rC = rAttempts.filter(a => a.correct).length;
      const rT = rAttempts.length;
      const item = document.createElement('div');
      item.className = 'summary-breakdown-item';
      item.innerHTML = `<span>Round ${rn}</span><span>${rC} / ${rT} correct</span>`;
      bdEl.appendChild(item);

      // per-level breakdown for this round
      const levelNames = [...new Set(rAttempts.map(a => a.level).filter(Boolean))];
      levelNames.sort((a, b) => {
        const ai = levels.findIndex(l => l.name === a);
        const bi = levels.findIndex(l => l.name === b);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      if (levelNames.length > 0) {
        const levelDiv = document.createElement('div');
        levelDiv.className = 'summary-level-breakdown';
        levelNames.forEach(name => {
          const lAttempts = rAttempts.filter(a => a.level === name);
          const lC = lAttempts.filter(a => a.correct).length;
          const lT = lAttempts.length;
          const lPct = lT ? Math.round(lC / lT * 100) : 0;
          const lvl = levels.find(l => l.name === name);
          const bg = lvl ? lvl.color : 'var(--clr-border)';
          const fg = lvl ? contrastColor(lvl.color) : 'var(--clr-text)';
          const span = document.createElement('span');
          span.className = 'level-score-chip level-badge';
          span.style.background = bg;
          span.style.color = fg;
          span.textContent = `${name}: ${lC}/${lT} (${lPct}%)`;
          levelDiv.appendChild(span);
        });
        bdEl.appendChild(levelDiv);
      }
    });

    // retry button — only show if auto-retry is enabled and there are wrong answers
    const retryBtn = document.getElementById('btn-retry-wrong');
    if (wrongIds.length > 0 && State.qz.autoRetry) {
      retryBtn.classList.remove('hidden');
    } else {
      retryBtn.classList.add('hidden');
    }

    // Save/update session after every round (overwrites by sessionId)
    const firstAttempts = State.qz.allAttempts.filter(a => a.round === 1);
    const firstC = firstAttempts.filter(a => a.correct).length;
    const sess = {
      id: State.qz.sessionId,
      userId:      State.currentUser ? State.currentUser.id : null,
      userName:    State.currentUser ? State.currentUser.name : 'Anonymous',
      datasetId:   State.qz.datasetId,
      datasetName: State.qz.datasetName,
      mode: 'quiz',
      startedAt:  State.qz.startedAt,
      endedAt:    new Date().toISOString(),
      finalScore: { correct: firstC, total: State.qz.questions.length },
      totalRounds: State.qz.round,
      attempts:    State.qz.allAttempts,
      questionIds: State.qz.questions.map(q => q.id),
      levels:      State.qz.levels || [],
      levelScores: State.qz.levelScores || {},
      levelFilterLabel: State.qz.levelFilterLabel || null
    };
    // overwrite any prior save for the same session
    const existing = Storage.getSessions().filter(s => s.id !== sess.id);
    existing.push(sess);
    Storage.lsSet('sessions', existing);
    // Quiz is complete — clear any saved progress for this user
    const progKey = Views.quiz._progressKey();
    if (progKey) Storage.lsDel(progKey);
  },

  retryWrong() {
    const wrongIds = State.qz.results.filter(r => !r.correct).map(r => r.qId);
    if (!wrongIds.length) { Toast.show('No incorrect answers to retry!', 'success'); return; }

    State.qz.round++;
    State.qz.pool     = shuffle(State.qz.questions.filter(q => wrongIds.includes(q.id)));
    State.qz.results  = [];
    State.qz.score    = { correct: 0, total: 0 };
    State.qz.idx      = 0;
    State.qz.answered = false;

    document.getElementById('quiz-summary').classList.add('hidden');
    document.getElementById('quiz-player').classList.remove('hidden');

    Views.quiz.buildGrid();
    Views.quiz.showQuestion(0);
  },

  // ── Progress save / resume ──────────────────────────────────

  _progressKey() {
    return State.currentUser ? 'quiz_progress_' + State.currentUser.id : null;
  },

  saveProgress() {
    const key = Views.quiz._progressKey();
    if (!key) return;
    const qz = State.qz;
    // If the current question was already answered, advance past it so we don't re-ask it on resume.
    const resumeIdx = qz.answered ? qz.idx + 1 : qz.idx;
    const snapshot = {
      userId:           State.currentUser.id,
      savedAt:          new Date().toISOString(),
      datasetId:        qz.datasetId,
      datasetName:      qz.datasetName,
      levels:           qz.levels,
      levelFilterLabel: qz.levelFilterLabel || null,
      questionIds:      qz.questions.map(q => q.id),
      poolIds:          qz.pool.map(q => q.id),
      idx:              resumeIdx,
      roundComplete:    resumeIdx >= qz.pool.length,
      round:            qz.round,
      score:            qz.score,
      levelScores:      qz.levelScores || {},
      results:          qz.results,
      allAttempts:      qz.allAttempts,
      showCorrect:      qz.showCorrect,
      autoRetry:        qz.autoRetry,
      startedAt:        qz.startedAt,
      sessionId:        qz.sessionId
    };
    Storage.lsSet(key, snapshot);
    Toast.show('Progress saved', 'success');
  },

  renderResumeCard() {
    const card = document.getElementById('quiz-resume-card');
    const key  = Views.quiz._progressKey();
    if (!key) { card.classList.add('hidden'); return; }
    const snap = Storage.lsGet(key, null);
    if (!snap) { card.classList.add('hidden'); return; }

    document.getElementById('resume-deck-name').textContent = snap.datasetName || 'Unknown';
    const answered = (snap.results || []).filter(r => {
      // count only results belonging to the current round's pool
      return (snap.poolIds || []).includes(r.qId);
    }).length;
    const total    = (snap.poolIds || []).length;
    const pct      = total ? Math.round(answered / total * 100) : 0;
    const detail   = [
      `Round ${snap.round}`,
      `${answered} / ${total} answered (${pct}%)`,
      snap.levelFilterLabel ? `🏷 ${snap.levelFilterLabel}` : null,
      `Saved ${fmtDateTime(snap.savedAt)}`
    ].filter(Boolean).join(' · ');
    document.getElementById('resume-detail').textContent = detail;
    card.classList.remove('hidden');
  },

  async resumeProgress() {
    const key  = Views.quiz._progressKey();
    if (!key) return;
    const snap = Storage.lsGet(key, null);
    if (!snap) { Toast.show('No saved progress found', 'warning'); return; }

    const ds = await Storage.getDataset(snap.datasetId);
    if (!ds) {
      Toast.show('Original dataset no longer available', 'error');
      Storage.lsDel(key);
      Views.quiz.renderResumeCard();
      return;
    }

    const resolvedRows = await resolveLocalImages(ds.rows);
    const rowMap = new Map(resolvedRows.map(r => [r.id, r]));
    const questions = (snap.questionIds || []).map(id => rowMap.get(id)).filter(Boolean);
    const pool      = (snap.poolIds     || []).map(id => rowMap.get(id)).filter(Boolean);

    if (!questions.length || !pool.length) {
      Toast.show('Saved progress is incompatible with the current dataset', 'error');
      Storage.lsDel(key);
      Views.quiz.renderResumeCard();
      return;
    }

    State.qz = {
      datasetId:        snap.datasetId,
      datasetName:      snap.datasetName,
      levels:           snap.levels || [],
      levelFilterLabel: snap.levelFilterLabel || null,
      questions, pool,
      idx:         snap.idx,
      round:       snap.round,
      score:       snap.score       || { correct: 0, total: 0 },
      levelScores: snap.levelScores  || {},
      results:     snap.results     || [],
      allAttempts: snap.allAttempts || [],
      answered:    false,
      showCorrect: snap.showCorrect,
      autoRetry:   snap.autoRetry,
      startedAt:   snap.startedAt,
      sessionId:   snap.sessionId
    };

    document.getElementById('quiz-selector').classList.add('hidden');
    document.getElementById('quiz-summary').classList.add('hidden');
    document.getElementById('quiz-player').classList.remove('hidden');
    document.getElementById('btn-quiz-save').classList.remove('hidden');

    Views.quiz.buildGrid();
    // Re-colour squares for already-answered questions in this round
    const resultMap = new Map(State.qz.results.map(r => [r.qId, r.correct]));
    State.qz.pool.forEach((q, i) => {
      if (resultMap.has(q.id)) Views.quiz.updateGridSquare(i, resultMap.get(q.id) ? 'sq-correct' : 'sq-wrong');
    });

    if (snap.roundComplete || snap.idx >= pool.length) {
      Views.quiz.endRound();
    } else {
      Views.quiz.showQuestion(snap.idx);
    }
    Toast.show('Quiz resumed', 'success');
  }
};

// ============================================================
// VIEW: REPORTS
// ============================================================
Views.reports = {
  onEnter() { Views.reports.render(); },

  render() {
    const sessions   = Storage.getSessions();
    const userFilter = document.getElementById('rpt-user-filter').value;
    const dsFilter   = document.getElementById('rpt-dataset-filter').value;
    const modeFilter = document.getElementById('rpt-mode-filter').value;

    // populate filter dropdowns
    Views.reports.populateFilters(sessions);

    let filtered = sessions;
    if (userFilter) filtered = filtered.filter(s => s.userId === userFilter);
    if (dsFilter)   filtered = filtered.filter(s => s.datasetId === dsFilter);
    if (modeFilter) filtered = filtered.filter(s => s.mode === modeFilter);

    filtered = [...filtered].reverse(); // newest first

    const list = document.getElementById('reports-list');
    list.innerHTML = '';

    if (!filtered.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div>
        <p>No sessions recorded yet.</p></div>`;
      return;
    }

    filtered.forEach(s => {
      const div = document.createElement('div');
      div.className = 'report-item';
      const isQuiz = s.mode === 'quiz';

      let scoreHtml = '';
      if (isQuiz && s.finalScore) {
        const pct = s.finalScore.total ? Math.round(s.finalScore.correct / s.finalScore.total * 100) : 0;
        scoreHtml = `<span class="report-score-pill">${s.finalScore.correct}/${s.finalScore.total} (${pct}%)</span>`;
      } else if (!isQuiz) {
        scoreHtml = `<span class="report-score-pill">${s.cardsViewed || 0}/${s.totalCards || '?'} cards</span>`;
      }

      const levelTag = s.levelFilterLabel
        ? `<span class="report-level-tag">\ud83c\udff7 ${esc(s.levelFilterLabel)}</span>`
        : '';

      div.innerHTML = `
        <div class="report-item-header">
          <span class="report-user">${esc(s.userName || 'Anonymous')}</span>
          <span class="report-name">${esc(s.datasetName || 'Unknown')}</span>
          <span class="report-mode-badge ${isQuiz ? 'badge-quiz' : 'badge-flashcard'}">${isQuiz ? 'Quiz' : 'Flashcards'}</span>
          <span class="report-date">${fmtDate(s.startedAt)}</span>
          <span class="report-time">${fmtTime(s.startedAt)}</span>
          ${levelTag}
          ${scoreHtml}
          <span class="report-expand-arrow">›</span>
        </div>
        <div class="report-detail"></div>`;

      div.querySelector('.report-item-header').addEventListener('click', () => {
        div.classList.toggle('open');
        const detail = div.querySelector('.report-detail');
        if (!detail.dataset.built) {
          Views.reports.buildDetail(s, detail);
          detail.dataset.built = '1';
        }
      });

      list.appendChild(div);
    });
  },

  buildDetail(session, container) {
    if (session.mode === 'flashcard') {
      const lev         = session.levels      || [];
      const levelViewed = session.levelViewed || {};
      const levelTotals = session.levelTotals || {};
      const active      = lev.filter(l => (levelTotals[l.name] || 0) > 0);
      const levelFilterLine = session.levelFilterLabel
        ? `<p class="rpt-meta">\ud83c\udff7 ${esc(session.levelFilterLabel)}</p>` : '';
      let levHtml = '';
      if (active.length) {
        levHtml = '<div class="fc-level-report">';
        active.forEach(l => {
          const viewed = levelViewed[l.name] || 0;
          const total  = levelTotals[l.name] || 0;
          const pct    = total ? Math.round(viewed / total * 100) : 0;
          levHtml += `<div class="fc-level-row">
            <span class="level-badge" style="background:${esc(l.color)};color:${esc(contrastColor(l.color))}">${esc(l.name)}</span>
            <span class="fc-level-bar-wrap"><span class="fc-level-bar" style="width:${pct}%;background:${esc(l.color)}"></span></span>
            <span class="fc-level-count">${viewed}\u00a0/\u00a0${total}</span>
          </div>`;
        });
        levHtml += '</div>';
      }
      container.innerHTML = `${levelFilterLine}
        <p style="padding:.35rem 0">Viewed ${session.cardsViewed || 0} of ${session.totalCards || '?'} cards.</p>
        ${levHtml}`;
      return;
    }
    if (!session.attempts || !session.attempts.length) {
      container.innerHTML = '<p>No attempt detail available.</p>';
      return;
    }

    container.innerHTML = `
      <div class="rpt-tabs" role="tablist">
        <button class="rpt-tab active" data-tab="attempts">Attempts</button>
        <button class="rpt-tab" data-tab="chart">Chart</button>
      </div>
      <div class="rpt-pane" data-pane="attempts"></div>
      <div class="rpt-pane rpt-pane-hidden" data-pane="chart"></div>`;

    Views.reports._buildAttemptsPane(session, container.querySelector('[data-pane="attempts"]'));

    container.querySelectorAll('.rpt-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.rpt-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        container.querySelectorAll('.rpt-pane').forEach(p =>
          p.classList.toggle('rpt-pane-hidden', p.dataset.pane !== target)
        );
        const pane = container.querySelector(`[data-pane="${target}"]`);
        if (pane && !pane.dataset.built) {
          pane.dataset.built = '1';
          if (target === 'chart') Views.reports._buildChartPane(session, pane);
        }
      });
    });
  },

  // ── Attempts tab (with level filter + missed-only toggle) ─
  _buildAttemptsPane(session, pane) {
    // Render a cell as an image thumbnail (+ caption for mixed) or plain text.
    const rptCellHtml = (label, src) => {
      if (!src) return esc(label || '?');
      const img  = `<img src="${esc(src)}" class="rpt-cell-img" alt="${esc(label || '')}">`;
      const text = label && label !== '[Image]'
        ? `<span class="rpt-cell-text">${esc(label)}</span>` : '';
      return img + text;
    };
    const lev    = session.levels || [];
    const levels = [...new Set(session.attempts.map(a => a.level).filter(Boolean))].sort();
    const roundCount = session.totalRounds ||
      [...new Set(session.attempts.map(a => a.round))].length;

    // Level score summary
    const ls = session.levelScores || {};
    const activeL = lev.filter(l => ls[l.name] && ls[l.name].total > 0).map(l => [l.name, ls[l.name]]);
    let summaryHtml = '';
    if (activeL.length) {
      summaryHtml = '<div class="report-level-breakdown" style="margin-bottom:.65rem">';
      activeL.forEach(([name, sc]) => {
        const lvl  = lev.find(l => l.name === name);
        const bg   = lvl ? esc(lvl.color) : 'var(--clr-border)';
        const fg   = lvl ? esc(contrastColor(lvl.color)) : 'var(--clr-text)';
        const lpct = sc.total ? Math.round(sc.correct / sc.total * 100) : 0;
        summaryHtml += `<span class="level-badge" style="background:${bg};color:${fg}">${esc(name)}: ${sc.correct}/${sc.total} (${lpct}%)</span>`;
      });
      summaryHtml += '</div>';
    }

    // Level filter buttons — all start active (multi-select toggles)
    const filterHtml = levels.length
      ? `<div class="rpt-level-filter">
          <button class="rpt-lvl-btn active" data-lvl="">All</button>
          ${levels.map(l => {
            const def   = lev.find(lv => lv.name === l);
            const style = def ? `style="background:${esc(def.color)};color:${esc(contrastColor(def.color))}"` : '';
            return `<button class="rpt-lvl-btn level-badge active" data-lvl="${esc(l)}" ${style}>${esc(l)}</button>`;
          }).join('')}
        </div>` : '';

    pane.innerHTML = `${summaryHtml}${filterHtml}
      <div class="rpt-attempts-toolbar">
        ${roundCount > 1 ? `<span class="rpt-meta">${roundCount} rounds</span>` : '<span></span>'}
        <label class="rpt-toggle-label">
          <input type="checkbox" class="rpt-missed-only"> Show missed only
        </label>
      </div>
      <div class="rpt-attempts-list"></div>`;

    const renderAttempts = (activeLevels, missedOnly) => {
      rowIdx = 0;
      const all        = session.attempts;
      const allSelected = activeLevels.size === levels.length;
      const shown  = all.filter(a =>
        (allSelected || (a.level && activeLevels.has(a.level))) && (!missedOnly || !a.correct)
      );
      const rounds = [...new Set(shown.map(a => a.round))].sort((a, b) => a - b);
      let html = '';
      if (!shown.length) {
        const selNames = [...activeLevels].map(n => `\u201c${esc(n)}\u201d`).join(', ');
        html = `<p class="rpt-empty-note">No ${missedOnly ? 'missed ' : ''}questions${!allSelected ? ` for level${activeLevels.size !== 1 ? 's' : ''} ${selNames}` : ''}.</p>`;
      } else {
        rounds.forEach(rn => {
          const fullRound = all.filter(a => a.round === rn);
          const rShown = shown.filter(a => a.round === rn);
          const rC  = fullRound.filter(a => a.correct).length;
          const rT  = fullRound.length;
          const rPct = rT ? Math.round(rC / rT * 100) : 0;
          html += `<div class="report-round-header">Round ${rn} <span class="report-round-score">${rC}/${rT} (${rPct}%)</span></div>`;
          rShown.forEach(a => {
            const deckPos = session.questionIds
              ? session.questionIds.indexOf(a.qId) + 1
              : 0;
            const qNum    = deckPos > 0 ? deckPos : fullRound.indexOf(a) + 1;
            const qPrefix = deckPos > 0 ? 'Q #' : '#';
            const def  = lev.find(l => l.name === a.level);
            const badge = a.level
              ? `<span class="level-badge rpt-q-lvl" ${def ? `style="background:${esc(def.color)};color:${esc(contrastColor(def.color))}"` : ''}>${esc(a.level)}</span>`
              : '';
            const rowCls = rowIdx++ % 2 === 0 ? 'rpt-row-even' : 'rpt-row-odd';
            html += `<div class="report-attempt-item ${rowCls}">
              <span class="attempt-num">${qPrefix}${qNum}</span>
              ${badge}
              <span class="attempt-icon">${a.correct ? '\u2705' : '\u274c'}</span>
              <span class="attempt-body">
                <span class="attempt-q">${rptCellHtml(a.questionLabel, a.questionSrc)}</span>
                ${!a.correct
                  ? `<span class="attempt-hint">\u274c You answered: ${rptCellHtml(a.selectedText, a.selectedSrc)}</span>
                     <span class="attempt-hint attempt-hint-correct">\u2705 Correct: ${rptCellHtml(a.correctLabel, a.correctSrc)}</span>`
                  : ''}
              </span>
            </div>`;
          });
        });
      }
      pane.querySelector('.rpt-attempts-list').innerHTML = html;
    };

    let activeLevels = new Set(levels); // all selected by default
    let missedOnly = false;
    let rowIdx = 0;
    renderAttempts(activeLevels, false);

    pane.querySelectorAll('.rpt-lvl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const lvl = btn.dataset.lvl;
        if (lvl === '') {
          // "All" — reset to every level selected
          activeLevels = new Set(levels);
        } else {
          if (activeLevels.has(lvl)) {
            activeLevels.delete(lvl);
            if (activeLevels.size === 0) activeLevels = new Set(levels); // if last deselected, reset to all
          } else {
            activeLevels.add(lvl);
          }
        }
        const allSelected = activeLevels.size === levels.length;
        pane.querySelectorAll('.rpt-lvl-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.lvl === '' ? allSelected : activeLevels.has(b.dataset.lvl));
        });
        renderAttempts(activeLevels, missedOnly);
      });
    });

    pane.querySelector('.rpt-missed-only').addEventListener('change', e => {
      missedOnly = e.target.checked;
      renderAttempts(activeLevels, missedOnly);
    });
  },

  // ── Performance Chart tab ─────────────────────────────────
  _buildChartPane(session, pane) {
    const attempts  = session.attempts;
    const lev       = session.levels || [];
    const rounds    = [...new Set(attempts.map(a => a.round))].sort((a, b) => a - b);
    const levelKeys = lev.map(l => l.name).filter(n => attempts.some(a => a.level === n));
    const hasLevels = levelKeys.length > 0;

    const ROUND_COLORS = ['#4a90d9','#27ae60','#e67e22','#8e44ad','#e74c3c','#16a085','#f39c12','#2c3e50'];

    // matrix[primary][secondary] = {correct, total}
    const makeMatrix = (primKeys, secKeys, getP, getS) => {
      const m = {};
      primKeys.forEach(pk => { m[pk] = {}; secKeys.forEach(sk => { m[pk][sk] = {correct:0,total:0}; }); });
      attempts.forEach(a => {
        const p = getP(a), s = getS(a);
        if (m[p] && m[p][s] !== undefined) { m[p][s].total++; if (a.correct) m[p][s].correct++; }
      });
      return m;
    };

    let currentView = 'rounds', currentYAxis = 'pct';

    pane.innerHTML = `
      <div class="rpt-chart-controls">
        ${hasLevels ? `<div class="rpt-chart-toggle">
          <button class="rpt-chart-btn active" data-view="rounds">By Round</button>
          <button class="rpt-chart-btn" data-view="levels">By Level</button>
        </div><span class="rpt-chart-sep"></span>` : ''}
        <div class="rpt-chart-toggle">
          <button class="rpt-chart-btn active" data-yaxis="pct">%</button>
          <button class="rpt-chart-btn" data-yaxis="count">Count</button>
        </div>
      </div>
      <div class="rpt-chart-area"></div>
      <div class="rpt-chart-legend"></div>`;

    const renderChart = () => {
      const pctMode = currentYAxis === 'pct';
      let bars, groups;

      if (currentView === 'rounds') {
        if (!hasLevels) {
          groups = [];
          bars = rounds.map(rn => {
            const rA = attempts.filter(a => a.round === rn);
            const correct = rA.filter(a => a.correct).length, total = rA.length;
            const val = pctMode ? (total ? correct / total * 100 : 0) : correct;
            return { label: `R${rn}`, title: `Round ${rn}: ${correct}/${total}`, total,
                     segments: [{ key: 'all', correct, total, val, color: '#4a90d9' }] };
          });
        } else {
          groups = levelKeys.map(n => ({ key: n, label: n, color: lev.find(l => l.name === n)?.color || '#999' }));
          const mx = makeMatrix(rounds, levelKeys, a => a.round, a => a.level);
          bars = rounds.map(rn => {
            const rTotal = attempts.filter(a => a.round === rn).length;
            const segs = groups.map(g => {
              const {correct, total} = mx[rn][g.key];
              return { key: g.key, correct, total,
                       val: pctMode ? (rTotal ? correct / rTotal * 100 : 0) : correct,
                       color: g.color };
            }).filter(s => s.total > 0);
            const allC = segs.reduce((s, x) => s + x.correct, 0);
            return { label: `R${rn}`, title: `Round ${rn}: ${allC}/${rTotal}`, total: rTotal, segments: segs };
          });
        }
      } else {
        groups = rounds.map((rn, i) => ({ key: rn, label: `R${rn}`, color: ROUND_COLORS[i % ROUND_COLORS.length] }));
        const mx = makeMatrix(levelKeys, rounds, a => a.level, a => a.round);
        bars = levelKeys.map(lname => {
          const lTotal = attempts.filter(a => a.level === lname).length;
          const segs = groups.map(g => {
            const {correct, total} = mx[lname][g.key];
            return { key: g.key, correct, total,
                     val: pctMode ? (lTotal ? correct / lTotal * 100 : 0) : correct,
                     color: g.color };
          }).filter(s => s.total > 0);
          const allC = segs.reduce((s, x) => s + x.correct, 0);
          return { label: lname, title: `${lname}: ${allC}/${lTotal}`, total: lTotal, segments: segs };
        });
      }

      pane.querySelector('.rpt-chart-area').innerHTML =
        Views.reports._buildStackedBarSVG(bars, pctMode);

      const legendEl = pane.querySelector('.rpt-chart-legend');
      legendEl.innerHTML = groups.length > 1
        ? groups.map(g =>
            `<span class="rpt-legend-item"><span class="rpt-legend-swatch" style="background:${esc(g.color)}"></span>${esc(g.label)}</span>`
          ).join('')
        : '';
    };

    renderChart();

    pane.querySelectorAll('[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        pane.querySelectorAll('[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.dataset.view;
        renderChart();
      });
    });
    pane.querySelectorAll('[data-yaxis]').forEach(btn => {
      btn.addEventListener('click', () => {
        pane.querySelectorAll('[data-yaxis]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentYAxis = btn.dataset.yaxis;
        renderChart();
      });
    });
  },

  _buildStackedBarSVG(bars, pctMode) {
    if (!bars.length) return '<p class="rpt-empty-note">No data available.</p>';

    const W = 400, padL = 38, padB = 32, padT = 22, padR = 12;
    const chartH = 150, H = chartH + padT + padB;
    const chartW = W - padL - padR;
    const slot   = chartW / bars.length;
    const barW   = Math.min(52, Math.floor(slot * 0.65));

    const maxVal = pctMode ? 100 : Math.max(1, ...bars.map(b => b.total));

    // Grid lines
    const gridVals = pctMode ? [0, 25, 50, 75, 100] : (() => {
      const step = Math.ceil(maxVal / 4);
      return [0, step, step * 2, step * 3, maxVal];
    })();

    let grid = '', svg = '';

    gridVals.forEach(v => {
      const y = (padT + chartH * (1 - v / maxVal)).toFixed(1);
      grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--clr-border)" stroke-width="1"/>`;
      grid += `<text x="${(padL - 4)}" y="${(+y + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--clr-text-muted)">${pctMode ? v + '%' : v}</text>`;
    });

    const axLy = (padT + chartH / 2).toFixed(1);
    const yLabel = `<text x="8" y="${axLy}" text-anchor="middle" font-size="9" fill="var(--clr-text-muted)" transform="rotate(-90,8,${axLy})">${pctMode ? '% Correct' : 'Correct'}</text>`;

    bars.forEach((bar, i) => {
      const cx  = (padL + i * slot + slot / 2).toFixed(1);
      const bx  = (padL + i * slot + (slot - barW) / 2).toFixed(1);
      let yBase = padT + chartH;
      let stackedVal = 0;

      bar.segments.forEach(seg => {
        if (seg.val <= 0) return;
        const segH = seg.val / maxVal * chartH;
        const sy   = (yBase - segH).toFixed(1);
        svg += `<rect x="${bx}" y="${sy}" width="${barW}" height="${segH.toFixed(1)}" fill="${esc(seg.color)}" opacity=".88">
          <title>${esc(String(seg.key))}: ${seg.correct}/${seg.total} correct</title>
        </rect>`;
        yBase    -= segH;
        stackedVal += seg.val;
      });

      // Label above bar
      if (stackedVal > 0) {
        const topY = (padT + chartH * (1 - stackedVal / maxVal) - 3).toFixed(1);
        svg += `<text x="${cx}" y="${topY}" text-anchor="middle" font-size="10" font-weight="600" fill="var(--clr-text)">${pctMode ? Math.round(stackedVal) + '%' : Math.round(stackedVal)}</text>`;
      }

      // X-axis label
      svg += `<text x="${cx}" y="${(H - padB + 4).toFixed(1)}" dy=".9em" text-anchor="middle" font-size="10" fill="var(--clr-text-muted)">${esc(bar.label)}</text>`;

      // Invisible overlay for bar tooltip
      const bTotalH = (bar.total / maxVal * chartH).toFixed(1);
      const bTotalY = (padT + chartH - +bTotalH).toFixed(1);
      svg += `<rect x="${bx}" y="${bTotalY}" width="${barW}" height="${bTotalH}" fill="none" pointer-events="all"><title>${esc(bar.title)}</title></rect>`;
    });

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="rpt-bar-svg" role="img" aria-label="Performance chart">
      ${yLabel}${grid}${svg}
    </svg>`;
  },

  populateFilters(sessions) {
    const userSel = document.getElementById('rpt-user-filter');
    const dsSel   = document.getElementById('rpt-dataset-filter');

    const curUser = userSel.value;
    const curDs   = dsSel.value;

    // users
    const users = [...new Map(sessions.filter(s => s.userId).map(s => [s.userId, { id: s.userId, name: s.userName }])).values()];
    userSel.innerHTML = '<option value="">All Users</option>';
    users.forEach(u => {
      const opt = new Option(u.name, u.id);
      if (u.id === curUser) opt.selected = true;
      userSel.appendChild(opt);
    });

    // datasets
    const datasets = [...new Map(sessions.map(s => [s.datasetId, s.datasetName])).entries()];
    dsSel.innerHTML = '<option value="">All Datasets</option>';
    datasets.forEach(([id, name]) => {
      const opt = new Option(name, id);
      if (id === curDs) opt.selected = true;
      dsSel.appendChild(opt);
    });
  }
};

// ============================================================
// VIEW: SETTINGS
// ============================================================
Views.settings = {
  onEnter() { Views.settings.render(); },

  render() {
    const prefs = Settings.load();
    ['theme', 'questionFontSize', 'questionFontFamily', 'questionFontWeight', 'questionFontStyle',
     'answerFontSize', 'answerFontFamily', 'answerFontWeight', 'answerFontStyle',
     'verdictFontSize', 'verdictFontFamily', 'verdictFontWeight', 'verdictFontStyle',
     'feedbackFontSize', 'feedbackFontFamily', 'feedbackFontWeight', 'feedbackFontStyle',
     'flipSpeed'].forEach(key => {
      const ctrl = document.getElementById('setting-' + key);
      if (!ctrl) return;
      ctrl.querySelectorAll('.seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === String(prefs[key]));
      });
    });
    ['reportRowEven', 'reportRowOdd'].forEach(key => {
      const inp = document.getElementById('setting-' + key);
      if (inp) inp.value = prefs[key] || Settings.DEFAULTS[key];
    });

    // About: show app version and active SW cache name
    const verLine = document.getElementById('appVersionLine');
    if (verLine) {
      if ('caches' in window) {
        caches.keys().then(function (keys) {
          verLine.textContent = 'Version ' + APP_VERSION + '  \u00B7  cache: ' + (keys.length ? keys.join(', ') : 'none');
        });
      } else {
        verLine.textContent = 'Version ' + APP_VERSION;
      }
    }
  },
};

// ============================================================
// EVENT WIRING
// ============================================================
function wireEvents() {
  // ── Nav ──
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', e => {
      const view = e.currentTarget.dataset.view;
      if (view) Router.navigate(view);
    });
  });

  document.getElementById('hamburger').addEventListener('click', () => {
    const nav     = document.getElementById('app-nav');
    const isOpen  = nav.classList.toggle('open');
    document.getElementById('hamburger').setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // close mobile nav on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.app-header')) {
      document.getElementById('app-nav').classList.remove('open');
    }
  });

  // ── Modal overlay click to close ──
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) Modal.hide();
  });

  // ── Image lightbox ──
  document.getElementById('img-lightbox').addEventListener('click', () => Lightbox.hide());
  document.getElementById('img-lightbox-close').addEventListener('click', e => { e.stopPropagation(); Lightbox.hide(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('img-lightbox').classList.contains('hidden')) Lightbox.hide();
  });

  // ── Lightbox pan + zoom (mouse wheel, mouse drag, touch pinch, single-finger pan) ──
  (function () {
    const lb    = document.getElementById('img-lightbox');
    const lbImg = document.getElementById('img-lightbox-img');

    let scale = 1;
    let tx = 0, ty = 0;                      // current translate in screen px

    // ── drag state ──
    let dragging = false;
    let dragX = 0, dragY = 0;                // pointer position at drag start
    let dragTx = 0, dragTy = 0;             // translate at drag start
    let didDrag = false;                     // suppress accidental click after drag

    // ── pinch state ──
    let pinchDist0 = 0;
    let pinchScale0 = 1;
    let pinchTx0 = 0, pinchTy0 = 0;
    let singleTouchX = 0, singleTouchY = 0;
    let singleTouchTx = 0, singleTouchTy = 0;

    function clamp(val, min, max) { return Math.min(max, Math.max(min, val)); }

    function maxPan() {
      // Allow panning up to the point where the scaled edge reaches the original edge position.
      return {
        x: Math.max(0, lbImg.offsetWidth  * (scale - 1) / 2),
        y: Math.max(0, lbImg.offsetHeight * (scale - 1) / 2)
      };
    }

    function applyTransform() {
      const m = maxPan();
      tx = clamp(tx, -m.x, m.x);
      ty = clamp(ty, -m.y, m.y);
      lbImg.style.transform = scale > 1 ? `translate(${tx}px,${ty}px) scale(${scale})` : '';
      lbImg.style.cursor     = scale > 1 ? (dragging ? 'grabbing' : 'grab') : '';
    }

    function resetState() {
      scale = 1; tx = 0; ty = 0;
      dragging = false; didDrag = false;
      lbImg.style.transform = '';
      lbImg.style.cursor    = '';
    }
    Lightbox._resetZoom = resetState;

    // ── Mouse wheel zoom (zoom toward cursor) ──
    lb.addEventListener('wheel', e => {
      e.preventDefault();
      const factor    = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newScale  = clamp(scale * factor, 1, 5);
      if (newScale === scale) return;

      // Keep the point under the cursor fixed during zoom
      const rect = lbImg.getBoundingClientRect();
      const cx   = e.clientX - (rect.left + rect.width  / 2);
      const cy   = e.clientY - (rect.top  + rect.height / 2);
      const sf   = newScale / scale;
      tx = cx * (1 - sf) + tx * sf;
      ty = cy * (1 - sf) + ty * sf;
      scale = newScale;
      if (scale <= 1) { tx = 0; ty = 0; }
      applyTransform();
    }, { passive: false });

    // ── Mouse drag pan ──
    lbImg.addEventListener('mousedown', e => {
      if (scale <= 1) return;
      e.preventDefault();
      dragging = true; didDrag = false;
      dragX = e.clientX; dragY = e.clientY;
      dragTx = tx; dragTy = ty;
      lbImg.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.clientX - dragX;
      const dy = e.clientY - dragY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
      tx = dragTx + dx;
      ty = dragTy + dy;
      applyTransform();
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      applyTransform();   // re-applies cursor: grab
    });

    // Prevent a post-drag click from closing the lightbox
    lbImg.addEventListener('click', e => {
      e.stopPropagation();
      if (didDrag) { didDrag = false; e.preventDefault(); }
    });

    // ── Touch: pinch-to-zoom + single-finger pan ──
    function getTouchDist(t1, t2) {
      return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }

    lbImg.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        pinchDist0   = getTouchDist(e.touches[0], e.touches[1]);
        pinchScale0  = scale;
        pinchTx0     = tx;
        pinchTy0     = ty;
      } else if (e.touches.length === 1 && scale > 1) {
        e.preventDefault();
        singleTouchX  = e.touches[0].clientX;
        singleTouchY  = e.touches[0].clientY;
        singleTouchTx = tx;
        singleTouchTy = ty;
      }
    }, { passive: false });

    lbImg.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist     = getTouchDist(e.touches[0], e.touches[1]);
        const newScale = clamp(pinchScale0 * (dist / pinchDist0), 1, 5);
        const sf       = newScale / scale;
        tx = pinchTx0 * (newScale / pinchScale0);
        ty = pinchTy0 * (newScale / pinchScale0);
        scale = newScale;
        applyTransform();
      } else if (e.touches.length === 1 && scale > 1) {
        e.preventDefault();
        tx = singleTouchTx + (e.touches[0].clientX - singleTouchX);
        ty = singleTouchTy + (e.touches[0].clientY - singleTouchY);
        applyTransform();
      }
    }, { passive: false });

    lbImg.addEventListener('touchend', () => {
      if (scale < 1.05) resetState();
    });
  }());

  // ── Users view ──
  document.getElementById('btn-add-user').addEventListener('click', () => {
    const input = document.getElementById('new-user-input');
    const name  = input.value.trim();
    if (!name) { Toast.show('Enter a name first', 'warning'); return; }
    const users = Storage.getUsers();
    if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
      Toast.show('A user with that name already exists', 'warning'); return;
    }
    const user = { id: genId(), name, createdAt: new Date().toISOString() };
    users.push(user);
    Storage.saveUsers(users);
    State.currentUser = user;
    Storage.setCurrentUser(user);
    Views.users.updateNavUser();
    input.value = '';
    Views.users.render();
    Toast.show(`Welcome, ${name}!`, 'success');
  });
  document.getElementById('new-user-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-add-user').click();
  });

  document.getElementById('btn-anon').addEventListener('click', () => {
    State.currentUser = null;
    Storage.setCurrentUser(null);
    Views.users.updateNavUser();
    Toast.show('Continuing as Anonymous', 'info');
    Views.users.render();
    Router.navigate('home');
  });

  document.getElementById('btn-export-backup').addEventListener('click', () => Backup.export());
  document.getElementById('btn-import-backup').addEventListener('click', () => {
    document.getElementById('backup-file-input').click();
  });
  document.getElementById('backup-file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) Backup.import(file);
    e.target.value = '';
  });

  // ── Data view ──
  document.getElementById('btn-browse').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });
  document.getElementById('file-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) Views.data.handleFile(file);
    e.target.value = '';
  });

  const uploadArea = document.getElementById('upload-area');
  uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) Views.data.handleFile(file);
  });
  uploadArea.addEventListener('click', e => {
    if (e.target.classList.contains('link-btn')) return; // handled above
    document.getElementById('file-input').click();
  });

  document.getElementById('btn-export-csv').addEventListener('click',  () => DataExport.downloadCSV());
  document.getElementById('btn-export-xlsx').addEventListener('click', () => DataExport.downloadXLSX());

  // ── Builder view ──
  document.getElementById('btn-new-deck').addEventListener('click',      () => Views.builder.newDeck());
  document.getElementById('btn-combine-decks').addEventListener('click', () => Views.builder.combine.open());
  document.getElementById('btn-builder-add-q').addEventListener('click',  () => Views.builder.addQuestion());
  document.getElementById('btn-builder-missing-imgs').addEventListener('click', async e => {
    const btn = e.currentTarget;
    State.bld.filterMissingImgs = !State.bld.filterMissingImgs;
    btn.classList.toggle('active', State.bld.filterMissingImgs);

    if (!State.bld.filterMissingImgs) {
      State.bld.missingImgIds = null;
      Views.builder.renderQuestions();
      return;
    }

    btn.disabled = true;
    btn.textContent = '🔍 Checking…';

    // Build a set of known local-library image names.
    const libImgs    = await Storage.getAllImages();
    const knownNames = new Set(libImgs.map(i => i.name));

    // Returns true if src is a working image (loads within 5s), false if broken/absent.
    const srcLoads = src => new Promise(resolve => {
      if (!src)                     return resolve(false);
      if (src.startsWith('data:'))  return resolve(true);   // embedded – always present
      const img   = new Image();
      const timer = setTimeout(() => resolve(false), 5000); // treat timeout as broken
      img.onload  = () => { clearTimeout(timer); resolve(true);  };
      img.onerror = () => { clearTimeout(timer); resolve(false); };
      img.src = src;
    });

    // Resolve the display src for a cell (null = cell has no image reference).
    const cellSrc = cell => {
      if (!cell || cell.type === 'text') return null;
      if (cell.type === 'image')  return cell.src || null;
      if (cell.type === 'mixed')  return cell.src || null;
      // local-image or mixed with localImage
      const name = cell.name || cell.localImage || cell.fromLibrary || null;
      if (!name) return null;
      const rec = libImgs.find(i => i.name === name);
      return rec ? rec.src : '';   // empty string = name exists as reference but no src
    };

    // A cell is "missing" if it has an image reference whose src fails to load.
    const cellMissing = async cell => {
      const src = cellSrc(cell);
      if (src === null) return false;  // text cell – no image expected
      return !(await srcLoads(src));   // image expected but broken / not in library
    };

    const rowMissing = async row => (
      await cellMissing(row.question) ||
      await cellMissing(row.correctAnswer) ||
      (await Promise.all((row.wrongAnswers || []).map(cellMissing))).some(Boolean)
    );

    const rows    = State.bld.draft.rows;
    const results = await Promise.all(rows.map(rowMissing));
    State.bld.missingImgIds = new Set(rows.filter((_, i) => results[i]).map(r => r.id));

    btn.disabled  = false;
    btn.innerHTML = `${ICON_IMG_UPLOAD} Missing Images`;
    Views.builder.renderQuestions();
  });
  document.getElementById('builder-search-input').addEventListener('input', e => {
    State.bld.searchText = e.target.value;
    Views.builder.renderQuestions();
  });
  document.getElementById('btn-builder-missing-levels').addEventListener('click', e => {
    const btn = e.currentTarget;
    State.bld.filterMissingLevels = !State.bld.filterMissingLevels;
    btn.classList.toggle('active', State.bld.filterMissingLevels);
    Views.builder.renderQuestions();
  });
  document.getElementById('btn-builder-save').addEventListener('click',   () => Views.builder.save());
  document.getElementById('btn-builder-save-copy').addEventListener('click', () => Views.builder.saveAsCopy());
  document.getElementById('btn-builder-export').addEventListener('click', () => Views.builder.showExportDialog());
  document.getElementById('btn-builder-levels').addEventListener('click', () => Views.builder.showLevelsDialog());

  // ── Bulk selection bar ────────────────────────────────────────────────
  document.getElementById('bulk-level-btn').addEventListener('click', e => {
    e.stopPropagation();
    const pop = document.getElementById('bulk-level-pop');
    const isOpen = pop.classList.contains('open');
    document.querySelectorAll('.level-picker-pop.open').forEach(p => p.classList.remove('open'));
    if (!isOpen) pop.classList.add('open');
  });
  document.getElementById('bulk-level-pop').addEventListener('click', e => {
    const opt = e.target.closest('[data-level]');
    if (!opt) return;
    e.stopPropagation();
    Views.builder.bulkAssignLevel(opt.dataset.level);
    document.getElementById('bulk-level-pop').classList.remove('open');
  });
  document.getElementById('bulk-clear-levels').addEventListener('click', () => Views.builder.bulkAssignLevel(''));
  document.getElementById('bulk-select-all').addEventListener('click', () => {
    document.querySelectorAll('.builder-q-card').forEach(c => {
      State.bld.selectedIds.add(c.dataset.rowId);
      const cb = c.querySelector('.q-select-cb');
      if (cb) cb.checked = true;
    });
    Views.builder.updateBulkBar();
  });
  document.getElementById('bulk-deselect').addEventListener('click', () => {
    State.bld.selectedIds = new Set();
    document.querySelectorAll('.q-select-cb').forEach(cb => { cb.checked = false; });
    Views.builder.updateBulkBar();
  });
  // Close any open level-picker or colour-palette pops on outside click
  document.addEventListener('click', () => {
    document.querySelectorAll('.level-picker-pop.open').forEach(p => p.classList.remove('open'));
  });
  document.getElementById('btn-builder-close').addEventListener('click',  () => Views.builder.closeEditor());

  // ── Flashcard view ──
  // ── Level Filter (Flashcards) ──
  document.getElementById('btn-fc-lf-back').addEventListener('click',  () => LevelFilter.hide('fc'));
  document.getElementById('btn-fc-lf-all').addEventListener('click',   () => LevelFilter.selectAll('fc'));
  document.getElementById('btn-fc-lf-none').addEventListener('click',  () => LevelFilter.selectNone('fc'));
  document.getElementById('btn-fc-lf-start').addEventListener('click', () => {
    const p = LevelFilter._pending.fc;
    if (!p) return;
    Views.flashcards.startWithDs(p.ds, LevelFilter.readFilter('fc'));
  });

  // ── Level Filter (Quiz) ──
  document.getElementById('btn-quiz-lf-back').addEventListener('click',  () => LevelFilter.hide('quiz'));
  document.getElementById('btn-quiz-lf-all').addEventListener('click',   () => LevelFilter.selectAll('quiz'));
  document.getElementById('btn-quiz-lf-none').addEventListener('click',  () => LevelFilter.selectNone('quiz'));
  document.getElementById('btn-quiz-lf-start').addEventListener('click', () => {
    const p = LevelFilter._pending.quiz;
    if (!p) return;
    Views.quiz.startWithDs(p.ds, LevelFilter.readFilter('quiz'));
  });

  document.getElementById('fc-card').addEventListener('click', () => Views.flashcards.flip());
  document.getElementById('fc-card').addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); Views.flashcards.flip(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') Views.flashcards.next();
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   Views.flashcards.prev();
  });
  document.getElementById('btn-fc-next').addEventListener('click',    () => Views.flashcards.next());
  document.getElementById('btn-fc-prev').addEventListener('click',    () => Views.flashcards.prev());
  document.getElementById('btn-fc-restart').addEventListener('click', () => Views.flashcards.restart());
  document.getElementById('btn-fc-save').addEventListener('click',    () => Views.flashcards.saveProgress());
  document.getElementById('btn-resume-fc').addEventListener('click',  () => Views.flashcards.resumeProgress());
  document.getElementById('btn-discard-fc-resume').addEventListener('click', () => {
    Views.flashcards._clearProgress();
    Views.flashcards.renderResumeCard();
  });
  document.getElementById('btn-fc-exit').addEventListener('click', () => {
    const user = State.currentUser;
    if (user) {
      Modal.show({
        title: 'Exit Flashcards',
        body:  'Save your progress so you can resume this session later?',
        buttons: [
          { label: 'Cancel' },
          { label: 'Exit without saving', cls: 'btn-ghost', action: () => {
            Views.flashcards._clearProgress();
            Views.flashcards.exit();
          }},
          { label: '\ud83d\udcbe Save & Exit', cls: 'btn-primary', action: () => {
            Views.flashcards.saveProgress();
            Views.flashcards.exit();
          }}
        ]
      });
    } else {
      Views.flashcards.exit();
    }
  });

  // global keyboard for flashcards
  document.addEventListener('keydown', e => {
    if (document.querySelector('#view-flashcards.active') &&
        document.getElementById('fc-player') &&
        !document.getElementById('fc-player').classList.contains('hidden') &&
        document.activeElement !== document.getElementById('fc-card')) {
      if (e.key === ' ') { e.preventDefault(); Views.flashcards.flip(); }
      if (e.key === 'ArrowRight') Views.flashcards.next();
      if (e.key === 'ArrowLeft')  Views.flashcards.prev();
    }
  });

  // ── Quiz view ──
  document.getElementById('btn-quiz-exit').addEventListener('click', () => {
    const user = State.currentUser;
    if (user) {
      Modal.show({
        title: 'Exit Quiz',
        body: 'Save your progress so you can resume this quiz later?',
        buttons: [
          { label: 'Cancel' },
          { label: 'Exit without saving', cls: 'btn-ghost', action: () => Views.quiz.onEnter() },
          { label: '💾 Save & Exit', cls: 'btn-primary', action: () => { Views.quiz.saveProgress(); Views.quiz.onEnter(); } }
        ]
      });
    } else {
      Modal.show({
        title: 'Exit Quiz',
        body: "You're playing anonymously — progress cannot be saved. Exit anyway?",
        buttons: [
          { label: 'Cancel' },
          { label: 'Exit anyway', cls: 'btn-warning', action: () => Views.quiz.onEnter() }
        ]
      });
    }
  });
  document.getElementById('btn-quiz-save').addEventListener('click', () => Views.quiz.saveProgress());
  document.getElementById('btn-resume-quiz').addEventListener('click', () => Views.quiz.resumeProgress());
  document.getElementById('btn-discard-resume').addEventListener('click', () => {
    const key = Views.quiz._progressKey();
    if (key) Storage.lsDel(key);
    Views.quiz.renderResumeCard();
  });
  document.getElementById('btn-quiz-next').addEventListener('click', () => {
    Views.quiz.showQuestion(State.qz.idx + 1);
  });
  // keyboard: 1-4 to select answer
  document.addEventListener('keydown', e => {
    if (!document.querySelector('#view-quiz.active')) return;
    if (document.getElementById('quiz-player').classList.contains('hidden')) return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= 4) {
      const btns = document.querySelectorAll('.choice-btn');
      if (btns[num - 1] && !btns[num - 1].disabled) btns[num - 1].click();
    }
    if ((e.key === 'Enter' || e.key === 'ArrowRight') && State.qz.answered) {
      const nextBtn = document.getElementById('btn-quiz-next');
      if (nextBtn && !document.getElementById('quiz-feedback').classList.contains('hidden')) nextBtn.click();
    }
  });
  document.getElementById('btn-retry-wrong').addEventListener('click', () => Views.quiz.retryWrong());
  document.getElementById('btn-quiz-new').addEventListener('click',    () => Views.quiz.onEnter());
  document.getElementById('btn-quiz-home').addEventListener('click',   () => Router.navigate('home'));

  // ── Image Library ──
  document.getElementById('btn-upload-images').addEventListener('click', () => {
    document.getElementById('image-lib-input').click();
  });
  document.getElementById('image-lib-input').addEventListener('change', e => {
    if (e.target.files.length) Views.data.uploadImages(e.target.files);
    e.target.value = '';
  });

  // ── Reports view ──
  document.getElementById('rpt-user-filter').addEventListener('change',    () => Views.reports.render());
  document.getElementById('rpt-dataset-filter').addEventListener('change', () => Views.reports.render());
  document.getElementById('rpt-mode-filter').addEventListener('change',    () => Views.reports.render());
  document.getElementById('btn-clear-sessions').addEventListener('click',  () => {
    Modal.confirm('Clear History', 'Delete all session history? This cannot be undone.', () => {
      Storage.clearSessions();
      Views.reports.render();
      Toast.show('History cleared', 'info');
    }, 'Clear All', 'btn-danger');
  });

  // ── Settings view ──
  ['theme', 'questionFontSize', 'questionFontFamily', 'questionFontWeight', 'questionFontStyle',
   'answerFontSize', 'answerFontFamily', 'answerFontWeight', 'answerFontStyle',
   'verdictFontSize', 'verdictFontFamily', 'verdictFontWeight', 'verdictFontStyle',
   'feedbackFontSize', 'feedbackFontFamily', 'feedbackFontWeight', 'feedbackFontStyle',
   'flipSpeed'].forEach(key => {
    const ctrl = document.getElementById('setting-' + key);
    if (!ctrl) return;
    ctrl.addEventListener('click', e => {
      const btn = e.target.closest('.seg-btn');
      if (!btn) return;
      const prefs = Settings.load();
      prefs[key] = btn.dataset.value;
      Settings.save(prefs);
      Settings.apply(prefs);
      Views.settings.render();
    });
  });

  // colour pickers for report rows
  ['reportRowEven', 'reportRowOdd'].forEach(key => {
    const inp = document.getElementById('setting-' + key);
    if (!inp) return;
    inp.addEventListener('input', () => {
      const prefs = Settings.load();
      prefs[key] = inp.value;
      Settings.save(prefs);
      Settings.apply(prefs);
    });
  });

  document.getElementById('btn-settings-reset').addEventListener('click', () => {
    Settings.save({ ...Settings.DEFAULTS });
    Settings.apply();
    Views.settings.render();
    Toast.show('Settings reset to defaults', 'info');
  });
}

// ============================================================
// INIT
// ============================================================
async function init() {
  try {
    await Storage.initDB();
  } catch (e) {
    console.warn('IndexedDB unavailable, falling back to localStorage for datasets:', e);
  }

  Settings.apply();
  const savedUser = Storage.getCurrentUser();
  if (savedUser) {
    // verify still in user list
    const exists = Storage.getUsers().find(u => u.id === savedUser.id);
    State.currentUser = exists || null;
    if (!exists) Storage.setCurrentUser(null);
  }

  // update nav user display
  document.getElementById('nav-user-name').textContent =
    State.currentUser ? State.currentUser.name : 'Anonymous';

  wireEvents();
  Router.navigate('home');
}

document.addEventListener('DOMContentLoaded', function () {
  init();
  // Register service worker for PWA offline support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(function (reg) {
        reg.addEventListener('updatefound', function () {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', function () {
            // 'installed' + existing controller = a new version is waiting (not first install)
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              document.querySelectorAll('.toast-update').forEach(el => el.remove());
              const t = document.createElement('div');
              t.className = 'toast-update';
              t.textContent = 'Update available \u2014 tap to refresh';
              t.setAttribute('role', 'button');
              t.setAttribute('tabindex', '0');
              t.setAttribute('aria-label', 'Update available \u2014 tap to refresh');
              const reload = () => window.location.reload();
              t.addEventListener('click', reload);
              t.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reload(); }
              });
              document.body.appendChild(t);
            }
          });
        });
      })
      .catch(function () { /* SW unavailable — app still works fine */ });
  }
});
