var SIM_VERSION = '2.0.0';
// Penampil error: bila ada kesalahan JS, tampil di layar (bukan loading tanpa akhir)
function showBootError(e) {
  const o = document.getElementById('loadingOverlay');
  if (!o) return;
  o.style.display = 'flex'; o.style.opacity = '1'; o.style.pointerEvents = 'auto';
  o.innerHTML = '<div style="max-width:520px;padding:24px;text-align:center;font-family:sans-serif">' +
    '<h3 style="color:#EF4444">Aplikasi gagal dimuat</h3>' +
    '<p style="color:#475569;word-break:break-word">' + String((e && e.message) || e).replace(/</g, '&lt;') + '</p>' +
    '<button onclick="location.reload()" style="padding:10px 18px;border:0;border-radius:8px;background:#1E40AF;color:#fff;cursor:pointer">Muat ulang</button></div>';
}
window.addEventListener('error', ev => { if (!_booted) showBootError(ev.error || ev.message); });

/**
 * ============================================================
 * SIM GUDANG — Frontend (GitHub Pages)
 * SPA statis; data dari backend Google Apps Script lewat fetch() (lihat js/api.js).
 * Token sesi disimpan di memori dan sessionStorage tab ini (hilang saat tab ditutup).
 * ============================================================
 */

// ════════════════════════════════════════════════════════
// BAGIAN 1: STATE, KONSTANTA & UTILITAS
// ════════════════════════════════════════════════════════
const AppState = { token: null, user: null, config: {}, lookups: { supplier: [], karyawan: [], satuan: [], lokasi: [] }, page: null, cache: {}, lastDash: null };
const DISIPLIN = ['Mechanical', 'Sipil', 'Piping', 'Instrument', 'Electrical'];
const JENIS = ['Utama', 'Pembantu', 'Pelengkap'];
const DCOLOR = { Mechanical: '#3B82F6', Sipil: '#F59E0B', Piping: '#06B6D4', Instrument: '#8B5CF6', Electrical: '#10B981' };
const ROLE_LABEL = { admin: 'Admin (Kepala Gudang)', staff: 'Staff Gudang', petugas: 'Petugas Lapangan', pimpinan: 'Pimpinan' };
const ALL = ['admin', 'staff', 'petugas', 'pimpinan'];
const MENUS = [
  { id: 'dashboard', label: 'Dashboard', short: 'Beranda', icon: 'bi-grid', roles: ALL },
  { id: 'barang', label: 'Master Barang', short: 'Barang', icon: 'bi-box-seam', roles: ALL },
  { id: 'masuk', label: 'Barang Masuk', short: 'Masuk', icon: 'bi-box-arrow-in-down', roles: ['admin', 'staff'] },
  { id: 'permintaan', label: 'Permintaan & Approval', short: 'Approval', icon: 'bi-clipboard-check', roles: ALL, badge: true },
  { id: 'keluar', label: 'Barang Keluar', short: 'Keluar', icon: 'bi-box-arrow-up', roles: ['admin', 'staff'] },
  { id: 'lpb', label: 'Form LPB / Opname', short: 'LPB', icon: 'bi-journal-check', roles: ['admin', 'staff'] },
  { id: 'laporan', label: 'Laporan Berkala', short: 'Laporan', icon: 'bi-bar-chart-line', roles: ['admin', 'pimpinan'] },
  { id: 'master', label: 'Master Pendukung', short: 'Master', icon: 'bi-collection', roles: ['admin', 'staff'] },
  { id: 'pengaturan', label: 'Pengaturan', short: 'Atur', icon: 'bi-gear', roles: ['admin'] }
];
const PAGES = {};
function missingFiles() { return (window.__loadErrors || []).slice(); }
function scriptStatus() { return 'v' + SIM_VERSION + ' · GitHub Pages'; }

const $ = id => document.getElementById(id);
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('id-ID');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const skel = (n = 3) => Array(n).fill('<div class="skeleton mb-3" style="height:72px"></div>').join('');
const cssv = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const role = () => AppState.user ? AppState.user.role : '';
const canEdit = () => ['admin', 'staff'].includes(role());
const emptyBox = (icon, text) => `<div class="empty"><i class="bi ${icon}"></i>${esc(text)}</div>`;
const errBox = e => `<div class="alert-x bad"><i class="bi bi-exclamation-triangle"></i> ${esc(e.message || e)}</div>`;

const safeSS = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
};
const safeLS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
};

function discTag(d) {
  const c = DCOLOR[d] || '#64748B';
  return `<span class="dtag" style="background:${c}1A;color:${c}">${esc(d || '-')}</span>`;
}
function stokChip(s) { return `<span class="chip ${s === 'Habis' ? 'bad' : s === 'Menipis' ? 'warn' : 'ok'}">${esc(s)}</span>`; }
const ACCEPT_FILES = 'image/*,application/pdf';
const optList = (arr, sel, all) => (all ? `<option value="">${esc(all)}</option>` : '') + arr.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');
function reqChip(s) { return `<span class="chip ${s === 'Ditolak' ? 'bad' : s === 'Selesai' ? 'ok' : s === 'Disetujui' ? 'info' : 'warn'}">${esc(s)}</span>`; }

/** Cache pembacaan: halaman yang baru dibuka tampil instan; setiap penulisan mengosongkan cache */
const API_CACHE = new Map();
let CACHE_VER = 0;
const CACHE_TTL = 45000; // 45 detik
const READ_FNS = new Set(['getDashboard', 'listBarang', 'listMasuk', 'listKeluar', 'listPermintaan', 'listLPB', 'getLaporan', 'listMaster', 'getConfig', 'listUsers', 'getLookups']);
const NO_CLEAR = new Set(['searchBarang', 'getFileData', 'doLogout', 'healthCheck', 'findBarang', 'getBuktiData']);
function clearApiCache() { API_CACHE.clear(); CACHE_VER++; }
function netBar(d) { AppState.net = Math.max(0, (AppState.net || 0) + d); const b = $('netBar'); if (b) b.classList.toggle('on', AppState.net > 0); }

function _call(fn, args, quiet) {
  const isRead = READ_FNS.has(fn);
  const key = isRead ? fn + '|' + JSON.stringify(args) : null;
  if (isRead) {
    const hit = API_CACHE.get(key);
    if (hit) {
      if (hit.p) return hit.p;                                   // permintaan yang sama sedang berjalan
      if (Date.now() - hit.t < CACHE_TTL) return Promise.resolve(hit.data);
    }
  }
  const ver = CACHE_VER;
  if (!quiet) netBar(1);
  const p = gasPost(fn, AppState.token, args).then(r => {
    if (r && r.expired) { forceLogout('Sesi berakhir, silakan masuk kembali.'); throw new Error('Sesi berakhir.'); }
    if (!r || r.success === false) throw new Error((r && r.message) || 'Terjadi kesalahan.');
    return r.data;
  }).then(data => {
    if (isRead) { if (ver === CACHE_VER) API_CACHE.set(key, { t: Date.now(), data: data }); else API_CACHE.delete(key); }
    else if (!NO_CLEAR.has(fn)) clearApiCache();
    return data;
  }, err => { if (isRead) API_CACHE.delete(key); throw err; });
  if (isRead) API_CACHE.set(key, { p: p });
  p.then(() => { if (!quiet) netBar(-1); }, () => { if (!quiet) netBar(-1); });
  return p;
}
const api = (fn, ...args) => _call(fn, args, false);

/** Muat data halaman lain di latar belakang (1 jalur, ringan) agar klik pertama lebih cepat */
function prefetchPages() {
  if (AppState.prefetched) return; AppState.prefetched = true;
  setTimeout(async () => {
    const jobs = [];
    try {
      const r = role();
      jobs.push(['listBarang', BF], ['listPermintaan', { status: PQ }]);
      if (canEdit()) jobs.push(['listMasuk', MF], ['listKeluar', KF], ['listPermintaan', { status: 'Disetujui' }], ['listLPB'], ['listMaster', MT]);
      if (r === 'admin' || r === 'pimpinan') jobs.push(['getLaporan', LR]);
      if (r === 'admin') jobs.push(['getConfig'], ['listUsers']);
    } catch (e) { return; }
    while (jobs.length && AppState.token) {
      const j = jobs.shift();
      try { await _call(j[0], j.slice(1), true); } catch (e) { /* abaikan */ }
    }
  }, 1500);
}

function refreshPage() { clearApiCache(); if (AppState.page) navigateTo(AppState.page); }

function toast(title, msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'toast-x ' + type; t.setAttribute('role', 'status');
  t.innerHTML = `<b>${esc(title)}</b>${esc(msg)}`;
  $('toastWrap').appendChild(t);
  setTimeout(() => t.remove(), 4500);
}

let _modal = null;
function openModal({ title, body, footer, size }) {
  $('appModalTitle').textContent = title;
  $('appModalBody').innerHTML = body;
  $('appModalFooter').innerHTML = footer || '';
  $('appModalDialog').className = 'modal-dialog modal-dialog-scrollable' + (size === 'lg' ? ' modal-lg' : '');
  if (typeof bootstrap === 'undefined') { alert('Pustaka tampilan (Bootstrap) belum termuat. Periksa koneksi internet lalu muat ulang.'); return; }
  if (!_modal) _modal = new bootstrap.Modal($('appModal'));
  _modal.show();
}
function closeModal() { if (_modal) _modal.hide(); }

/** Tampilkan spinner pada tombol selama proses async */
async function withBtn(btn, fn) {
  const old = btn.innerHTML; btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span> Memproses...';
  try { return await fn(); } catch (e) { toast('Gagal', e.message, 'danger'); } finally { btn.disabled = false; btn.innerHTML = old; }
}

function confirmBox(title, msg, okLabel, onOk, danger) {
  openModal({
    title, body: `<p class="mb-0">${esc(msg)}</p>`,
    footer: `<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Batal</button><button type="button" class="btn-x ${danger ? 'btn-danger-x' : 'btn-primary-x'}" id="cfOk">${esc(okLabel)}</button>`
  });
  $('cfOk').onclick = e => withBtn(e.currentTarget, onOk);
}

function pagerHTML(r, fnName) {
  return `<div class="pager"><span>${fmt(r.total)} data · Halaman ${r.page}/${r.pages}</span><span class="d-flex gap-2">
    <button class="btn-x btn-ghost btn-sm-x" ${r.page <= 1 ? 'disabled' : ''} onclick="${fnName}(${r.page - 1})"><i class="bi bi-chevron-left"></i> Sebelumnya</button>
    <button class="btn-x btn-ghost btn-sm-x" ${r.page >= r.pages ? 'disabled' : ''} onclick="${fnName}(${r.page + 1})">Berikutnya <i class="bi bi-chevron-right"></i></button></span></div>`;
}

let _deb;
function debounce(fn, ms = 350) { clearTimeout(_deb); _deb = setTimeout(fn, ms); }

// ════════════════════════════════════════════════════════
// BAGIAN 2: BERKAS (KOMPRES FOTO, UNGGAH, PRATINJAU)
// ════════════════════════════════════════════════════════
function readPayload(file) {
  return new Promise((res, rej) => {
    if (!file) return res(null);
    const isImg = file.type.startsWith('image/');
    if (!isImg && file.type !== 'application/pdf') return rej(new Error('Berkas harus berupa foto atau PDF.'));
    if (!isImg) {
      if (file.size > 8 * 1024 * 1024) return rej(new Error('PDF maksimal 8 MB.'));
      const fr = new FileReader();
      fr.onload = () => res({ name: file.name, type: file.type, data: fr.result.split(',')[1] });
      fr.onerror = () => rej(new Error('Gagal membaca berkas.'));
      return fr.readAsDataURL(file);
    }
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 1600 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      res({ name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', data: cv.toDataURL('image/jpeg', 0.8).split(',')[1] });
    };
    img.onerror = () => rej(new Error('Foto tidak dapat dibaca.'));
    img.src = url;
  });
}

async function previewFile(fileId, label) {
  if (!fileId) return toast('Info', 'Berkas tidak tersedia.', 'warning');
  try {
    toast('Memuat', 'Mengambil berkas...');
    const f = await api('getFileData', fileId);
    const bytes = Uint8Array.from(atob(f.data), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: f.mime }));
    $('previewTitle').textContent = label || f.name;
    $('previewBody').innerHTML = f.mime.startsWith('image/')
      ? `<img src="${url}" class="img-fluid rounded" alt="${esc(label || f.name)}">`
      : `<iframe src="${url}" title="${esc(label || f.name)}" style="width:100%;height:70vh;border:0"></iframe>`;
    const dl = $('previewDownload'); dl.href = url; dl.download = f.name;
    bootstrap.Modal.getOrCreateInstance($('previewModal')).show();
  } catch (e) { toast('Gagal', e.message, 'danger'); }
}
const fileBtn = (id, label) => id ? `<button type="button" class="link-btn" onclick="previewFile('${esc(id)}','${esc(label)}')"><i class="bi bi-paperclip"></i> ${esc(label)}</button>` : '';

// ════════════════════════════════════════════════════════
// BAGIAN 3: PEMILIH BARANG (AUTOCOMPLETE SERVER-SIDE)
// ════════════════════════════════════════════════════════
const pickerHTML = id => `<div class="bp" id="${id}"><div class="bp-sel"></div>
  <input class="form-control bp-input" placeholder="Cari kode / nama barang (min. 2 huruf)" autocomplete="off" aria-label="Cari barang">
  <div class="bp-list" role="listbox"></div></div>`;

function initPicker(id, onPick) {
  const root = $(id), inp = root.querySelector('.bp-input'), list = root.querySelector('.bp-list'), sel = root.querySelector('.bp-sel');
  let t;
  inp.addEventListener('input', () => {
    clearTimeout(t);
    const q = inp.value.trim();
    if (q.length < 2) return list.classList.remove('show');
    t = setTimeout(async () => {
      try {
        const rows = await api('searchBarang', q);
        list._rows = rows;
        list.innerHTML = rows.length
          ? rows.map((b, i) => `<button type="button" data-i="${i}"><b class="mono">${esc(b.Kode)}</b> ${esc(b.Nama)}<small>${esc(b.Disiplin)} · ${esc(b.JenisMaterial)} · stok ${fmt(b.Stok)} ${esc(b.Satuan)}</small></button>`).join('')
          : '<div class="p-3 text-3">Barang tidak ditemukan</div>';
        list.classList.add('show');
      } catch (e) { toast('Gagal', e.message, 'danger'); }
    }, 300);
  });
  list.addEventListener('click', e => {
    const b = e.target.closest('button[data-i]'); if (!b) return;
    const row = list._rows[b.dataset.i];
    inp.value = ''; inp.style.display = 'none'; list.classList.remove('show');
    sel.innerHTML = `<div class="picked"><span><span class="mono">${esc(row.Kode)}</span> ${esc(row.Nama)}<br><small>${esc(row.Disiplin)} · stok ${fmt(row.Stok)} ${esc(row.Satuan)}</small></span><button type="button" class="link-btn" data-clear>Ganti</button></div>`;
    onPick(row);
  });
  sel.addEventListener('click', e => {
    if (!e.target.closest('[data-clear]')) return;
    sel.innerHTML = ''; inp.style.display = ''; inp.focus(); onPick(null);
  });
}

// ════════════════════════════════════════════════════════
// BAGIAN 4: AUTENTIKASI, NAVIGASI SPA & TEMA
// ════════════════════════════════════════════════════════
var _booted = false;
function hideBootOverlay() {
  const o = $('loadingOverlay');
  if (o) { o.style.opacity = '0'; o.style.pointerEvents = 'none'; setTimeout(() => { o.style.display = 'none'; }, 300); }
}
async function bootApp() {
  if (_booted) return; _booted = true;
  try {
    applyTheme(safeLS.get('sim_theme') || 'light');
    const tok = safeSS.get('sim_token');
    if (tok && isConfigured()) {
      try {
        const r = await gasPost('whoami', tok, []);
        if (r && r.success) {
          startSession(Object.assign({ token: tok }, r.data), safeSS.get('sim_page'));
          hideBootOverlay(); return;
        }
      } catch (e) { /* tak bisa memulihkan: lanjut ke layar login */ }
      safeSS.del('sim_token'); safeSS.del('sim_page');
    }
    renderLogin();
  } catch (e) {
    showBootError(e);
  }
  hideBootOverlay();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootApp);
else bootApp();
window.addEventListener('load', bootApp);

function renderLogin() {
  document.body.classList.add('logged-out');
  const ok = isConfigured(), miss = missingFiles();
  $('app-container').innerHTML = `
  <div class="login-wrap"><div class="login-card">
    <div class="logo" id="lgLogo"><i class="bi bi-box-seam"></i></div>
    <h2 class="text-center h4 mb-1" id="lgTitle">${esc(AppState.config.appName || 'SIM Gudang')}</h2>
    <p class="text-center text-3 mb-4" id="lgSub">Sistem Informasi Manajemen Gudang</p>
    ${!ok ? '<div class="alert-x bad mb-3" id="lgCfg"><b>Alamat backend belum diisi.</b> Buka berkas <code>js/config.js</code>, tempel URL Apps Script (berakhiran <code>/exec</code>), lalu simpan dan push ke GitHub.</div>' : ''}
    ${miss.length ? '<div class="alert-x bad mb-3" id="lgMiss"><b>Berkas gagal dimuat:</b> ' + esc(miss.join(', ')) + '. Pastikan semua berkas ada di repository (huruf besar/kecil nama berkas harus sama), lalu muat ulang dengan Ctrl+Shift+R.</div>' : ''}
    <form onsubmit="handleLogin(event)" autocomplete="on">
      <div class="fld mb-3"><label for="lgUser">Username</label><input id="lgUser" class="form-control" autocomplete="username" required autofocus></div>
      <div class="fld mb-3"><label for="lgPass">Password / PIN</label>
        <div class="input-group"><input id="lgPass" type="password" class="form-control" autocomplete="current-password" required>
        <button type="button" class="btn-x btn-ghost" style="border-radius:0 8px 8px 0" onclick="togglePass()" aria-label="Tampilkan password"><i class="bi bi-eye" id="eyeIc"></i></button></div></div>
      <button type="submit" class="btn-x btn-primary-x w-100" id="lgBtn" ${ok ? '' : 'disabled'}><i class="bi bi-box-arrow-in-right"></i> Masuk</button>
    </form>
    <p class="text-center mt-3 mb-0" style="font-size:12px" id="lgStatus" aria-live="polite">${ok ? '<span class="text-3">Menghubungi server...</span>' : ''}</p>
    <p class="text-center text-3 mt-1 mb-0" style="font-size:11px">${esc(scriptStatus())}</p>
  </div></div>`;
  if (ok) checkServer();
}
/** Cek server & ambil nama/logo perusahaan untuk layar login */
async function checkServer() {
  const st = () => $('lgStatus');
  try {
    const p = await gasGet('ping');
    if (!p || p.success === false) throw new Error((p && p.message) || 'Server membalas error.');
    if (st()) st().innerHTML = '<span style="color:var(--success)"><i class="bi bi-check-circle"></i> Server terhubung · v' + esc((p.data || {}).versi || '?') + '</span>';
    gasGet('publicConfig').then(r => {
      if (!r || !r.success || !$('lgTitle')) return;
      AppState.config = Object.assign({}, AppState.config, r.data);
      $('lgTitle').textContent = r.data.appName || 'SIM Gudang';
      if (r.data.perusahaan) $('lgSub').textContent = r.data.perusahaan;
      if (r.data.logoUrl) $('lgLogo').innerHTML = '<img src="' + esc(r.data.logoUrl) + '" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:12px">';
    }).catch(() => {});
  } catch (e) {
    if (st()) st().innerHTML = '<span style="color:var(--critical)"><i class="bi bi-x-circle"></i> ' + esc(e.message) + '</span>';
  }
}
function togglePass() {
  const i = $('lgPass'); i.type = i.type === 'password' ? 'text' : 'password';
  $('eyeIc').className = i.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
}

/** Mulai sesi (setelah login atau pemulihan sesi). */
function startSession(d, page) {
  clearApiCache(); AppState.prefetched = false;
  AppState.token = d.token; AppState.user = d.user; AppState.config = d.config || {}; AppState.cache = {};
  safeSS.set('sim_token', d.token);
  document.body.classList.remove('logged-out');
  applyConfig(); renderNav(); loadLookups();
  const ok = allowedMenus().some(m => m.id === page);
  navigateTo(ok ? page : 'dashboard');
}

function handleLogin(ev) {
  ev.preventDefault();
  const btn = $('lgBtn'), old = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner-inline"></span> Memproses...';
  gasPost('doLogin', '', [$('lgUser').value, $('lgPass').value]).then(r => {
    btn.disabled = false; btn.innerHTML = old;
    if (!r || !r.success) return toast('Gagal masuk', (r && r.message) || 'Terjadi kesalahan.', 'danger');
    startSession(r.data, 'dashboard');
    toast('Selamat datang', 'Halo, ' + AppState.user.nama + '!', 'success');
  }).catch(e => { btn.disabled = false; btn.innerHTML = old; toast('Error', e.message, 'danger'); });
}

function handleLogout() {
  gasPost('doLogout', AppState.token, []).catch(() => {});
  forceLogout();
}
function forceLogout(msg) {
  safeSS.del('sim_token'); safeSS.del('sim_page');
  clearApiCache(); AppState.token = null; AppState.user = null; AppState.page = null; AppState.cache = {};
  closeSidebar(); renderLogin();
  if (msg) toast('Info', msg, 'warning');
}

function applyConfig() {
  const c = AppState.config;
  $('appTitle').textContent = c.appName || 'SIM Gudang';
  $('appSub').textContent = c.perusahaan || '';
  document.title = c.appName || 'SIM Gudang';
  $('sbLogo').innerHTML = c.logoUrl ? `<img src="${esc(c.logoUrl)}" alt="Logo">` : '<i class="bi bi-box-seam"></i>';
  $('sbUserName').textContent = AppState.user.nama;
  const vt = $('verTag'); if (vt) vt.textContent = scriptStatus();
  $('sbUserRole').textContent = ROLE_LABEL[AppState.user.role] + (AppState.user.disiplin ? ' · ' + AppState.user.disiplin : '');
}

function allowedMenus() { return MENUS.filter(m => m.roles.includes(role())); }

function renderNav() {
  const ms = allowedMenus();
  $('sidebar-nav').innerHTML = ms.map(m => `<li><a href="javascript:void(0)" data-page="${m.id}" onclick="navigateTo('${m.id}')"><i class="bi ${m.icon}"></i><span>${esc(m.label)}</span>${m.badge ? '<span class="nav-badge" data-badge style="display:none">0</span>' : ''}</a></li>`).join('') +
    `<li><a href="javascript:void(0)" onclick="openPassModal()"><i class="bi bi-key"></i><span>Ganti Password</span></a></li>`;
  const bn = ms.slice(0, 4);
  $('bottomNav').innerHTML = bn.map(m => `<button type="button" data-page="${m.id}" onclick="navigateTo('${m.id}')"><i class="bi ${m.icon}"></i>${esc(m.short)}${m.badge ? '<span class="nav-badge" data-badge style="display:none">0</span>' : ''}</button>`).join('') +
    `<button type="button" onclick="toggleSidebar()"><i class="bi bi-list"></i>Menu</button>`;
}

function setBadge(n) {
  document.querySelectorAll('[data-badge]').forEach(b => { b.textContent = n; b.style.display = n > 0 ? '' : 'none'; });
}

function navigateTo(page) {
  if (!AppState.token) return renderLogin();
  const m = MENUS.find(x => x.id === page);
  if (!m || !m.roles.includes(role())) return toast('Akses ditolak', 'Anda tidak memiliki akses ke halaman ini.', 'danger');
  AppState.page = page;
  document.querySelectorAll('[data-page]').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  $('pageTitle').textContent = m.label;
  closeSidebar();
  $('app-container').innerHTML = skel(4);
  window.scrollTo(0, 0);
  const myNav = (AppState.navId = (AppState.navId || 0) + 1);
  // Pengaman: bila tidak selesai dalam 25 detik, tampilkan pesan + tombol coba lagi
  const timer = setTimeout(() => {
    if (AppState.navId === myNav && document.querySelector('#app-container .skeleton')) {
      $('app-container').innerHTML = `<div class="alert-x warn">Server belum membalas. Periksa koneksi internet.<br><button class="btn-x btn-primary-x mt-2" onclick="refreshPage()"><i class="bi bi-arrow-clockwise"></i> Coba lagi</button></div>`;
    }
  }, 25000);
  safeSS.set('sim_page', page);
  Promise.resolve().then(() => {
    if (typeof PAGES[page] !== 'function') throw new Error('Halaman "' + page + '" belum termuat. Pastikan berkas js/pages-1.js dan js/pages-2.js ada di repository, lalu muat ulang (Ctrl+Shift+R).');
    return PAGES[page]();
  }).then(
    () => clearTimeout(timer),
    e => { clearTimeout(timer); if (AppState.navId === myNav) $('app-container').innerHTML = errBox(e); }
  );
}

function toggleSidebar() { $('sidebar').classList.toggle('show'); $('sbOverlay').classList.toggle('show'); }
function closeSidebar() { $('sidebar').classList.remove('show'); $('sbOverlay').classList.remove('show'); }

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  safeLS.set('sim_theme', t);
  const l = $('themeLabel'); if (l) l.textContent = t === 'dark' ? 'Mode Terang' : 'Mode Gelap';
}
function toggleDarkMode() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  if (AppState.page === 'dashboard' && AppState.lastDash) drawCharts(AppState.lastDash);
}

async function loadLookups() {
  try { AppState.lookups = await api('getLookups'); } catch (e) { /* diabaikan; form memakai input bebas */ }
}

function openPassModal() {
  closeSidebar();
  openModal({
    title: 'Ganti Password / PIN',
    body: `<div class="fld mb-3"><label for="pwOld">Password lama</label><input id="pwOld" type="password" class="form-control" autocomplete="current-password"></div>
      <div class="fld mb-3"><label for="pwNew">Password / PIN baru (min. 6 karakter)</label><input id="pwNew" type="password" class="form-control" autocomplete="new-password"></div>
      <div class="fld"><label for="pwNew2">Ulangi password baru</label><input id="pwNew2" type="password" class="form-control" autocomplete="new-password"></div>`,
    footer: `<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Batal</button><button type="button" class="btn-x btn-primary-x" id="pwOk">Simpan</button>`
  });
  $('pwOk').onclick = e => withBtn(e.currentTarget, async () => {
    if ($('pwNew').value.length < 6) throw new Error('Password baru minimal 6 karakter.');
    if ($('pwNew').value !== $('pwNew2').value) throw new Error('Konfirmasi password tidak sama.');
    await api('changePassword', $('pwOld').value, $('pwNew').value);
    closeModal(); toast('Berhasil', 'Password diperbarui.', 'success');
  });
}

// ════════════════════════════════════════════════════════
// BAGIAN 5: DASHBOARD
// ════════════════════════════════════════════════════════
let charts = {};
PAGES.dashboard = async function () {
  const d = await api('getDashboard');
  AppState.lastDash = d; setBadge(d.pending);
  const u = AppState.user;
  const quick = [];
  if (canEdit()) quick.push(`<button class="btn-x btn-primary-x" onclick="navigateTo('masuk')"><i class="bi bi-plus-circle"></i> Barang Masuk</button>`);
  quick.push(`<button class="btn-x btn-ghost" onclick="navigateTo('permintaan')"><i class="bi bi-clipboard-plus"></i> Ajukan Permintaan</button>`);
  const maxSku = Math.max(1, ...DISIPLIN.map(x => d.perDisiplin[x].sku));
  $('app-container').innerHTML = `
  <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-3">
    <div><h2 class="h4 mb-0">Halo, ${esc(u.nama)}</h2><div class="text-3">Ringkasan stok dan aktivitas gudang · ${esc(today())}</div></div>
    <div class="d-flex gap-2 flex-wrap">${quick.join('')}</div>
  </div>
  <div class="row g-3 mb-3">
    <div class="col-6 col-lg-3"><div class="card-x kpi"><div class="kpi-top">Total Item (SKU)<span class="ico tint-blue"><i class="bi bi-box-seam"></i></span></div><div class="metric">${fmt(d.totalSKU)}</div><div class="sub">5 disiplin proyek</div></div></div>
    <div class="col-6 col-lg-3"><div class="card-x kpi"><div class="kpi-top">Mutasi Bulan Ini<span class="ico tint-green"><i class="bi bi-arrow-left-right"></i></span></div><div class="metric">${fmt(d.mutasiBulanIni)}</div><div class="sub">transaksi masuk + keluar</div></div></div>
    <div class="col-6 col-lg-3"><div class="card-x kpi"><div class="kpi-top">Hari Ini<span class="ico tint-cyan"><i class="bi bi-calendar-check"></i></span></div><div class="metric">${fmt(d.masukHariIni)} / ${fmt(d.keluarHariIni)}</div><div class="sub">masuk / keluar</div></div></div>
    <div class="col-6 col-lg-3"><div class="card-x kpi crit"><div class="kpi-top">Stok Kritis / Habis<span class="ico tint-red"><i class="bi bi-exclamation-triangle"></i></span></div><div class="metric">${fmt(d.totalKritis)}</div><div class="sub">di bawah batas minimum</div></div></div>
  </div>
  <div class="row g-3 mb-3">
    <div class="col-lg-4"><div class="card-x h-100"><div class="card-h"><h3>Persetujuan</h3></div><div class="card-b">
      <div class="d-flex align-items-center gap-3 mb-3"><span class="ico tint-amber" style="width:44px;height:44px;border-radius:10px;display:grid;place-items:center;font-size:22px"><i class="bi bi-hourglass-split"></i></span>
        <div><div class="metric display" style="font-size:28px;font-weight:800">${fmt(d.pending)}</div><div class="text-3">menunggu keputusan Anda</div></div></div>
      ${canEdit() ? `<div class="alert-x ${d.siapKeluar ? 'warn' : 'ok'} mb-3">${fmt(d.siapKeluar)} permintaan disetujui, siap dikeluarkan.</div>` : ''}
      <button class="btn-x btn-ghost w-100" onclick="navigateTo('permintaan')">Buka Permintaan & Approval</button></div></div></div>
    <div class="col-md-6 col-lg-4"><div class="card-x h-100"><div class="card-h"><h3>Proporsi Jenis Material</h3></div><div class="card-b"><div style="height:200px"><canvas id="chJenis" aria-label="Proporsi jenis material" role="img"></canvas></div></div></div></div>
    <div class="col-md-6 col-lg-4"><div class="card-x h-100"><div class="card-h"><h3>Item per Disiplin</h3></div><div class="card-b">
      ${DISIPLIN.map(x => { const p = d.perDisiplin[x]; return `<div class="bar-row"><div class="bar-top"><span>${esc(x)}</span><span class="num">${fmt(p.sku)} item${p.kritis ? ` · <span style="color:var(--critical)">${p.kritis} kritis</span>` : ''}</span></div><div class="bar"><span style="width:${Math.round(p.sku / maxSku * 100)}%;background:${DCOLOR[x]}"></span></div></div>`; }).join('')}
    </div></div></div>
  </div>
  <div class="card-x mb-3"><div class="card-h"><h3>Tren Transaksi 6 Bulan (jumlah transaksi)</h3></div><div class="card-b"><div style="height:260px"><canvas id="chTren" aria-label="Tren barang masuk dan keluar" role="img"></canvas></div></div></div>
  <div class="card-x"><div class="card-h"><h3>Peringatan Stok Kritis</h3><button class="link-btn" onclick="navigateTo('barang')">Lihat semua barang</button></div><div class="card-b">
    ${d.kritis.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Nama Material</th><th class="hide-sm">Disiplin</th><th class="r">Sisa</th><th class="r hide-sm">Min</th><th>Status</th></tr></thead><tbody>
    ${d.kritis.map(k => `<tr><td class="mono">${esc(k.Kode)}</td><td>${esc(k.Nama)}</td><td class="hide-sm">${discTag(k.Disiplin)}</td><td class="r num" style="color:${k.Status === 'Habis' ? 'var(--critical)' : 'var(--warning)'};font-weight:700">${fmt(k.Stok)} ${esc(k.Satuan)}</td><td class="r num hide-sm">${fmt(k.StokMin)}</td><td>${stokChip(k.Status)}</td></tr>`).join('')}</tbody></table></div>` : emptyBox('bi-check-circle', 'Semua stok di atas batas minimum.')}
  </div></div>`;
  drawCharts(d);
  prefetchPages();
};

function drawCharts(d, tries) {
  if (typeof Chart === 'undefined') { if ((tries || 0) < 40) setTimeout(() => drawCharts(d, (tries || 0) + 1), 250); return; }
  Object.values(charts).forEach(c => c.destroy()); charts = {};
  const tx = cssv('--text-2'), grid = cssv('--border');
  const j = $('chJenis');
  if (j) charts.j = new Chart(j, {
    type: 'doughnut',
    data: { labels: JENIS, datasets: [{ data: JENIS.map(k => d.perJenis[k] || 0), backgroundColor: ['#1E40AF', '#5BB8FE', '#94A3B8'], borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { color: tx, boxWidth: 12 } } } }
  });
  const t = $('chTren');
  if (t) charts.t = new Chart(t, {
    type: 'line',
    data: { labels: d.tren.labels, datasets: [
      { label: 'Barang Masuk', data: d.tren.masuk, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,.12)', fill: true, tension: .35 },
      { label: 'Barang Keluar', data: d.tren.keluar, borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,.10)', fill: true, tension: .35, borderDash: [6, 4] }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { ticks: { color: tx }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: tx, precision: 0 }, grid: { color: grid } } }, plugins: { legend: { labels: { color: tx } } } }
  });
}
