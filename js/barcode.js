(function () {
  // Modul tambahan: barcode (scan masuk/keluar, label) + perbaikan cetak bukti pengeluaran.
  // Memperluas modul lama dengan membungkus fungsinya, tanpa mengubah perilaku aslinya.
  if (typeof PAGES.masuk !== 'function' || typeof PAGES.keluar !== 'function') throw new Error('js/pages-1.js harus dimuat sebelum js/barcode.js.');

  const PAT = '212222,222122,222221,121223,121322,131222,122213,122312,132212,221213,221312,231212,112232,122132,122231,113222,123122,123221,223211,221132,221231,213212,223112,312131,311222,321122,321221,312212,322112,322211,212123,212321,232121,111323,131123,131321,112313,132113,132311,211313,231113,231311,112133,112331,132131,113123,113321,133121,313121,211331,231131,213113,213311,213131,311123,311321,331121,312113,312311,332111,314111,221411,431111,111224,111422,121124,121421,141122,141221,112214,112412,122114,122411,142112,142211,241211,221114,413111,241112,134111,111242,121142,121241,114212,124112,124211,411212,421112,421211,212141,214121,412121,111143,111341,131141,114113,114311,411113,411311,113141,114131,311141,411131,211412,211214,211232,2331112'.split(',');
  const ZX_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';

  const css = '.bc-video{width:100%;max-height:260px;border-radius:8px;background:#000;object-fit:cover}' +
    '.bc-flash{animation:bcflash .7s ease}@keyframes bcflash{0%{background:rgba(16,185,129,.35)}100%{background:transparent}}' +
    '.bc-labels{display:flex;flex-wrap:wrap;align-items:flex-start}' +
    '.bc-label{display:inline-flex;flex-direction:column;justify-content:center;align-items:center;border:1px dashed #94a3b8;padding:1.5mm;margin:1mm;box-sizing:border-box;background:#fff;color:#000;overflow:hidden;page-break-inside:avoid}' +
    '.bc-label svg{width:100%;height:55%}.bc-lk{font:700 3.2mm monospace;line-height:1.1}.bc-ln{font:2.6mm Arial,sans-serif;line-height:1.1;max-height:2.3em;overflow:hidden;text-align:center}' +
    '#bcModal{z-index:1070}#printRoot{display:none}' +
    '@media print{body.printing>*:not(#printRoot){display:none !important}body.printing #printRoot{display:block !important}body.printing{background:#fff !important}.bc-roll .bc-label{page-break-after:always;border:0;margin:0}}';
  const st = document.createElement('style'); st.id = 'bcStyle'; st.textContent = css; document.head.appendChild(st);

  // ───────── Code 128 (subset B) ─────────
  function encode128B(text) {
    const vals = [104]; let sum = 104; const s = String(text);
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i); if (c < 32 || c > 126) c = 63;
      const v = c - 32; vals.push(v); sum += v * (i + 1);
    }
    vals.push(sum % 103); vals.push(106);
    return vals;
  }
  function widthsOf(vals) { const w = []; vals.forEach(v => PAT[v].split('').forEach(d => w.push(Number(d)))); return w; }
  function svg128(text, o) {
    o = o || {};
    const w = widthsOf(encode128B(text)), quiet = 10, h = o.height || 50;
    const total = w.reduce((a, b) => a + b, 0) + quiet * 2;
    let x = quiet, bars = '';
    w.forEach((n, i) => { if (i % 2 === 0) bars += '<rect x="' + x + '" y="0" width="' + n + '" height="' + h + '"/>'; x += n; });
    return '<svg class="bc-svg" viewBox="0 0 ' + total + ' ' + h + '" width="' + (o.width || '100%') + '" height="' + h + '" preserveAspectRatio="none" shape-rendering="crispEdges" fill="#000" role="img" aria-label="Barcode ' + esc(text) + '">' + bars + '</svg>';
  }
  const norm = c => String(c || '').replace(/[\r\n\t]+/g, '').trim().toUpperCase();
  window.SIMBarcode = { encode128B: encode128B, svg128: svg128, norm: norm };

  // ───────── Bunyi, pencarian, antrean ─────────
  function beep(ok) {
    try {
      const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
      const ctx = beep.ctx || (beep.ctx = new A()), o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = ok ? 880 : 220; g.gain.value = 0.08; o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + (ok ? 0.08 : 0.25));
    } catch (e) { /* abaikan */ }
  }
  const BCACHE = new Map();
  async function lookup(code) {
    const k = norm(code), hit = BCACHE.get(k);
    if (hit && Date.now() - hit.t < 300000) return hit.b;
    const b = await api('findBarang', code);
    BCACHE.set(k, { t: Date.now(), b: b }); return b;
  }
  let chain = Promise.resolve();
  const enqueue = fn => { chain = chain.then(fn, fn); return chain; };
  const flash = el => { if (!el) return; el.classList.remove('bc-flash'); void el.offsetWidth; el.classList.add('bc-flash'); };
  function say(p, html, kind) {
    const m = $(p + 'Msg'); if (!m) return;
    m.style.color = kind === 'ok' ? 'var(--success)' : kind === 'bad' ? 'var(--critical)' : 'var(--text-2)';
    m.innerHTML = html;
  }

  // ───────── Kamera (BarcodeDetector, cadangan ZXing) ─────────
  const cam = { active: false, stream: null, timer: null };
  function stopCamera() {
    if (cam.timer) clearInterval(cam.timer);
    if (cam.stream) cam.stream.getTracks().forEach(t => t.stop());
    cam.active = false; cam.stream = null; cam.timer = null;
    document.querySelectorAll('video.bc-video').forEach(v => { try { v.srcObject = null; } catch (e) {} });
    document.querySelectorAll('[data-bc-cam]').forEach(b => { b.innerHTML = '<i class="bi bi-camera"></i> Kamera'; });
  }
  function loadScript(url) {
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = () => rej(new Error('Pustaka pemindai kamera tidak dapat dimuat. Gunakan scanner USB/Bluetooth atau ketik kode.'));
      document.head.appendChild(s);
    });
  }
  async function zxingDetector() {
    if (!window.ZXing) await loadScript(ZX_URL);
    const Z = window.ZXing; if (!Z) throw new Error('Pemindai kamera tidak tersedia di browser ini. Gunakan scanner USB/Bluetooth atau ketik kode.');
    const hints = new Map(); hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.ITF, Z.BarcodeFormat.QR_CODE]);
    const reader = new Z.MultiFormatReader(); reader.setHints(hints);
    const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
    return { detect: async v => {
      cv.width = v.videoWidth; cv.height = v.videoHeight; if (!cv.width) return [];
      cx.drawImage(v, 0, 0);
      try { const bm = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv))); return [{ rawValue: reader.decode(bm).getText() }]; } catch (e) { return []; }
    } };
  }
  async function startCamera(video, onCode) {
    stopCamera();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Kamera tidak didukung di browser ini. Gunakan scanner USB/Bluetooth atau ketik kode.');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); }
    catch (e) { throw new Error('Kamera tidak dapat diakses (' + (e.name || 'ditolak') + '). Izinkan akses kamera di browser, atau gunakan scanner/ketik kode.'); }
    cam.stream = stream; cam.active = true; video.srcObject = stream;
    try { await video.play(); } catch (e) { /* tetap lanjut */ }
    let det = null;
    if (typeof BarcodeDetector !== 'undefined') {
      try {
        const want = ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'itf', 'qr_code'];
        const sup = BarcodeDetector.getSupportedFormats ? await BarcodeDetector.getSupportedFormats() : want;
        det = new BarcodeDetector({ formats: want.filter(f => sup.indexOf(f) >= 0) });
      } catch (e) { det = null; }
    }
    if (!det) { try { det = await zxingDetector(); } catch (e) { stopCamera(); throw e; } }
    let last = '', lastT = 0, busy = false;
    cam.timer = setInterval(async () => {
      if (busy) return;
      if (!video.isConnected) return stopCamera();
      busy = true;
      try {
        const r = await det.detect(video);
        if (r && r.length) { const c = r[0].rawValue, now = Date.now(); if (c !== last || now - lastT > 1800) { last = c; lastT = now; onCode(c); } }
      } catch (e) { /* frame gagal */ }
      busy = false;
    }, 250);
  }

  // ───────── Komponen kotak scan ─────────
  function scanBox(p, extra) {
    return '<div class="d-flex flex-wrap gap-2 align-items-center">' +
      '<div class="search-box flex-grow-1" style="min-width:200px"><i class="bi bi-upc-scan"></i><input id="' + p + 'In" class="form-control" placeholder="Scan barcode atau ketik kode, lalu Enter" autocomplete="off" aria-label="Scan barcode"></div>' +
      '<button type="button" class="btn-x btn-ghost" id="' + p + 'Ok">OK</button>' +
      '<button type="button" class="btn-x btn-ghost" id="' + p + 'Cam" data-bc-cam="1"><i class="bi bi-camera"></i> Kamera</button>' + (extra || '') + '</div>' +
      '<div id="' + p + 'VidWrap" style="display:none" class="mt-2"><video id="' + p + 'Vid" class="bc-video" playsinline muted></video></div>' +
      '<div id="' + p + 'Msg" class="mt-2" style="font-size:13px" aria-live="polite"></div>';
  }
  function bindScan(p, onCode) {
    const inp = $(p + 'In'), ok = $(p + 'Ok'), cb = $(p + 'Cam'), wrap = $(p + 'VidWrap'), vid = $(p + 'Vid');
    const submit = () => { const v = inp.value; inp.value = ''; if (norm(v)) onCode(v); inp.focus(); };
    inp.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === 'Tab') && inp.value) { e.preventDefault(); submit(); } });
    ok.addEventListener('click', submit);
    cb.addEventListener('click', async () => {
      if (cam.active) { stopCamera(); wrap.style.display = 'none'; return; }
      wrap.style.display = '';
      try { await startCamera(vid, onCode); cb.innerHTML = '<i class="bi bi-stop-circle"></i> Stop kamera'; say(p, 'Arahkan kamera ke barcode...', ''); }
      catch (e) { wrap.style.display = 'none'; say(p, esc(e.message), 'bad'); }
    });
    return inp;
  }

  // ───────── Modal tambahan & cetak ─────────
  let bm = null;
  function bcOpen(title, body, foot) {
    if (!$('bcModal')) {
      const d = document.createElement('div'); d.className = 'modal fade'; d.id = 'bcModal'; d.tabIndex = -1;
      d.innerHTML = '<div class="modal-dialog modal-dialog-scrollable modal-lg" id="bcDialog"><div class="modal-content"><div class="modal-header"><h5 class="modal-title" id="bcTitle"></h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button></div><div class="modal-body" id="bcBody"></div><div class="modal-footer" id="bcFoot"></div></div></div>';
      document.body.appendChild(d);
    }
    $('bcTitle').textContent = title; $('bcBody').innerHTML = body; $('bcFoot').innerHTML = foot || '';
    bm = bootstrap.Modal.getOrCreateInstance($('bcModal')); bm.show();
  }
  const bcClose = () => { if (bm) bm.hide(); };
  function printHtml(html, pageCss) {
    let root = $('printRoot'); if (!root) { root = document.createElement('div'); root.id = 'printRoot'; document.body.appendChild(root); }
    root.innerHTML = html;
    let ps = $('printPage'); if (!ps) { ps = document.createElement('style'); ps.id = 'printPage'; document.head.appendChild(ps); }
    ps.textContent = '@page { ' + (pageCss || 'size: A4; margin: 12mm') + ' }';
    document.body.classList.add('printing');
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => { try { window.print(); } catch (e) { done(); toast('Cetak gagal', e.message, 'danger'); } }, 60);
  }

  // ───────── Label barcode ─────────
  function labelsHtml(items, size, mode) {
    const wh = size.split('x').map(Number);
    const one = it => '<div class="bc-label" style="width:' + wh[0] + 'mm;height:' + wh[1] + 'mm">' + svg128(it.Kode, { height: 40 }) + '<div class="bc-lk">' + esc(it.Kode) + '</div><div class="bc-ln">' + esc(it.Nama) + '</div></div>';
    let out = '', n = 0;
    items.forEach(it => { for (let i = 0; i < it.n && n < 300; i++, n++) out += one(it); });
    return '<div class="bc-labels' + (mode === 'roll' ? ' bc-roll' : '') + '">' + out + '</div>';
  }
  const labelPage = (size, mode) => { const wh = size.split('x'); return mode === 'roll' ? 'size: ' + wh[0] + 'mm ' + wh[1] + 'mm; margin: 0' : 'size: A4; margin: 8mm'; };
  function openLabelDialog(prefill) {
    const items = (prefill || []).map(x => ({ Kode: x.Kode, Nama: x.Nama, n: x.n || 1 }));
    bcOpen('Cetak Label Barcode',
      '<div class="fld mb-3"><label class="form-label">Tambah barang</label><div id="lbPickWrap">' + pickerHTML('lbPick') + '</div></div>' +
      '<div class="row g-2 mb-3"><div class="col-6 fld"><label for="lbSize">Ukuran label</label><select id="lbSize" class="form-select"><option value="50x30">50 x 30 mm</option><option value="70x40">70 x 40 mm</option><option value="100x50">100 x 50 mm</option></select></div>' +
      '<div class="col-6 fld"><label for="lbMode">Kertas</label><select id="lbMode" class="form-select"><option value="sheet">Lembar A4 (banyak label)</option><option value="roll">Printer label (1 label per halaman)</option></select></div></div>' +
      '<div id="lbList"></div><div class="text-3 mt-3 mb-1" style="font-size:12px">Pratinjau</div><div id="lbPrev"></div>',
      '<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Tutup</button><button type="button" class="btn-x btn-primary-x" id="lbPrint"><i class="bi bi-printer"></i> Cetak</button>');
    const prev = () => { $('lbPrev').innerHTML = labelsHtml(items, $('lbSize').value, 'sheet'); };
    const render = () => {
      $('lbList').innerHTML = items.length ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>Barang</th><th style="width:110px">Jumlah label</th><th></th></tr></thead><tbody>' +
        items.map((it, i) => '<tr><td><span class="mono">' + esc(it.Kode) + '</span><div>' + esc(it.Nama) + '</div></td><td><input type="number" min="1" max="200" class="form-control" value="' + it.n + '" data-i="' + i + '" aria-label="Jumlah label ' + esc(it.Kode) + '"></td><td><button type="button" class="icon-btn" style="width:32px;height:32px" data-rm="' + i + '" aria-label="Hapus"><i class="bi bi-x-lg"></i></button></td></tr>').join('') + '</tbody></table></div>' : emptyBox('bi-upc', 'Pilih barang yang labelnya akan dicetak.');
      prev();
    };
    const mountPicker = () => {
      $('lbPickWrap').innerHTML = pickerHTML('lbPick');
      initPicker('lbPick', b => {
        if (!b) return;
        const ex = items.find(x => x.Kode === b.Kode); if (ex) ex.n++; else items.push({ Kode: b.Kode, Nama: b.Nama, n: 1 });
        render(); mountPicker();
      });
    };
    mountPicker();
    $('lbList').addEventListener('input', e => { const i = e.target.dataset.i; if (i !== undefined) { items[i].n = Math.max(1, Math.min(200, Number(e.target.value) || 1)); prev(); } });
    $('lbList').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { items.splice(Number(b.dataset.rm), 1); render(); } });
    $('lbSize').addEventListener('change', prev);
    $('lbPrint').addEventListener('click', () => {
      if (!items.length) return toast('Info', 'Pilih barang terlebih dahulu.', 'warning');
      const size = $('lbSize').value, mode = $('lbMode').value;
      printHtml(labelsHtml(items, size, mode), labelPage(size, mode));
    });
    render();
  }

  // ───────── Barang Masuk: scan ─────────
  function fillRow(row, b) {
    row.dataset.kode = b.Kode;
    row.querySelector('.unit').textContent = b.Satuan;
    row.querySelector('.bp-sel').innerHTML = '<div class="picked"><span><span class="mono">' + esc(b.Kode) + '</span> ' + esc(b.Nama) + '<br><small>' + esc(b.Disiplin) + ' · stok ' + fmt(b.Stok) + ' ' + esc(b.Satuan) + '</small></span><button type="button" class="link-btn" data-clear>Ganti</button></div>';
    row.querySelector('.bp-input').style.display = 'none';
    row.dataset.nama = b.Nama;
  }
  function onMasukScan(raw) {
    return enqueue(async () => {
      const code = norm(raw); if (!code) return;
      try {
        const b = await lookup(code);
        const qty = Math.max(1, Number(($('bmQty') || {}).value) || 1);
        const rows = [].slice.call(document.querySelectorAll('#masukItems .item-row'));
        let row = rows.find(r => r.dataset.kode === b.Kode);
        if (row) { const q = row.querySelector('.mj'); q.value = (Number(q.value) || 0) + qty; }
        else {
          row = rows.find(r => !r.dataset.kode);
          if (!row) { addMasukRow(); const all = document.querySelectorAll('#masukItems .item-row'); row = all[all.length - 1]; }
          fillRow(row, b); row.querySelector('.mj').value = qty;
        }
        flash(row); beep(true);
        say('bm', '<i class="bi bi-check-circle"></i> <b>' + esc(b.Kode) + '</b> · ' + esc(b.Nama) + ' → jumlah ' + fmt(row.querySelector('.mj').value) + ' ' + esc(b.Satuan), 'ok');
      } catch (e) { beep(false); say('bm', '<i class="bi bi-x-circle"></i> ' + esc(e.message), 'bad'); }
    });
  }
  function decorateMasukForm() {
    const body = $('appModalBody'); if (!body || $('bmIn')) return;
    body.insertAdjacentHTML('afterbegin', '<div class="card-x mb-3"><div class="card-b" id="bmPanel"><div class="d-flex align-items-center justify-content-between mb-2"><b><i class="bi bi-upc-scan"></i> Scan barcode barang</b><span class="text-3" style="font-size:12px">tiap scan = satu barang masuk</span></div>' +
      scanBox('bm', '<input id="bmQty" type="number" min="1" value="1" class="form-control" style="width:84px" aria-label="Jumlah per scan" title="Jumlah per scan"><button type="button" class="btn-x btn-ghost" id="bmLbl" title="Cetak label barang di daftar"><i class="bi bi-tags"></i> Label</button>') + '</div></div>');
    bindScan('bm', onMasukScan);
    $('bmLbl').addEventListener('click', () => {
      const its = [].slice.call(document.querySelectorAll('#masukItems .item-row')).filter(r => r.dataset.kode).map(r => ({ Kode: r.dataset.kode, Nama: r.dataset.nama || '', n: 1 }));
      openLabelDialog(its);
    });
    setTimeout(() => { const i = $('bmIn'); if (i) i.focus(); }, 150);
  }
  function decorateMasukPage() {
    const c = $('app-container'); if (!c || AppState.page !== 'masuk' || $('bcMasukBar')) return;
    c.insertAdjacentHTML('afterbegin', '<div id="bcMasukBar" class="card-x mb-3"><div class="card-b d-flex flex-wrap align-items-center gap-2"><b><i class="bi bi-upc-scan"></i> Barcode</b>' +
      '<button type="button" class="btn-x btn-primary-x" id="bcScanMasuk"><i class="bi bi-upc-scan"></i> Scan &amp; Catat Masuk</button>' +
      '<button type="button" class="btn-x btn-ghost" id="bcLabelBtn"><i class="bi bi-tags"></i> Cetak Label Barcode</button>' +
      '<span class="text-3" style="font-size:12px">Scanner USB/Bluetooth atau kamera HP. Barcode = kode barang (Code 128).</span></div></div>');
    $('bcScanMasuk').addEventListener('click', () => openMasukForm());
    $('bcLabelBtn').addEventListener('click', () => openLabelDialog([]));
  }
  const origMasukPage = PAGES.masuk;
  PAGES.masuk = async function () { await origMasukPage.apply(this, arguments); decorateMasukPage(); };
  const origOpenMasuk = window.openMasukForm;
  window.openMasukForm = function () { origOpenMasuk.apply(this, arguments); decorateMasukForm(); };

  // ───────── Barang Keluar: verifikasi scan & scan cepat ─────────
  function setVerify(ok, text) {
    const s = $('bkStatus'), k = $('kOk'); if (!s) return;
    s.className = 'chip ' + (ok === true ? 'ok' : ok === false ? 'bad' : 'warn'); s.textContent = text;
    if (k) k.disabled = (ok === false) && !($('bkOv') && $('bkOv').checked);
    const ov = $('bkOvWrap'); if (ov) ov.style.display = ok === false ? '' : 'none';
  }
  function decorateKeluarForm(id) {
    const body = $('appModalBody'), req = (AppState.cache.req || {})[id]; if (!body || !req || $('bkIn')) return;
    body.insertAdjacentHTML('afterbegin', '<div class="card-x mb-3"><div class="card-b"><div class="d-flex align-items-center justify-content-between mb-2"><b><i class="bi bi-upc-scan"></i> Verifikasi barcode</b><span id="bkStatus" class="chip warn">Belum discan</span></div>' +
      scanBox('bk') + '<label id="bkOvWrap" class="d-flex align-items-center gap-2 mt-2" style="font-size:13px"><input type="checkbox" id="bkOv" class="form-check-input mt-0"> Tetap keluarkan walau tidak cocok</label></div></div>');
    $('bkOvWrap').style.display = 'none';
    $('bkOv').addEventListener('change', () => { if ($('kOk')) $('kOk').disabled = !$('bkOv').checked; });
    const want = norm(req.Kode);
    bindScan('bk', raw => {
      const code = norm(raw); if (!code) return;
      if (code === want) { beep(true); setVerify(true, '✓ Cocok'); say('bk', '<i class="bi bi-check-circle"></i> Barcode sesuai: <b>' + esc(req.Kode) + '</b>', 'ok'); }
      else { beep(false); setVerify(false, '✗ Tidak cocok'); say('bk', '<i class="bi bi-x-circle"></i> Terscan <b>' + esc(code) + '</b>, seharusnya <b>' + esc(req.Kode) + '</b> (' + esc(req.NamaBarang) + ')', 'bad'); }
    });
    if (window.__bcPre === id) { window.__bcPre = null; setVerify(true, '✓ Cocok (scan cepat)'); say('bk', 'Barang sudah diverifikasi lewat scan cepat.', 'ok'); }
    else setTimeout(() => { const i = $('bkIn'); if (i) i.focus(); }, 150);
  }
  async function quickIssue(raw) {
    const code = norm(raw); if (!code) return;
    try {
      clearApiCache();   // scan keluar harus memakai data terbaru, bukan cache 45 detik
      const list = await api('listPermintaan', { status: 'Disetujui' });
      AppState.cache.req = AppState.cache.req || {}; list.forEach(r => { AppState.cache.req[r.ID] = r; });
      const hits = list.filter(r => r.Status === 'Disetujui' && norm(r.Kode) === code);
      if (!hits.length) {
        let nama = ''; try { nama = (await lookup(code)).Nama; } catch (e) { throw new Error('Barcode "' + code + '" tidak dikenali.'); }
        beep(false); return say('bq', '<i class="bi bi-x-circle"></i> ' + esc(nama) + ' belum punya permintaan yang disetujui.', 'bad');
      }
      beep(true);
      if (hits.length === 1) { say('bq', '<i class="bi bi-check-circle"></i> ' + esc(hits[0].NamaBarang) + ' · ' + esc(hits[0].Pemohon), 'ok'); window.__bcPre = hits[0].ID; return openKeluar(hits[0].ID); }
      bcOpen('Pilih permintaan · ' + code, hits.map(r => '<div class="timeline-item align-items-center justify-content-between flex-wrap"><div><span class="mono">' + esc(r.NoDok) + '</span> · <b>' + esc(r.NamaBarang) + '</b> ' + fmt(r.Jumlah) + ' ' + esc(r.Satuan) + '<div class="text-3" style="font-size:12px">' + esc(r.Pemohon) + '</div></div><button type="button" class="btn-x btn-primary-x btn-sm-x" data-pick="' + esc(r.ID) + '">Keluarkan</button></div>').join(''),
        '<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Tutup</button>');
      $('bcBody').addEventListener('click', e => {
        const b = e.target.closest('[data-pick]'); if (!b) return;
        const id = b.dataset.pick;
        $('bcModal').addEventListener('hidden.bs.modal', () => { window.__bcPre = id; openKeluar(id); }, { once: true });   // tunggu jendela ini benar-benar tertutup
        bcClose();
      });
    } catch (e) { beep(false); say('bq', '<i class="bi bi-x-circle"></i> ' + esc(e.message), 'bad'); }
  }
  function decorateKeluarPage() {
    const c = $('app-container'); if (!c || AppState.page !== 'keluar' || $('bcKeluarBar')) return;
    c.insertAdjacentHTML('afterbegin', '<div id="bcKeluarBar" class="card-x mb-3"><div class="card-b"><div class="d-flex align-items-center justify-content-between mb-2"><b><i class="bi bi-upc-scan"></i> Scan cepat keluarkan barang</b><span class="text-3" style="font-size:12px">scan barang → permintaan disetujui terbuka otomatis</span></div>' + scanBox('bq') + '</div></div>');
    bindScan('bq', raw => enqueue(() => quickIssue(raw)));
  }
  const origKeluarPage = PAGES.keluar;
  PAGES.keluar = async function () { await origKeluarPage.apply(this, arguments); decorateKeluarPage(); };
  const origOpenKeluar = window.openKeluar;
  window.openKeluar = function (id) { origOpenKeluar.apply(this, arguments); decorateKeluarForm(id); };

  // ───────── Cetak bukti pengeluaran (tanpa PDF di iframe) ─────────
  function docHtml(d) {
    const r = (a, b) => '<tr><td style="padding:2px 10px 2px 0;color:#444;white-space:nowrap">' + a + '</td><td style="padding:2px 0">: <b>' + esc(b) + '</b></td></tr>';
    const sig = (t, n) => '<td style="text-align:center;width:33%;padding-top:8px">' + t + '<div style="height:60px"></div>(' + esc(n || '..............') + ')</td>';
    return '<div class="bc-doc" style="background:#fff;color:#000;padding:16px;font-family:Arial,sans-serif;font-size:12px;line-height:1.35">' +
      '<table style="width:100%;border-collapse:collapse"><tr><td><div style="font-size:16px;font-weight:700">' + esc(d.appName) + '</div><div>' + esc(d.perusahaan) + '</div></td><td style="text-align:right;width:210px">' + svg128(d.noDok, { height: 36, width: '200' }) + '<div style="font:700 11px monospace">' + esc(d.noDok) + '</div></td></tr></table>' +
      '<hr style="border:0;border-top:2px solid #000;margin:8px 0"><div style="text-align:center;font-size:14px;font-weight:700;margin-bottom:8px">SURAT / BUKTI PENGELUARAN BARANG</div>' +
      '<table>' + r('No. Dokumen', d.noDok) + r('Tanggal', d.tanggal) + r('Ref. Permintaan', d.noReq + ' (pemohon: ' + d.pemohon + ')') + r('Disetujui oleh', d.penyetuju + (d.waktuSetuju ? ' · ' + d.waktuSetuju : '')) + '</table>' +
      '<table style="width:100%;border-collapse:collapse;margin-top:10px" border="1" cellpadding="6"><tr style="background:#e2e8f0"><th>Kode</th><th>Nama Barang</th><th>Disiplin</th><th>Jumlah</th></tr><tr><td>' + esc(d.kode) + '</td><td>' + esc(d.nama) + '</td><td>' + esc(d.disiplin) + '</td><td><b>' + fmt(d.jumlah) + ' ' + esc(d.satuan) + '</b></td></tr></table>' +
      '<p style="margin:8px 0">Keperluan: ' + esc(d.keperluan) + '</p>' +
      '<table style="width:100%;margin-top:14px"><tr>' + sig('Yang Mengeluarkan', d.pengeluar) + sig('Yang Menerima', d.penerima) + sig('Menyetujui', d.penyetuju) + '</tr></table></div>';
  }
  async function downloadBukti(id) {
    const r = await api('cetakBukti', id), f = await api('getFileData', r.fileId);
    const bytes = Uint8Array.from(atob(f.data), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: f.mime }));
    const a = document.createElement('a'); a.href = url; a.download = f.name || 'bukti.pdf'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function showBukti(ref) {
    try {
      const d = await api('getBuktiData', ref);
      bcOpen('Bukti Pengeluaran ' + d.noDok, docHtml(d),
        '<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Tutup</button><button type="button" class="btn-x btn-ghost" id="bcPdf"><i class="bi bi-download"></i> Unduh PDF</button><button type="button" class="btn-x btn-primary-x" id="bcPrint"><i class="bi bi-printer"></i> Cetak</button>');
      $('bcPrint').addEventListener('click', () => printHtml(docHtml(d), 'size: A4; margin: 12mm'));
      $('bcPdf').addEventListener('click', e => withBtn(e.currentTarget, () => downloadBukti(d.id)));
    } catch (e) { toast('Gagal', e.message, 'danger'); }
  }
  window.lihatBukti = function (id, no) { return showBukti({ id: id, noDok: no }); };
  window.previewFile = async function (fileId, label) {
    if (!fileId) return toast('Info', 'Berkas tidak tersedia.', 'warning');
    const m = /^Bukti Pengeluaran (BK-\S+)/.exec(label || '');
    if (m) return showBukti({ noDok: m[1] });
    try {
      toast('Memuat', 'Mengambil berkas...');
      const f = await api('getFileData', fileId);
      const bytes = Uint8Array.from(atob(f.data), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: f.mime }));
      $('previewTitle').textContent = label || f.name;
      $('previewBody').innerHTML = f.mime.indexOf('image') === 0
        ? '<img src="' + url + '" class="img-fluid rounded" alt="' + esc(label || f.name) + '">'
        : '<div class="p-4"><i class="bi bi-file-earmark-pdf" style="font-size:48px;color:var(--critical)"></i><p class="mt-2 mb-1"><b>' + esc(f.name) + '</b></p><p class="text-3 mb-0">Pratinjau PDF diblokir browser di dalam aplikasi ini. Klik <b>Unduh</b> untuk membuka atau mencetak file.</p></div>';
      const dl = $('previewDownload'); dl.href = url; dl.download = f.name;
      bootstrap.Modal.getOrCreateInstance($('previewModal')).show();
    } catch (e) { toast('Gagal', e.message, 'danger'); }
  };

  // Hentikan kamera saat modal ditutup; pasang bilah bila halaman sudah terbuka lebih dulu
  $('appModal').addEventListener('hidden.bs.modal', stopCamera);
  decorateMasukPage(); decorateKeluarPage();
})();
