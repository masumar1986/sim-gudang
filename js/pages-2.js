// SIM Gudang — Bagian 3: Laporan, Master Pendukung, Pengaturan
// ════════════════════════════════════════════════════════
// BAGIAN 11: LAPORAN
// ════════════════════════════════════════════════════════
const LR = { periode: 'harian', tanggal: today() };
PAGES.laporan = async function () {
  $('app-container').innerHTML = `
  <div class="card-x mb-3"><div class="card-b"><div class="row g-2 align-items-end">
    <div class="col-12 col-md-5"><div class="tabs-x" id="lrTabs">${['harian', 'mingguan', 'bulanan'].map(p => `<button type="button" class="${LR.periode === p ? 'active' : ''}" onclick="LR.periode='${p}';PAGES.laporan()">${p.charAt(0).toUpperCase() + p.slice(1)}</button>`).join('')}</div></div>
    <div class="col-6 col-md-3 fld"><label for="lrTgl">Tanggal acuan</label><input id="lrTgl" type="date" class="form-control" value="${esc(LR.tanggal)}" onchange="LR.tanggal=this.value;loadLaporan()"></div>
    <div class="col-6 col-md-4 text-end"><button class="btn-x btn-ghost" id="lrPdf" onclick="unduhLaporan(this)"><i class="bi bi-file-earmark-pdf"></i> Buat PDF</button></div>
  </div></div></div><div id="lapOut">${skel(4)}</div>`;
  await loadLaporan();
};
async function unduhLaporan(btn) {
  await withBtn(btn, async () => { const r = await api('exportLaporanPdf', LR); await previewFile(r.fileId, 'Laporan ' + LR.periode); });
}
async function loadLaporan() {
  const el = $('lapOut'); if (!el) return;
  el.innerHTML = skel(4);
  try {
    const l = await api('getLaporan', LR), s = l.ringkasan;
    const kp = (t, v, c) => `<div class="col-6 col-lg-3"><div class="card-x kpi"><div class="kpi-top">${t}</div><div class="metric" style="${c || ''}">${fmt(v)}</div></div></div>`;
    const tbl = (head, rows, empty) => rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : emptyBox('bi-inbox', empty);
    el.innerHTML = `<div class="text-3 mb-2">Periode <b>${esc(l.dari)}</b> s/d <b>${esc(l.sampai)}</b></div>
    <div class="row g-3 mb-3">${kp('Transaksi Masuk', s.transaksiMasuk)}${kp('Transaksi Keluar', s.transaksiKeluar)}${kp('Permintaan (ditolak ' + s.ditolak + ')', s.permintaan)}${kp('Stok Kritis', s.stokKritis, 'color:var(--critical)')}</div>
    <div class="card-x mb-3"><div class="card-h"><h3>Per Disiplin</h3></div><div class="card-b">${tbl(['Disiplin', 'Masuk', 'Keluar'], DISIPLIN.map(d => `<tr><td>${discTag(d)}</td><td class="num">${l.perDisiplin[d].masuk}</td><td class="num">${l.perDisiplin[d].keluar}</td></tr>`), '')}</div></div>
    <div class="card-x mb-3"><div class="card-h"><h3>Barang Masuk</h3></div><div class="card-b">${tbl(['Tanggal', 'Dokumen', 'Supplier / PO', 'Barang', 'Jumlah', 'Penerima'], l.masuk.map(x => `<tr><td class="num nowrap">${esc(x.Tanggal)}</td><td class="mono">${esc(x.NoDok)}</td><td>${esc(x.Supplier)}<div class="mono text-3">${esc(x.NoPO)}</div></td><td>${esc(x.NamaBarang)}</td><td class="num nowrap">${fmt(x.Jumlah)} ${esc(x.Satuan)}</td><td>${esc(x.Penerima)}</td></tr>`), 'Tidak ada barang masuk pada periode ini.')}</div></div>
    <div class="card-x mb-3"><div class="card-h"><h3>Barang Keluar</h3></div><div class="card-b">${tbl(['Tanggal', 'Dokumen', 'Barang', 'Jumlah', 'Pengeluar', 'Penerima'], l.keluar.map(x => `<tr><td class="num nowrap">${esc(x.Tanggal)}</td><td class="mono">${esc(x.NoDok)}</td><td>${esc(x.NamaBarang)}</td><td class="num nowrap">${fmt(x.Jumlah)} ${esc(x.Satuan)}</td><td>${esc(x.Pengeluar)}</td><td>${esc(x.Penerima)}</td></tr>`), 'Tidak ada barang keluar pada periode ini.')}</div></div>
    <div class="card-x"><div class="card-h"><h3>Hampir Habis / Habis (kondisi saat ini)</h3></div><div class="card-b">${tbl(['Kode', 'Barang', 'Disiplin', 'Sisa', 'Min', 'Status'], l.kritis.map(x => `<tr><td class="mono">${esc(x.Kode)}</td><td>${esc(x.Nama)}</td><td>${discTag(x.Disiplin)}</td><td class="num nowrap">${fmt(x.Stok)} ${esc(x.Satuan)}</td><td class="num">${fmt(x.StokMin)}</td><td>${stokChip(x.Status)}</td></tr>`), 'Tidak ada barang kritis.')}</div></div>`;
  } catch (e) { el.innerHTML = errBox(e); }
}

// ════════════════════════════════════════════════════════
// BAGIAN 12: MASTER PENDUKUNG (SUPPLIER, KARYAWAN, SATUAN, LOKASI)
// ════════════════════════════════════════════════════════
const MASTER_FIELDS = {
  Supplier: [['Nama', 'Nama supplier'], ['Kontak', 'Kontak'], ['Alamat', 'Alamat']],
  Karyawan: [['Nama', 'Nama'], ['Jabatan', 'Jabatan'], ['Disiplin', 'Disiplin']],
  Satuan: [['Nama', 'Satuan']],
  Lokasi: [['Kode', 'Kode lokasi'], ['Nama', 'Keterangan']]
};
let MT = 'Supplier';
PAGES.master = async function () {
  $('app-container').innerHTML = `
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
    <div class="tabs-x">${Object.keys(MASTER_FIELDS).map(k => `<button type="button" class="${MT === k ? 'active' : ''}" onclick="MT='${k}';PAGES.master()">${k}</button>`).join('')}</div>
    <button class="btn-x btn-primary-x" onclick="openMasterForm()"><i class="bi bi-plus-circle"></i> Tambah ${esc(MT)}</button></div><div id="masterTable">${skel(3)}</div>`;
  try {
    const rows = await api('listMaster', MT);
    AppState.cache.master = {}; rows.forEach(r => AppState.cache.master[r.ID] = r);
    const f = MASTER_FIELDS[MT];
    $('masterTable').innerHTML = rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>${f.map(x => `<th>${esc(x[1])}</th>`).join('')}<th></th></tr></thead><tbody>
      ${rows.map(r => `<tr>${f.map(x => `<td>${esc(r[x[0]])}</td>`).join('')}<td class="nowrap text-end"><button class="icon-btn" style="width:32px;height:32px" onclick="openMasterForm('${esc(r.ID)}')" aria-label="Ubah"><i class="bi bi-pencil"></i></button>${role() === 'admin' ? ` <button class="icon-btn" style="width:32px;height:32px" onclick="hapusMaster('${esc(r.ID)}')" aria-label="Hapus"><i class="bi bi-trash"></i></button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : emptyBox('bi-inbox', 'Belum ada data.');
  } catch (e) { $('masterTable').innerHTML = errBox(e); }
};
function openMasterForm(id) {
  const r = id ? AppState.cache.master[id] : {};
  openModal({
    title: (id ? 'Ubah ' : 'Tambah ') + MT,
    body: MASTER_FIELDS[MT].map(x => `<div class="fld mb-3"><label for="mf_${x[0]}">${esc(x[1])}</label>${x[0] === 'Disiplin' ? `<select id="mf_Disiplin" class="form-select">${optList(DISIPLIN, r.Disiplin, '— tidak ada —')}</select>` : `<input id="mf_${x[0]}" class="form-control" value="${esc(r[x[0]] || '')}">`}</div>`).join(''),
    footer: `<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Batal</button><button type="button" class="btn-x btn-primary-x" id="mfOk">Simpan</button>`
  });
  $('mfOk').onclick = e => withBtn(e.currentTarget, async () => {
    const o = { ID: id || '' }; MASTER_FIELDS[MT].forEach(x => o[x[0]] = $('mf_' + x[0]).value);
    await api('saveMaster', MT, o); closeModal(); toast('Berhasil', 'Data disimpan.', 'success'); loadLookups(); PAGES.master();
  });
}
function hapusMaster(id) {
  confirmBox('Hapus Data', 'Hapus data ini dari master?', 'Hapus', async () => {
    await api('deleteMaster', MT, id); closeModal(); toast('Berhasil', 'Data dihapus.', 'success'); loadLookups(); PAGES.master();
  }, true);
}

// ════════════════════════════════════════════════════════
// BAGIAN 13: PENGATURAN (IDENTITAS APLIKASI & PENGGUNA)
// ════════════════════════════════════════════════════════
PAGES.pengaturan = async function () {
  const [cfg, users] = await Promise.all([api('getConfig'), api('listUsers')]);
  AppState.cache.users = {}; users.forEach(u => AppState.cache.users[u.ID] = u);
  const inp = (k, l, ph) => `<div class="col-md-6 fld"><label for="cf_${k}">${l}</label><input id="cf_${k}" class="form-control" value="${esc(cfg[k] || '')}" placeholder="${esc(ph || '')}"></div>`;
  $('app-container').innerHTML = `
  <div class="card-x mb-3"><div class="card-h"><h3>Identitas & Email</h3></div><div class="card-b"><div class="row g-3">
    ${inp('appName', 'Nama aplikasi')}${inp('perusahaan', 'Nama perusahaan / depot')}${inp('logoUrl', 'URL logo (opsional)', 'https:\u002f\u002f...')}
    ${inp('emailLaporan', 'Email penerima laporan mingguan & bulanan', 'nama@perusahaan.com')}${inp('emailTandaTerima', 'Email tanda terima barang masuk/keluar')}
    <div class="col-12"><button class="btn-x btn-primary-x" id="cfSave"><i class="bi bi-save"></i> Simpan Pengaturan</button></div></div></div></div>
  <div class="card-x mb-3"><div class="card-h"><h3>Cek Sistem</h3></div><div class="card-b d-flex flex-wrap align-items-center gap-3">
    <button class="btn-x btn-ghost" id="hcBtn"><i class="bi bi-heart-pulse"></i> Tes Server</button>
    <span class="text-3">Skrip: ${esc(scriptStatus())} · memeriksa sheet, folder Drive, dan pemicu laporan.</span></div></div>
  <div class="card-x"><div class="card-h"><h3>Pengguna (${users.length})</h3><button class="btn-x btn-primary-x btn-sm-x" onclick="openUserForm()"><i class="bi bi-person-plus"></i> Tambah</button></div><div class="card-b">
    <div class="table-wrap"><table class="tbl"><thead><tr><th>Username</th><th>Nama</th><th>Peran</th><th class="hide-sm">Disiplin</th><th class="hide-sm">Berwenang</th><th>Status</th><th></th></tr></thead><tbody>
    ${users.map(u => `<tr><td class="mono">${esc(u.Username)}</td><td>${esc(u.Nama)}</td><td>${esc(ROLE_LABEL[u.Role] || u.Role)}</td><td class="hide-sm">${u.Disiplin ? discTag(u.Disiplin) : '-'}</td><td class="hide-sm">${u.Berwenang === 'Y' ? 'Ya' : '-'}</td>
    <td><span class="chip ${u.Aktif === 'N' ? 'bad' : 'ok'}">${u.Aktif === 'N' ? 'Nonaktif' : 'Aktif'}</span></td><td><button class="icon-btn" style="width:32px;height:32px" onclick="openUserForm('${esc(u.ID)}')" aria-label="Ubah ${esc(u.Username)}"><i class="bi bi-pencil"></i></button></td></tr>`).join('')}</tbody></table></div>
    <p class="form-text mt-2 mb-0">"Berwenang" memberi staff hak menyetujui permintaan barang keluar (kuasa dari Kepala Gudang).</p></div></div>`;
  $('hcBtn').onclick = e => withBtn(e.currentTarget, runHealthCheck);
  $('cfSave').onclick = e => withBtn(e.currentTarget, async () => {
    const o = {}; ['appName', 'perusahaan', 'logoUrl', 'emailLaporan', 'emailTandaTerima'].forEach(k => o[k] = $('cf_' + k).value);
    await api('saveConfig', o);
    AppState.config = Object.assign(AppState.config, { appName: o.appName, perusahaan: o.perusahaan, logoUrl: o.logoUrl }); applyConfig();
    toast('Berhasil', 'Pengaturan disimpan.', 'success');
  });
};
async function runHealthCheck() {
  const r = await api('healthCheck');
  const rows = r.sheets.map(s => `<tr><td>${esc(s.name)}</td><td class="num">${s.rows === undefined ? '-' : fmt(s.rows)}</td><td><span class="chip ${s.ok ? 'ok' : 'bad'}">${esc(s.info)}</span></td></tr>`).join('');
  openModal({ title: 'Hasil Tes Server', size: 'lg',
    body: `<p>Versi server <b>${esc(r.versi)}</b> · Folder Drive: <span class="chip ${r.folderOk ? 'ok' : 'bad'}">${r.folderOk ? 'OK' : 'Bermasalah'}</span> · Pemicu laporan: <b>${r.triggers.length}</b> terpasang${r.triggers.length < 2 ? ' <span class="chip warn">jalankan installTriggers()</span>' : ''}</p>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Sheet</th><th class="r">Baris data</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    footer: '<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Tutup</button>' });
}
function openUserForm(id) {
  const u = id ? AppState.cache.users[id] : null;
  openModal({
    title: u ? 'Ubah Pengguna' : 'Tambah Pengguna',
    body: `<div class="row g-3">
      <div class="col-md-6 fld"><label for="uUser">Username *</label><input id="uUser" class="form-control" value="${esc(u ? u.Username : '')}" autocomplete="off"></div>
      <div class="col-md-6 fld"><label for="uNama">Nama lengkap *</label><input id="uNama" class="form-control" value="${esc(u ? u.Nama : '')}"></div>
      <div class="col-md-6 fld"><label for="uRole">Peran *</label><select id="uRole" class="form-select" onchange="$('uDispBox').style.display=this.value==='petugas'?'':'none'">${Object.keys(ROLE_LABEL).map(k => `<option value="${k}" ${u && u.Role === k ? 'selected' : ''}>${esc(ROLE_LABEL[k])}</option>`).join('')}</select></div>
      <div class="col-md-6 fld" id="uDispBox" style="display:${u && u.Role === 'petugas' ? '' : 'none'}"><label for="uDisp">Disiplin (Petugas) *</label><select id="uDisp" class="form-select">${optList(DISIPLIN, u && u.Disiplin)}</select></div>
      <div class="col-md-6 fld"><label for="uPass">${u ? 'Reset password/PIN (kosongkan jika tidak diubah)' : 'Password / PIN awal * (min. 6)'}</label><input id="uPass" type="password" class="form-control" autocomplete="new-password"></div>
      <div class="col-md-6 d-flex flex-column justify-content-end gap-2">
        <label class="d-flex align-items-center gap-2 mb-0"><input type="checkbox" class="form-check-input mt-0" id="uBerw" ${u && u.Berwenang === 'Y' ? 'checked' : ''}> Berwenang menyetujui permintaan</label>
        ${u ? `<label class="d-flex align-items-center gap-2 mb-0"><input type="checkbox" class="form-check-input mt-0" id="uAktif" ${u.Aktif !== 'N' ? 'checked' : ''}> Akun aktif</label>` : ''}</div></div>`,
    footer: `<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Batal</button><button type="button" class="btn-x btn-primary-x" id="uOk">Simpan</button>`
  });
  $('uOk').onclick = e => withBtn(e.currentTarget, async () => {
    await api('saveUser', { ID: u ? u.ID : '', Username: $('uUser').value, Nama: $('uNama').value, Role: $('uRole').value, Disiplin: $('uDisp').value, Berwenang: $('uBerw').checked ? 'Y' : 'N', Aktif: u && !$('uAktif').checked ? 'N' : 'Y', password: $('uPass').value });
    closeModal(); toast('Berhasil', 'Pengguna disimpan.', 'success'); PAGES.pengaturan();
  });
}
