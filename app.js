/* ============================================================
   FlashQuiz – app.js
   Plain vanilla JS (ES6+, "use strict")
   No frameworks, no build step.
   ============================================================ */
'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const APP_VERSION  = '1.0.0';
const DB_NAME      = 'FlashQuizDB';
const DB_VERSION   = 2;
const STORE_DS     = 'datasets';
const STORE_IMGS   = 'images';

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
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
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
function renderCell(cell, container) {
  container.innerHTML = '';
  if (!cell) return;
  if (cell.type === 'image') {
    const img = document.createElement('img');
    img.src   = cell.src;
    img.alt   = '';
    img.className = 'cell-image';
    img.onerror = () => {
      img.remove();
      const err = document.createElement('div');
      err.className = 'image-error';
      err.textContent = '⚠ Image unavailable';
      container.appendChild(err);
    };
    container.appendChild(img);
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
        el.onerror   = () => {
          el.remove();
          const err = document.createElement('div');
          err.className   = 'image-error';
          err.textContent = `⚠ Image error: ${cell.name}`;
          container.appendChild(err);
        };
        container.appendChild(el);
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
    img.onerror   = () => {
      img.remove();
      const err = document.createElement('div');
      err.className   = 'image-error';
      err.textContent = '⚠ Image unavailable';
      container.appendChild(err);
    };
    const txt = document.createElement('p');
    txt.className   = 'cell-mixed-text';
    txt.textContent = cell.text;
    if (cell.imgPosition === 'inline') {
      const wrap = document.createElement('div');
      wrap.className = 'cell-mixed-inline';
      wrap.appendChild(img);
      wrap.appendChild(txt);
      container.appendChild(wrap);
    } else if (cell.imgPosition === 'after') {
      container.appendChild(txt);
      container.appendChild(img);
    } else {
      container.appendChild(img);
      container.appendChild(txt);
    }
  } else {
    container.textContent = cell.text;
  }
}

/** Short text label for a cell (used in reports, feedback) */
function cellLabel(cell) {
  if (!cell) return '';
  if (cell.type === 'image') return '🖼 [Image]';
  if (cell.type === 'local-image') return `🖼 [${cell.name}]`;
  if (cell.type === 'mixed') return `🖼 ${cell.text}`;
  return cell.text;
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
  bld: { editingId: null }
};

// ============================================================
// ROUTER
// ============================================================
const Router = {
  navigate(view) {
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
  }
};

// ============================================================
// MODAL
// ============================================================
const Modal = {
  show({ title, body, buttons = [] }) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML   = '';
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
// FILE PARSING
// ============================================================
const FileParser = {
  /** Convert a 2-D array of cell values into a Dataset object */
  rawToDataset(rawRows, name) {
    const rows = [];
    for (const raw of rawRows) {
      if (!raw || raw.length === 0) continue;
      const q = parseCell(raw[0]);
      if (!q) continue;
      const correct = parseCell(raw[1]);
      if (!correct) continue;
      const wrong = [];
      for (let i = 2; i < raw.length; i++) {
        const c = parseCell(raw[i]);
        if (c) wrong.push(c);
      }
      rows.push({ id: genId(), question: q, correctAnswer: correct, wrongAnswers: wrong });
    }
    return { id: genId(), name, createdAt: new Date().toISOString(), rows };
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
      ['Question', 'Correct Answer', 'Wrong 1', 'Wrong 2', 'Wrong 3'],
      ['What is the capital of France?', 'Paris', 'London', 'Berlin', 'Madrid'],
      ['Which planet is closest to the Sun?', 'Mercury', 'Venus', 'Earth', 'Mars'],
      ['What is 7 × 8?', '56', '48', '54', '64'],
      ['Who wrote "Romeo and Juliet"?', 'William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Mark Twain'],
      ['What is the chemical symbol for water?', 'H2O', 'CO2', 'O2', 'H2SO4'],
      ['https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Eiffel_Tower_20051010.jpg/320px-Eiffel_Tower_20051010.jpg',
        'Eiffel Tower', 'Big Ben', 'Statue of Liberty', 'Colosseum'],
      ['Which element has the atomic number 1?', 'Hydrogen', 'Helium', 'Lithium', 'Carbon'],
      ['How many sides does a hexagon have?', '6', '5', '7', '8'],
      ['What is the largest ocean on Earth?', 'Pacific Ocean', 'Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'],
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
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
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
    XLSX.utils.book_append_sheet(wb, ws, 'Quiz');
    XLSX.writeFile(wb, 'sample-flashquiz.xlsx');
  },

  /** Export a dataset from IndexedDB/state as CSV */
  datasetToCSV(ds) {
    const rows = ds.rows.map(r => {
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
      return [toCell(r.question), toCell(r.correctAnswer), ...r.wrongAnswers.map(toCell)];
    });
    return DataExport._toCSV(rows);
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
// RESOLVE LOCAL IMAGES
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
    wrongAnswers:  await Promise.all(r.wrongAnswers.map(resolveCellImg))
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
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url  = URL.createObjectURL(blob);
          const a    = Object.assign(document.createElement('a'), { href: url, download: ds.name + '.csv' });
          document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(url);

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
          <button class="btn btn-ghost btn-xs" data-group-action="rename" title="Rename group">✏️ Rename</button>
          <button class="btn btn-ghost btn-xs" data-group-action="export" title="Export group as ZIP">⬇ Export</button>
          <button class="btn btn-danger btn-xs"  data-group-action="delete" title="Delete all images in group">🗑 Delete All</button>
        </div>`;

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
      let ds;
      const name = file.name.replace(/\.[^.]+$/, '');

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
          <button class="btn btn-secondary" data-action="edit" data-id="${m.id}">✏ Edit</button>
          <button class="btn btn-danger"    data-action="del"  data-id="${m.id}">Delete</button>`;
        list.appendChild(div);
      });

      list.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', async e => {
          const id     = e.currentTarget.dataset.id;
          const action = e.currentTarget.dataset.action;
          if (action === 'edit') {
            const ds = await Storage.getDataset(id);
            if (ds) Views.builder.openEditor(ds);
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

    // hide editor when rendering list
    if (!State.bld.editingId) {
      document.getElementById('builder-editor').classList.add('hidden');
    }
  },

  newDeck() {
    const ds = { id: genId(), name: 'New Deck', createdAt: new Date().toISOString(), rows: [] };
    Views.builder.openEditor(ds);
  },

  openEditor(ds) {
    State.bld.editingId = ds.id;
    State.bld.draft = JSON.parse(JSON.stringify(ds)); // deep clone

    document.getElementById('deck-name-input').value  = ds.name;
    document.getElementById('builder-editor').classList.remove('hidden');
    document.getElementById('builder-deck-list').innerHTML = '';

    Views.builder.renderQuestions();
  },

  renderQuestions() {
    const container = document.getElementById('builder-questions-list');
    container.innerHTML = '';
    const rows = State.bld.draft.rows;

    if (!rows.length) {
      container.innerHTML = `<div class="empty-state"><p>No questions yet. Click <strong>+ Add Question</strong>.</p></div>`;
      return;
    }

    rows.forEach((row, idx) => {
      container.appendChild(Views.builder.makeQuestionCard(row, idx));
    });
  },

  makeQuestionCard(row, idx) {
    const card = document.createElement('div');
    card.className   = 'builder-q-card';
    card.dataset.rowId = row.id;

    const q  = row.question      || { type: 'text', text: '' };
    const ca = row.correctAnswer || { type: 'text', text: '' };
    const qText  = (q.type  === 'text' || q.type  === 'mixed') ? esc(q.text  || '') : '';
    const caText = (ca.type === 'text' || ca.type === 'mixed') ? esc(ca.text || '') : '';
    const qHasImg  = q.type  === 'image' || q.type  === 'mixed';
    const caHasImg = ca.type === 'image' || ca.type === 'mixed';
    const qPos  = q.imgPosition  || 'before';
    const caPos = ca.imgPosition || 'before';

    const wrongHtml = row.wrongAnswers.map((w, wi) => {
      const wt = (w.type === 'text' || w.type === 'mixed') ? esc(w.text || '') : '';
      const wh = w.type === 'image' || w.type === 'mixed';
      const wp = w.imgPosition || 'before';
      return `
      <div class="wrong-answer-row" data-wi="${wi}">
        <textarea class="wrong-text" rows="2" placeholder="Wrong answer ${wi + 1}\u2026">${wt}</textarea>
        <button class="builder-img-btn" title="Upload image" data-role="wrong-img" data-wi="${wi}">🖼</button>
        <button class="builder-img-btn" title="Pick from library" data-role="wrong-lib" data-wi="${wi}">📚</button>
        ${wh ? `<img src="${esc(w.src)}" class="builder-img-preview" data-role="wrong-img-preview-${wi}">` : ''}
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
        <span class="builder-q-num">Q ${idx + 1}</span>
        <button class="btn btn-danger btn-sm" data-role="del-q">✕ Remove</button>
      </div>

      <div class="builder-field-label">Question</div>
      <div class="builder-field-row">
        <textarea class="q-text" rows="2" placeholder="Question text…">${qText}</textarea>
        <button class="builder-img-btn" title="Upload image" data-role="q-img">🖼</button>
        <button class="builder-img-btn" title="Pick from library" data-role="q-lib">📚</button>
      </div>
      ${qHasImg ? `<img src="${esc(q.src)}" class="builder-img-preview" data-role="q-img-preview">` : ''}
      ${q.type === 'local-image' ? `<span class="local-img-tag q-lib-tag">📚 ${esc(q.name)}</span>` : ''}
      <div class="img-pos-row${q.type === 'mixed' ? '' : ' hidden'}" data-role="q-pos-row">
        <span class="img-pos-label">Image:</span>
        <button class="img-pos-opt${qPos === 'before' ? ' active' : ''}" data-role="q-pos-before">Above</button>
        <button class="img-pos-opt${qPos === 'inline' ? ' active' : ''}" data-role="q-pos-inline">Inline</button>
        <button class="img-pos-opt${qPos === 'after' ? ' active' : ''}" data-role="q-pos-after">Below</button>
      </div>

      <div class="builder-field-label" style="margin-top:.6rem">Correct Answer</div>
      <div class="builder-field-row">
        <textarea class="ca-text" rows="2" placeholder="Correct answer\u2026">${caText}</textarea>
        <button class="builder-img-btn" title="Upload image" data-role="ca-img">🖼</button>
        <button class="builder-img-btn" title="Pick from library" data-role="ca-lib">📚</button>
      </div>
      ${caHasImg ? `<img src="${esc(ca.src)}" class="builder-img-preview" data-role="ca-img-preview">` : ''}
      ${ca.type === 'local-image' ? `<span class="local-img-tag ca-lib-tag">📚 ${esc(ca.name)}</span>` : ''}
      <div class="img-pos-row${ca.type === 'mixed' ? '' : ' hidden'}" data-role="ca-pos-row">
        <span class="img-pos-label">Image:</span>
        <button class="img-pos-opt${caPos === 'before' ? ' active' : ''}" data-role="ca-pos-before">Above</button>
        <button class="img-pos-opt${caPos === 'inline' ? ' active' : ''}" data-role="ca-pos-inline">Inline</button>
        <button class="img-pos-opt${caPos === 'after' ? ' active' : ''}" data-role="ca-pos-after">Below</button>
      </div>

      <div class="wrong-answers-section">
        <div class="builder-field-label" style="margin-top:.6rem">Wrong Answers</div>
        ${wrongHtml}
        <button class="btn btn-ghost mt-1" data-role="add-wrong">+ Add Wrong Answer</button>
      </div>`;

    Views.builder.wireCard(card, row, idx);
    return card;
  },

  wireCard(card, row, idx) {
    const rows = State.bld.draft.rows;

    card.querySelector('[data-role="del-q"]').addEventListener('click', () => {
      Modal.confirm('Remove Question', 'Remove this question?', () => {
        rows.splice(idx, 1);
        Views.builder.renderQuestions();
      });
    });

    // ── helpers ───────────────────────────────────────────────
    const setImgPreview = (role, src, insertAfterEl) => {
      let p = card.querySelector(`[data-role="${role}"]`);
      if (p) { p.src = src; }
      else {
        p = Object.assign(document.createElement('img'), { src, className: 'builder-img-preview' });
        p.dataset.role = role;
        if (insertAfterEl) insertAfterEl.after(p);
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
        Views.builder.pickImage(uri => {
          const cur = getF(), t = textEl.value;
          setF(t ? { type:'mixed', text:t, src:uri, imgPosition:(cur&&cur.imgPosition)||'before' }
                 : { type:'image', src:uri });
          setImgPreview(`${prefix}-img-preview`, uri, fieldRow());
          const tag = card.querySelector(`.${prefix}-lib-tag`); if (tag) tag.remove();
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

    // ── wrong answers ─────────────────────────────────────────
    card.querySelectorAll('.wrong-text').forEach(ta => {
      ta.addEventListener('input', () => {
        const wi = parseInt(ta.closest('[data-wi]').dataset.wi, 10);
        const t = ta.value, cur = row.wrongAnswers[wi];
        const hasImg = cur && (cur.type === 'image' || cur.type === 'mixed') && cur.src;
        row.wrongAnswers[wi] = hasImg
          ? (t ? { type:'mixed', src:cur.src, fromLibrary:cur.fromLibrary, text:t, imgPosition:cur.imgPosition||'before' }
               : { type:'image', src:cur.src, fromLibrary:cur.fromLibrary })
          : { type:'text', text:t };
        updatePosRow(`wrong-pos-row-${wi}`, `wrong-pos-before-${wi}`, `wrong-pos-after-${wi}`, row.wrongAnswers[wi]);
      });
    });

    card.querySelectorAll('[data-role="wrong-img"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const wi = parseInt(btn.dataset.wi, 10);
        Views.builder.pickImage(uri => {
          const section = card.querySelector(`.wrong-answer-row[data-wi="${wi}"]`);
          const t = section.querySelector('.wrong-text').value, cur = row.wrongAnswers[wi];
          row.wrongAnswers[wi] = t ? { type:'mixed', text:t, src:uri, imgPosition:(cur&&cur.imgPosition)||'before' }
                                   : { type:'image', src:uri };
          setImgPreview(`wrong-img-preview-${wi}`, uri, btn);
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
    Modal.show({ title: '📚 Pick from Library', body: container, buttons: [{ label: 'Cancel' }] });
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
      onPick(uri);
    };
    input.click();
  },

  addQuestion() {
    State.bld.draft.rows.push({
      id: genId(),
      question:      { type: 'text', text: '' },
      correctAnswer: { type: 'text', text: '' },
      wrongAnswers:  [{ type: 'text', text: '' }]
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
    });

    // filter empty rows
    draft.rows = draft.rows.filter(r => {
      const q = r.question; const c = r.correctAnswer;
      const qOk = q.type === 'image' ? q.src : q.type === 'local-image' ? q.name : q.text;
      const cOk = c.type === 'image' ? c.src : c.type === 'local-image' ? c.name : c.text;
      return qOk && cOk;
    });

    await Storage.saveDataset(draft);
    Toast.show(`Deck "${draft.name}" saved (${draft.rows.length} questions)`, 'success');
    State.bld.editingId = null;
    document.getElementById('builder-editor').classList.add('hidden');
    Views.builder.renderDeckList();
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

  exportCSV() {
    const draft = State.bld.draft;
    if (!draft || !draft.rows.length) { Toast.show('Nothing to export', 'warning'); return; }
    const csv  = DataExport.datasetToCSV(draft);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: (draft.name || 'deck') + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
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
// VIEW: FLASHCARDS
// ============================================================
Views.flashcards = {
  onEnter() {
    document.getElementById('fc-selector').classList.remove('hidden');
    document.getElementById('fc-player').classList.add('hidden');
    renderDatasetPicker(document.getElementById('fc-deck-list'), meta => {
      Views.flashcards.start(meta.id);
    });
  },

  async start(datasetId) {
    const ds = await Storage.getDataset(datasetId);
    if (!ds) { Toast.show('Could not load dataset', 'error'); return; }

    State.fc.datasetId = datasetId;
    State.fc.questions = shuffle(await resolveLocalImages(ds.rows));
    State.fc.idx       = 0;
    State.fc.flipped   = false;

    document.getElementById('fc-selector').classList.add('hidden');
    document.getElementById('fc-player').classList.remove('hidden');
    Views.flashcards.showCard(0);

    // log flashcard session
    const session = {
      id: genId(), userId: State.currentUser ? State.currentUser.id : null,
      userName: State.currentUser ? State.currentUser.name : 'Anonymous',
      datasetId: ds.id, datasetName: ds.name, mode: 'flashcard',
      startedAt: new Date().toISOString(), endedAt: null,
      cardsViewed: 0, totalCards: ds.rows.length
    };
    State.fc.sessionRef = session;
  },

  showCard(idx) {
    const qs = State.fc.questions;
    if (!qs.length) return;

    State.fc.idx     = idx;
    State.fc.flipped = false;

    const card = document.getElementById('fc-card');
    card.classList.remove('flipped');

    const row = qs[idx];
    renderCell(row.question,      document.getElementById('fc-front-content'));
    renderCell(row.correctAnswer, document.getElementById('fc-back-content'));

    document.getElementById('fc-progress').textContent = `${idx + 1} / ${qs.length}`;

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
    document.getElementById('fc-selector').classList.remove('hidden');
    renderDatasetPicker(document.getElementById('fc-deck-list'), meta => {
      Views.flashcards.start(meta.id);
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
    renderDatasetPicker(document.getElementById('quiz-deck-list'), meta => {
      Views.quiz.start(meta.id, meta.name);
    });
  },

  async start(datasetId, datasetName) {
    const ds = await Storage.getDataset(datasetId);
    if (!ds) { Toast.show('Could not load dataset', 'error'); return; }
    if (!ds.rows.some(r => r.wrongAnswers.length > 0)) {
      Toast.show('This deck has no wrong answers – cannot run quiz mode', 'warning', 4000);
      return;
    }

    const resolvedRows = await resolveLocalImages(ds.rows);
    State.qz = {
      datasetId, datasetName: ds.name,
      questions: resolvedRows.filter(r => r.wrongAnswers.length > 0),
      pool: [], idx: 0,
      results: [], allAttempts: [],
      score: { correct: 0, total: 0 },
      round: 1, answered: false,
      showCorrect: document.getElementById('quiz-opt-show-correct')?.checked ?? true,
      sessionId: genId(), startedAt: new Date().toISOString()
    };

    State.qz.pool = shuffle(State.qz.questions);

    document.getElementById('quiz-selector').classList.add('hidden');
    document.getElementById('quiz-summary').classList.add('hidden');
    document.getElementById('quiz-player').classList.remove('hidden');

    Views.quiz.buildGrid();
    Views.quiz.showQuestion(0);
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

    document.getElementById('quiz-round-badge').textContent = `Round ${State.qz.round}`;
    document.getElementById('qscore-correct').textContent   = State.qz.score.correct;
    document.getElementById('qscore-total').textContent     = State.qz.score.total;
    document.getElementById('quiz-q-meta').textContent      = `Question ${idx + 1} of ${pool.length}`;

    const row = pool[idx];

    // render question
    const qContent = document.getElementById('quiz-q-content');
    qContent.innerHTML = '';
    renderCell(row.question, qContent);

    // hide feedback
    document.getElementById('quiz-feedback').classList.add('hidden');
    document.getElementById('feedback-correct-reveal').classList.add('hidden');

    // build answer choices (correct + up to 3 wrong, shuffled)
    const wrongs   = shuffle(row.wrongAnswers).slice(0, 3);
    const choices  = shuffle([
      { cell: row.correctAnswer, isCorrect: true },
      ...wrongs.map(w => ({ cell: w, isCorrect: false }))
    ]);

    const choicesEl = document.getElementById('quiz-choices');
    choicesEl.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D', 'E'];

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

    const idx = State.qz.idx;

    // style buttons
    document.querySelectorAll('.choice-btn').forEach(b => {
      b.disabled = true;
      if (State.qz.showCorrect && b.dataset.correct === '1') b.classList.add('correct');
      else if (b === btn && !isCorrect) b.classList.add('wrong');
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

    // update score display
    document.getElementById('qscore-correct').textContent = State.qz.score.correct;
    document.getElementById('qscore-total').textContent   = State.qz.score.total;

    // update grid
    Views.quiz.updateGridSquare(idx, isCorrect ? 'sq-correct' : 'sq-wrong');

    // record result
    const attempt = {
      qId: row.id,
      round: State.qz.round,
      correct: isCorrect,
      selectedText: cellLabel(choice.cell),
      questionLabel: cellLabel(row.question),
      correctLabel: cellLabel(row.correctAnswer)
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
    const roundNums = [...new Set(State.qz.allAttempts.map(a => a.round))].sort((a, b) => a - b);
    roundNums.forEach(rn => {
      const rAttempts = State.qz.allAttempts.filter(a => a.round === rn);
      const rC = rAttempts.filter(a => a.correct).length;
      const rT = rAttempts.length;
      const item = document.createElement('div');
      item.className = 'summary-breakdown-item';
      item.innerHTML = `<span>Round ${rn}</span><span>${rC} / ${rT} correct</span>`;
      bdEl.appendChild(item);
    });

    // retry button
    const retryBtn = document.getElementById('btn-retry-wrong');
    if (wrongIds.length > 0) {
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
      attempts:   State.qz.allAttempts
    };
    // overwrite any prior save for the same session
    const existing = Storage.getSessions().filter(s => s.id !== sess.id);
    existing.push(sess);
    Storage.lsSet('sessions', existing);
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

      div.innerHTML = `
        <div class="report-item-header">
          <span class="report-mode-badge ${isQuiz ? 'badge-quiz' : 'badge-flashcard'}">${isQuiz ? 'Quiz' : 'Flashcards'}</span>
          <span class="report-name">${esc(s.datasetName || 'Unknown')}</span>
          <span class="report-date">${fmtDateTime(s.startedAt)}</span>
          <span class="text-muted" style="font-size:.85rem">${esc(s.userName || 'Anonymous')}</span>
          ${scoreHtml}
          <span class="report-expand-arrow">›</span>
        </div>
        <div class="report-detail">${Views.reports.buildDetail(s)}</div>`;

      div.querySelector('.report-item-header').addEventListener('click', () => {
        div.classList.toggle('open');
      });

      list.appendChild(div);
    });
  },

  buildDetail(session) {
    if (session.mode === 'flashcard') {
      return `<p style="padding:.5rem 0">Viewed ${session.cardsViewed || 0} of ${session.totalCards || '?'} cards.</p>`;
    }
    if (!session.attempts || !session.attempts.length) return '<p>No attempt detail available.</p>';
    // header: rounds taken
    const roundCount = session.totalRounds || [...new Set(session.attempts.map(a => a.round))].length;

    const rounds = [...new Set(session.attempts.map(a => a.round))].sort((a, b) => a - b);
    let html = roundCount > 1 ? `<p class="text-small" style="margin:.3rem 0">${roundCount} rounds taken to complete</p>` : '';
    rounds.forEach(rn => {
      const rAttempts = session.attempts.filter(a => a.round === rn);
      html += `<div class="report-round-header">Round ${rn}</div>`;
      rAttempts.forEach(a => {
        html += `<div class="report-attempt-item">
          <span class="attempt-icon">${a.correct ? '✅' : '❌'}</span>
          <span class="attempt-q">${esc(a.questionLabel || '?')}</span>
          ${!a.correct ? `<span style="font-size:.8rem;color:var(--clr-text-muted)">→ ${esc(a.correctLabel || '')}</span>` : ''}
        </div>`;
      });
    });
    return html;
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
  document.getElementById('btn-new-deck').addEventListener('click',       () => Views.builder.newDeck());
  document.getElementById('btn-builder-add-q').addEventListener('click',  () => Views.builder.addQuestion());
  document.getElementById('btn-builder-save').addEventListener('click',   () => Views.builder.save());
  document.getElementById('btn-builder-save-copy').addEventListener('click', () => Views.builder.saveAsCopy());
  document.getElementById('btn-builder-export').addEventListener('click', () => Views.builder.exportCSV());
  document.getElementById('btn-builder-close').addEventListener('click',  () => Views.builder.closeEditor());

  // ── Flashcard view ──
  document.getElementById('fc-card').addEventListener('click', () => Views.flashcards.flip());
  document.getElementById('fc-card').addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); Views.flashcards.flip(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') Views.flashcards.next();
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   Views.flashcards.prev();
  });
  document.getElementById('btn-fc-next').addEventListener('click',    () => Views.flashcards.next());
  document.getElementById('btn-fc-prev').addEventListener('click',    () => Views.flashcards.prev());
  document.getElementById('btn-fc-restart').addEventListener('click', () => Views.flashcards.restart());
  document.getElementById('btn-fc-exit').addEventListener('click',    () => {
    Modal.confirm('Exit Flashcards', 'Return to deck selection?', () => Views.flashcards.exit());
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
    Modal.confirm('Exit Quiz', 'Quit this quiz? Progress will be lost.', () => Views.quiz.onEnter());
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

  // restore current user
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

document.addEventListener('DOMContentLoaded', init);
