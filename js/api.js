/*
 * KLIEN API — semua komunikasi ke backend Google Apps Script lewat fetch().
 * Aturan CORS Apps Script: POST harus bertipe "text/plain" (permintaan sederhana, tanpa preflight)
 * dan tanpa header khusus. Token sesi dikirim di dalam badan JSON, bukan di header.
 */
(function (g) {
  const TIMEOUT_MS = 60000;
  const cfg = () => g.SIM_CONFIG || {};

  function isConfigured() {
    const u = String(cfg().API_URL || '').trim();
    return u.indexOf('https://script.google.com/') === 0 && /\/exec$/.test(u) && u.indexOf('PASTE') < 0;
  }

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
    if (!isConfigured()) throw new Error('Alamat backend belum diisi. Buka js/config.js lalu tempel URL /exec dari Apps Script.');
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
    return request(cfg().API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, token: token || '', args: args || [] })
    });
  };
  /** GET hanya untuk ping dan publicConfig (tanpa data sensitif). */
  g.gasGet = function (action) {
    return request(cfg().API_URL + '?action=' + encodeURIComponent(action), { method: 'GET' });
  };
  g.isConfigured = isConfigured;
})(window);
