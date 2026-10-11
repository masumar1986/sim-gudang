/*
 * KLIEN API — semua komunikasi ke backend Google Apps Script lewat fetch().
 * Aturan CORS Apps Script: POST harus bertipe "text/plain" (permintaan sederhana, tanpa preflight)
 * dan tanpa header khusus. Token sesi dikirim di dalam badan JSON, bukan di header.
 */
(function (g) {
  const TIMEOUT_MS = 60000;
  const cfg = () => g.SIM_CONFIG || {};

  /** Bersihkan salah-ketik umum: spasi, tanda kutip nyasar, garis miring di ujung. */
  function apiUrl() { return String(cfg().API_URL || '').trim().replace(/^["'`\s]+|["'`\s]+$/g, '').replace(/\/+$/, ''); }

  /** null bila alamat benar; bila salah, kembalikan { judul, detail, nilai } agar pesan di layar spesifik. */
  function configProblem() {
    const raw = String(cfg().API_URL || ''), u = apiUrl();
    if (!u || u.indexOf('PASTE') >= 0) return { judul: 'Alamat backend belum diisi.', detail: 'Buka berkas js/config.js, tempel URL Apps Script (berakhiran /exec), lalu simpan dan push ke GitHub.', nilai: '' };
    const nilai = raw.length > 90 ? raw.slice(0, 90) + '...' : raw;
    if (u.indexOf('https://') !== 0) return { judul: 'Alamat backend tidak valid.', detail: 'Harus diawali https://script.google.com/', nilai };
    if (u.indexOf('https://script.google.com/') !== 0) return { judul: 'Bukan alamat Apps Script.', detail: 'Alamat harus diawali https://script.google.com/macros/s/ ... /exec', nilai };
    if (/\/dev$/.test(u)) return { judul: 'Ini alamat uji (/dev), bukan alamat publik.', detail: 'Pakai URL berakhiran /exec dari Deploy > Manage deployments.', nilai };
    if (/\/home\/|\/projects\//.test(u)) return { judul: 'Ini alamat editor Apps Script, bukan Web App.', detail: 'Pakai URL Web app berakhiran /exec dari Deploy > Manage deployments.', nilai };
    if (!/\/exec$/.test(u)) return { judul: 'Alamat backend harus berakhiran /exec.', detail: 'Mungkin tersalin terpotong atau ada tambahan di ujungnya. Salin ulang dari Deploy > Manage deployments.', nilai };
    return null;
  }
  function isConfigured() { return configProblem() === null; }

  async function readJson(res) {
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) {
      if (/^\s*</.test(text)) throw new Error('Backend membalas halaman HTML, bukan data. Penyebab umum: URL bukan yang berakhiran /exec, akses deployment belum "Anyone", atau versi baru belum di-Deploy.');
      throw new Error('Balasan backend tidak dapat dibaca (HTTP ' + res.status + ').');
    }
    if (!res.ok && !(json && typeof json === 'object')) throw new Error('Backend membalas HTTP ' + res.status + '.');
    return json;
  }

  async function request(url, init) {
    const prob = configProblem(); if (prob) throw new Error(prob.judul + ' ' + prob.detail);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, Object.assign({ signal: ctl.signal, redirect: 'follow' }, init));
      return await readJson(res);
    } catch (e) {
      if (e && e.name === 'AbortError') throw new Error('Server tidak merespons (timeout 60 detik). Periksa koneksi lalu coba lagi. Untuk penyimpanan data, cek dulu hasilnya sebelum mengulang.');
      if (e instanceof TypeError) throw new Error('Tidak dapat menghubungi server. Periksa koneksi internet dan pastikan URL backend di js/config.js benar.');
      throw e;
    } finally { clearTimeout(timer); }
  }

  /** Panggil aksi API. Mengembalikan objek { success, data, message, expired? } apa adanya. */
  g.gasPost = function (action, token, args) {
    return request(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, token: token || '', args: args || [] })
    });
  };
  /** GET hanya untuk ping dan publicConfig (tanpa data sensitif). */
  g.gasGet = function (action) {
    return request(apiUrl() + '?action=' + encodeURIComponent(action), { method: 'GET' });
  };
  g.isConfigured = isConfigured;
  g.configProblem = configProblem;
})(window);
