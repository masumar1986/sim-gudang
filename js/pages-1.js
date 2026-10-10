// SIM Gudang — Bagian 2: Master Barang, Barang Masuk, Permintaan, Barang Keluar, LPB
// ════════════════════════════════════════════════════════
// BAGIAN 6: MASTER BARANG
// ════════════════════════════════════════════════════════
const BF = { q: '', disiplin: '', jenis: '', status: '', page: 1 };

PAGES.barang = async function () {
  $('app-container').innerHTML = `
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
    <div class="text-3">Cari dan filter seluruh material gudang.</div>
    ${canEdit() ? `<button class="btn-x btn-primary-x" onclick="openBarangForm()"><i class="bi bi-plus-circle"></i> Tambah Barang</button>` : ''}
  </div>
  <div class="card-x mb-3"><div class="card-b"><div class="row g-2">
    <div class="col-12 col-md-4"><div class="search-box"><i class="bi bi-search"></i><input class="form-control" id="bfQ" placeholder="Cari kode, nama, lokasi..." value="${esc(BF.q)}" oninput="BF.q=this.value;BF.page=1;debounce(loadBarang)" aria-label="Cari barang"></div></div>
    <div class="col-6 col-md-3"><select class="form-select" onchange="BF.disiplin=this.value;BF.page=1;loadBarang()" aria-label="Filter disiplin">${optList(DISIPLIN, BF.disiplin, 'Semua disiplin')}</select></div>
    <div class="col-6 col-md-3"><select class="form-select" onchange="BF.jenis=this.value;BF.page=1;loadBarang()" aria-label="Filter jenis material">${optList(JENIS, BF.jenis, 'Semua jenis')}</select></div>
    <div class="col-12 col-md-2"><select class="form-select" onchange="BF.status=this.value;BF.page=1;loadBarang()" aria-label="Filter status">${optList(['Tersedia', 'Menipis', 'Habis'], BF.status, 'Semua status')}</select></div>
  </div></div></div>
  <div id="barangTable">${skel(4)}</div>`;
  await loadBarang();
};

async function loadBarang(page) {
  if (page) BF.page = page;
  const el = $('barangTable'); if (!el) return;
  try {
    const r = await api('listBarang', BF);
    AppState.cache.barang = {}; r.rows.forEach(b => AppState.cache.barang[b.ID] = b);
    el.innerHTML = r.rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Nama / Spesifikasi</th><th>Disiplin</th><th class="hide-sm">Jenis</th><th class="hide-sm">Lokasi</th><th class="r">Stok</th><th class="r hide-sm">Min</th><th>Status</th>${canEdit() ? '<th></th>' : ''}</tr></thead><tbody>
      ${r.rows.map(b => `<tr><td class="mono nowrap">${esc(b.Kode)}</td><td>${esc(b.Nama)}${b.Spesifikasi ? `<div class="text-3" style="font-size:12px">${esc(b.Spesifikasi)}</div>` : ''}</td><td>${discTag(b.Disiplin)}</td><td class="hide-sm">${esc(b.JenisMaterial)}</td><td class="hide-sm mono" style="color:var(--text-2)">${esc(b.Lokasi)}</td>
      <td class="r num nowrap"><b>${fmt(b.Stok)}</b> ${esc(b.Satuan)}</td><td class="r num hide-sm">${fmt(b.StokMin)}</td><td>${stokChip(b.Status)}</td>
      ${canEdit() ? `<td class="nowrap"><button class="icon-btn" style="width:32px;height:32px" onclick="openBarangForm('${esc(b.ID)}')" aria-label="Ubah ${esc(b.Kode)}"><i class="bi bi-pencil"></i></button>${role() === 'admin' ? ` <button class="icon-btn" style="width:32px;height:32px" onclick="hapusBarang('${esc(b.ID)}')" aria-label="Hapus ${esc(b.Kode)}"><i class="bi bi-trash"></i></button>` : ''}</td>` : ''}</tr>`).join('')}
      </tbody></table></div>${pagerHTML(r, 'loadBarang')}` : emptyBox('bi-inbox', 'Tidak ada barang yang cocok.');
  } catch (e) { el.innerHTML = errBox(e); }
}

function openBarangForm(id) {
  const b = id ? AppState.cache.barang[id] : null, L = AppState.lookups;
  openModal({
    title: b ? 'Ubah Barang' : 'Tambah Barang', size: 'lg',
    body: `<div class="row g-3">
      <div class="col-md-5 fld"><label for="bKode">Kode *</label><input id="bKode" class="form-control" value="${esc(b ? b.Kode : '')}" placeholder="mis. PIP-CS-40-0982"></div>
      <div class="col-md-7 fld"><label for="bNama">Nama material *</label><input id="bNama" class="form-control" value="${esc(b ? b.Nama : '')}"></div>
      <div class="col-6 col-md-4 fld"><label for="bDisp">Disiplin *</label><select id="bDisp" class="form-select">${optList(DISIPLIN, b && b.Disiplin)}</select></div>
      <div class="col-6 col-md-4 fld"><label for="bJenis">Jenis material *</label><select id="bJenis" class="form-select">${optList(JENIS, b && b.JenisMaterial)}</select></div>
      <div class="col-6 col-md-4 fld"><label for="bSat">Satuan *</label><select id="bSat" class="form-select">${optList(L.satuan, b && b.Satuan)}</select></div>
      <div class="col-6 col-md-4 fld"><label for="bLok">Lokasi</label><input id="bLok" class="form-control" list="dlLok" value="${esc(b ? b.Lokasi : '')}"><datalist id="dlLok">${L.lokasi.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      ${b ? '' : `<div class="col-6 col-md-4 fld"><label for="bStok">Stok awal</label><input id="bStok" type="number" min="0" step="any" class="form-control" value="0"></div>`}
      <div class="col-6 col-md-4 fld"><label for="bMin">Stok minimum</label><input id="bMin" type="number" min="0" step="any" class="form-control" value="${b ? esc(b.StokMin) : 0}"></div>
      <div class="col-12 fld"><label for="bSpek">Spesifikasi</label><input id="bSpek" class="form-control" value="${esc(b ? b.Spesifikasi : '')}"></div>
      ${b ? '<div class="col-12 form-text">Stok hanya berubah lewat transaksi (barang masuk/keluar) atau LPB.</div>' : ''}
    </div>`,
    footer: `<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Batal</button><button type="button" class="btn-x btn-primary-x" id="bOk">Simpan</button>`
  });
  $('bOk').onclick = e => withBtn(e.currentTarget, async () => {
    const o = { ID: b ? b.ID : '', Kode: $('bKode').value, Nama: $('bNama').value, Disiplin: $('bDisp').value, JenisMaterial: $('bJenis').value, Satuan: $('bSat').value, Lokasi: $('bLok').value, StokMin: $('bMin').value, Spesifikasi: $('bSpek').value };
    if (!b) o.Stok = $('bStok').value;
    await api('saveBarang', o);
    closeModal(); toast('Berhasil', 'Barang disimpan.', 'success'); loadBarang();
  });
}

function hapusBarang(id) {
  const b = AppState.cache.barang[id];
  confirmBox('Hapus Barang', `Hapus "${b.Kode}"? Riwayat transaksi tetap tersimpan.`, 'Hapus', async () => {
    await api('deleteBarang', id); closeModal(); toast('Berhasil', 'Barang dihapus.', 'success'); loadBarang();
  }, true);
}

// ════════════════════════════════════════════════════════
// BAGIAN 7: BARANG MASUK
// ════════════════════════════════════════════════════════
const MF = { q: '', dari: '', sampai: '', disiplin: '' };
PAGES.masuk = async function () {
  $('app-container').innerHTML = `
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
    <div class="text-3">Riwayat penerimaan barang dari supplier.</div>
    <button class="btn-x btn-primary-x" onclick="openMasukForm()"><i class="bi bi-plus-circle"></i> Catat Barang Masuk</button>
  </div>
  <div class="card-x mb-3"><div class="card-b"><div class="row g-2">
    <div class="col-12 col-md-4"><div class="search-box"><i class="bi bi-search"></i><input class="form-control" placeholder="Cari supplier, PO, barang, penerima..." value="${esc(MF.q)}" oninput="MF.q=this.value;debounce(loadMasuk)" aria-label="Cari"></div></div>
    <div class="col-6 col-md-3"><input type="date" class="form-control" value="${esc(MF.dari)}" onchange="MF.dari=this.value;loadMasuk()" aria-label="Dari tanggal"></div>
    <div class="col-6 col-md-3"><input type="date" class="form-control" value="${esc(MF.sampai)}" onchange="MF.sampai=this.value;loadMasuk()" aria-label="Sampai tanggal"></div>
    <div class="col-12 col-md-2"><select class="form-select" onchange="MF.disiplin=this.value;loadMasuk()" aria-label="Disiplin">${optList(DISIPLIN, MF.disiplin, 'Semua disiplin')}</select></div>
  </div></div></div><div id="masukTable">${skel(4)}</div>`;
  await loadMasuk();
};

async function loadMasuk() {
  const el = $('masukTable'); if (!el) return;
  try {
    const r = await api('listMasuk', MF);
    el.innerHTML = r.rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>No. Dokumen</th><th>Supplier / PO</th><th>Barang</th><th class="r">Jumlah</th><th class="hide-sm">Penerima</th><th>Berkas</th></tr></thead><tbody>
      ${r.rows.map(x => `<tr><td class="nowrap num">${esc(x.Tanggal)}</td><td class="mono nowrap">${esc(x.NoDok)}</td><td>${esc(x.Supplier)}<div class="mono" style="color:var(--text-3)">${esc(x.NoPO)}</div></td>
      <td>${esc(x.NamaBarang)}<div>${discTag(x.Disiplin)}</div></td><td class="r num nowrap"><b>${fmt(x.Jumlah)}</b> ${esc(x.Satuan)}</td><td class="hide-sm">${esc(x.Penerima)}</td>
      <td class="nowrap">${fileBtn(x.FileSJ, 'Surat Jalan')}${fileBtn(x.FilePO, 'PO')}</td></tr>`).join('')}</tbody></table></div>
      <div class="pager"><span>Menampilkan ${r.rows.length} dari ${fmt(r.total)} data</span></div>` : emptyBox('bi-inbox', 'Belum ada barang masuk pada filter ini.');
  } catch (e) { el.innerHTML = errBox(e); }
}

let _mrCount = 0;
function openMasukForm() {
  const L = AppState.lookups; _mrCount = 0;
  openModal({
    title: 'Catat Barang Masuk', size: 'lg',
    body: `<div class="row g-3">
      <div class="col-6 fld"><label for="mTgl">Tanggal terima *</label><input id="mTgl" type="date" class="form-control" value="${today()}"></div>
      <div class="col-6 fld"><label for="mPO">Nomor PO *</label><input id="mPO" class="form-control"></div>
      <div class="col-md-6 fld"><label for="mSup">Supplier *</label><input id="mSup" class="form-control" list="dlSup" autocomplete="off"><datalist id="dlSup">${L.supplier.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="col-md-6 fld"><label for="mTerima">Penerima barang *</label><input id="mTerima" class="form-control" list="dlKar" value="${esc(AppState.user.nama)}"><datalist id="dlKar">${L.karyawan.map(x => `<option value="${esc(x.nama)}">`).join('')}</datalist></div>
      <div class="col-12"><div class="d-flex justify-content-between align-items-center mb-2"><label class="form-label mb-0">Barang diterima *</label><button type="button" class="btn-x btn-ghost btn-sm-x" onclick="addMasukRow()"><i class="bi bi-plus"></i> Tambah baris</button></div><div id="masukItems"></div></div>
      <div class="col-md-6 fld"><label for="mSJ">Foto / scan surat jalan</label><input id="mSJ" type="file" class="form-control" accept="${ACCEPT_FILES}"><div class="form-text">Foto dikompres otomatis. PDF maks. 8 MB.</div></div>
      <div class="col-md-6 fld"><label for="mPDF">Dokumen PO (PDF/foto)</label><input id="mPDF" type="file" class="form-control" accept="${ACCEPT_FILES}"></div>
      <div class="col-12 fld"><label for="mCat">Catatan</label><input id="mCat" class="form-control"></div>
    </div>`,
    footer: `<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Batal</button><button type="button" class="btn-x btn-primary-x" id="mOk"><i class="bi bi-check2-circle"></i> Simpan & Kirim Tanda Terima</button>`
  });
  addMasukRow();
  $('mOk').onclick = e => withBtn(e.currentTarget, async () => {
    const items = [...document.querySelectorAll('#masukItems .item-row')].map(r => ({ kode: r.dataset.kode, jumlah: r.querySelector('.mj').value }));
    if (items.some(i => !i.kode || !(Number(i.jumlah) > 0))) throw new Error('Pilih barang dan isi jumlah (> 0) pada setiap baris.');
    const sj = await readPayload($('mSJ').files[0]), po = await readPayload($('mPDF').files[0]);
    const r = await api('saveMasuk', { tanggal: $('mTgl').value, noPO: $('mPO').value, supplier: $('mSup').value, penerima: $('mTerima').value, catatan: $('mCat').value, items, sj, po });
    closeModal(); toast('Berhasil', 'Barang masuk ' + r.noDok + ' tercatat. Stok bertambah.', 'success'); loadMasuk();
  });
}

function addMasukRow() {
  const n = ++_mrCount, id = 'mp' + n;
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `<div class="row g-2 align-items-start"><div class="col-12 col-md-8">${pickerHTML(id)}</div>
    <div class="col-8 col-md-3"><div class="input-group"><input type="number" min="0" step="any" class="form-control mj" placeholder="Jumlah" aria-label="Jumlah"><span class="input-group-text unit" style="min-width:48px;background:var(--card-2);color:var(--text-2);border-color:var(--border-strong)">-</span></div></div>
    <div class="col-4 col-md-1 text-end"><button type="button" class="icon-btn ms-auto" aria-label="Hapus baris" onclick="this.closest('.item-row').remove()"><i class="bi bi-x-lg"></i></button></div></div>`;
  $('masukItems').appendChild(row);
  initPicker(id, b => { row.dataset.kode = b ? b.Kode : ''; row.querySelector('.unit').textContent = b ? b.Satuan : '-'; });
}

// ════════════════════════════════════════════════════════
// BAGIAN 8: PERMINTAAN & PERSETUJUAN
// ════════════════════════════════════════════════════════
let PQ = '';
const REQ_TABS = [['', 'Semua'], ['Menunggu', 'Menunggu'], ['Disetujui', 'Disetujui'], ['Selesai', 'Selesai'], ['Ditolak', 'Ditolak']];

PAGES.permintaan = async function () {
  $('app-container').innerHTML = `
  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
    <div class="text-3">${role() === 'petugas' ? 'Permintaan disiplin ' + esc(AppState.user.disiplin) + ' dan milik Anda.' : 'Ajukan, tinjau, dan setujui permintaan barang keluar.'}</div>
    <button class="btn-x btn-primary-x" onclick="openReqForm()"><i class="bi bi-clipboard-plus"></i> Ajukan Permintaan</button>
  </div>
  <div class="tabs-x mb-3" role="tablist" id="reqTabs"></div><div id="reqTable">${skel(4)}</div>`;
  renderReqTabs(); await loadReq();
};
function renderReqTabs() {
  $('reqTabs').innerHTML = REQ_TABS.map(t => `<button type="button" role="tab" class="${PQ === t[0] ? 'active' : ''}" onclick="PQ='${t[0]}';renderReqTabs();loadReq()">${t[1]}</button>`).join('');
}
async function loadReq() {
  const el = $('reqTable'); if (!el) return;
  try {
    const rows = await api('listPermintaan', { status: PQ });
    AppState.cache.req = {}; rows.forEach(r => AppState.cache.req[r.ID] = r);
    const cnt = {}; rows.forEach(r => { cnt[r.NoDok] = (cnt[r.NoDok] || 0) + 1; });
    if (!PQ) setBadge(rows.filter(r => r.bisaSetuju).length);
    el.innerHTML = rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>No. Dokumen</th><th class="hide-sm">Tanggal</th><th>Barang</th><th class="r">Jumlah</th><th class="hide-sm">Pemohon</th><th>Status</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="mono nowrap">${esc(r.NoDok)}${cnt[r.NoDok] > 1 ? `<div class="text-3" style="font-size:11px;font-family:Inter,sans-serif">${cnt[r.NoDok]} item</div>` : ''}</td><td class="hide-sm nowrap num">${esc(r.Tanggal)}</td><td>${esc(r.NamaBarang)}<div>${discTag(r.Disiplin)} <span class="text-3" style="font-size:12px">${esc(r.JenisMaterial)}</span></div></td>
      <td class="r num nowrap"><b>${fmt(r.Jumlah)}</b> ${esc(r.Satuan)}</td><td class="hide-sm">${esc(r.Pemohon)}</td><td>${reqChip(r.Status)}</td>
      <td class="nowrap"><button class="btn-x ${r.bisaSetuju ? 'btn-primary-x' : 'btn-ghost'} btn-sm-x" onclick="openReview('${esc(r.ID)}')">${r.bisaSetuju ? 'Tinjau' : 'Detail'}</button></td></tr>`).join('')}</tbody></table></div>` : emptyBox('bi-clipboard', 'Belum ada permintaan.');
  } catch (e) { el.innerHTML = errBox(e); }
}

let _rqCount = 0;
function updReqSum() {
  const el = $('rqSum'); if (!el) return;
  const rows = [].slice.call(document.querySelectorAll('#rqItems .item-row')).filter(r => r._b);
  if (!rows.length) { el.innerHTML = ''; return; }
  const per = {}; rows.forEach(r => { per[r._b.Disiplin] = (per[r._b.Disiplin] || 0) + 1; });
  const keys = Object.keys(per);
  el.innerHTML = `<div class="alert-x ${keys.length > 1 ? 'warn' : 'ok'}">${rows.length} item · ${keys.map(k => esc(k) + ' ' + per[k]).join(', ')}${keys.length > 1 ? '. Item beda disiplin disetujui oleh penanggung jawab masing-masing disiplin.' : ''}</div>`;
}
function addReqRow() {
  const wrap = $('rqItems'); if (!wrap) return;
  if (wrap.querySelectorAll('.item-row').length >= 30) return toast('Info', 'Maksimal 30 item per permintaan.', 'warning');
  const n = ++_rqCount, id = 'rqp' + n, row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `<div class="row g-2 align-items-start"><div class="col-12 col-md-7">${pickerHTML(id)}<div class="rqi mt-1"></div></div>
    <div class="col-8 col-md-4"><div class="input-group"><input type="number" min="0" step="any" class="form-control rqj" placeholder="Jumlah" aria-label="Jumlah"><span class="input-group-text unit" style="min-width:48px;background:var(--card-2);color:var(--text-2);border-color:var(--border-strong)">-</span></div></div>
    <div class="col-4 col-md-1 text-end"><button type="button" class="icon-btn ms-auto rqx" aria-label="Hapus baris"><i class="bi bi-x-lg"></i></button></div></div>`;
  wrap.appendChild(row);
  const upd = () => {
    const b = row._b, j = Number(row.querySelector('.rqj').value) || 0;
    row.querySelector('.rqi').innerHTML = b ? `<div class="alert-x ${j > b.Stok ? 'warn' : 'ok'}" style="font-size:12px">Stok ${fmt(b.Stok)} ${esc(b.Satuan)} · ${esc(b.Disiplin)} · ${esc(b.JenisMaterial)}${j > b.Stok ? ' · jumlah melebihi stok' : ''}</div>` : '';
  };
  initPicker(id, b => { row._b = b; row.dataset.kode = b ? b.Kode : ''; row.querySelector('.unit').textContent = b ? b.Satuan : '-'; upd(); updReqSum(); });
  row.querySelector('.rqj').addEventListener('input', upd);
  row.querySelector('.rqx').addEventListener('click', () => { row.remove(); updReqSum(); });
}
function openReqForm() {
  _rqCount = 0;
  openModal({
    title: 'Ajukan Permintaan Barang', size: 'lg',
    body: `<div class="d-flex justify-content-between align-items-center mb-2"><label class="form-label mb-0">Barang diminta *</label><button type="button" class="btn-x btn-ghost btn-sm-x" id="rqAdd"><i class="bi bi-plus"></i> Tambah baris</button></div>
      <div id="rqItems"></div><div id="rqSum" class="mb-3"></div>
      <div class="fld"><label for="rqKep">Keperluan / alasan * <span class="text-3">(berlaku untuk semua item)</span></label><textarea id="rqKep" rows="3" class="form-control" placeholder="mis. Perbaikan line header cooling tower unit 2"></textarea></div>`,
    footer: `<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Batal</button><button type="button" class="btn-x btn-primary-x" id="rqOk">Kirim Permintaan</button>`
  });
  $('rqAdd').onclick = addReqRow;
  addReqRow();
  $('rqOk').onclick = e => withBtn(e.currentTarget, async () => {
    const rows = [].slice.call(document.querySelectorAll('#rqItems .item-row'));
    if (!rows.length) throw new Error('Tambahkan minimal satu barang.');
    const items = rows.map(r => ({ kode: r.dataset.kode || '', jumlah: r.querySelector('.rqj').value }));
    if (items.some(i => !i.kode)) throw new Error('Pilih barang pada setiap baris, atau hapus baris yang kosong.');
    if (items.some(i => !(Number(i.jumlah) > 0))) throw new Error('Isi jumlah (lebih dari 0) pada setiap baris.');
    if (new Set(items.map(i => i.kode)).size !== items.length) throw new Error('Ada barang yang dipilih dua kali. Gabungkan jumlahnya dalam satu baris.');
    const r = await api('createPermintaan', { items: items, keperluan: $('rqKep').value });
    closeModal(); toast('Berhasil', 'Permintaan ' + r.noDok + ' (' + r.jumlahItem + ' item) terkirim.', 'success'); loadReq();
  });
}

function reqGroupHtml(grp, curId) {
  if (grp.length < 2) return '';
  return `<div class="mt-3"><div class="text-3 mb-1" style="font-size:12px;font-weight:600">ITEM DALAM DOKUMEN INI (${grp.length})</div><div class="table-wrap"><table class="tbl"><thead><tr><th>Barang</th><th>Disiplin</th><th class="r">Jumlah</th><th>Status</th></tr></thead><tbody>` +
    grp.map(x => `<tr${x.ID === curId ? ' style="background:var(--chip-info-bg)"' : ''}><td><span class="mono">${esc(x.Kode)}</span><div>${esc(x.NamaBarang)}</div></td><td>${discTag(x.Disiplin)}</td><td class="r num nowrap">${fmt(x.Jumlah)} ${esc(x.Satuan)}</td><td>${reqChip(x.Status)}</td></tr>`).join('') + '</tbody></table></div></div>';
}

function openReview(id) {
  const r = AppState.cache.req[id];
  const grp = Object.keys(AppState.cache.req).map(k => AppState.cache.req[k]).filter(x => x.NoDok === r.NoDok);
  const grpOk = grp.filter(x => x.bisaSetuju);
  const row = (a, b) => `<div class="d-flex justify-content-between gap-3 py-2" style="border-bottom:1px solid var(--border)"><span class="text-3">${a}</span><span class="text-end fw-semibold">${b}</span></div>`;
  openModal({
    title: 'Permintaan ' + r.NoDok,
    body: `${row('Barang', `<span class="mono">${esc(r.Kode)}</span> ${esc(r.NamaBarang)}`)}${row('Disiplin / jenis', `${discTag(r.Disiplin)} ${esc(r.JenisMaterial)}`)}
      ${row('Jumlah', `${fmt(r.Jumlah)} ${esc(r.Satuan)}`)}${row('Pemohon', `${esc(r.Pemohon)} · ${esc(r.Tanggal)}`)}${row('Status', reqChip(r.Status))}
      <div class="mt-3"><div class="text-3 mb-1" style="font-size:12px;font-weight:600">KEPERLUAN</div><div class="p-2" style="background:var(--card-2);border-radius:8px">${esc(r.Keperluan)}</div></div>
      ${r.Penyetuju ? `<div class="timeline-item mt-3"><i class="bi ${r.Status === 'Ditolak' ? 'bi-x-circle text-danger' : 'bi-check-circle text-success'} fs-5"></i><div><b>${esc(r.Status === 'Ditolak' ? 'Ditolak' : 'Disetujui')} oleh ${esc(r.Penyetuju)}</b><div class="text-3" style="font-size:12px">${esc(r.WaktuSetuju)}${r.CatatanPutusan ? ' · ' + esc(r.CatatanPutusan) : ''}</div></div></div>` : ''}
      ${reqGroupHtml(grp, r.ID)}
      ${r.bisaSetuju ? `<div class="fld mt-3"><label for="pvCat">Catatan / alasan (wajib bila menolak)</label><input id="pvCat" class="form-control"></div>` : ''}`,
    footer: r.bisaSetuju
      ? `<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Batal</button><button type="button" class="btn-x btn-danger-x" id="pvNo"><i class="bi bi-x-circle"></i> Tolak</button><button type="button" class="btn-x btn-success-x" id="pvYes"><i class="bi bi-check-circle"></i> Setujui</button>${grpOk.length > 1 ? `<button type="button" class="btn-x btn-success-x" id="pvAllYes">Setujui semua (${grpOk.length})</button><button type="button" class="btn-x btn-danger-x" id="pvAllNo">Tolak semua (${grpOk.length})</button>` : ''}`
      : `<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Tutup</button>`
  });
  if (r.bisaSetuju) {
    const act = (btn, k) => withBtn(btn, async () => {
      if (k === 'tolak' && !$('pvCat').value.trim()) throw new Error('Alasan penolakan wajib diisi.');
      await api('putusPermintaan', id, k, $('pvCat').value);
      closeModal(); toast('Berhasil', k === 'setuju' ? 'Permintaan disetujui.' : 'Permintaan ditolak.', 'success'); loadReq();
    });
    $('pvYes').onclick = e => act(e.currentTarget, 'setuju');
    $('pvNo').onclick = e => act(e.currentTarget, 'tolak');
    if ($('pvAllYes')) {
      const actAll = (btn, k) => withBtn(btn, async () => {
        if (k === 'tolak' && !$('pvCat').value.trim()) throw new Error('Alasan penolakan wajib diisi.');
        const res = await api('putusDokumenPermintaan', r.NoDok, k, $('pvCat').value);
        closeModal(); toast('Berhasil', res.diputuskan + ' item ' + (k === 'setuju' ? 'disetujui' : 'ditolak') + (res.dilewati ? ', ' + res.dilewati + ' item dilewati (bukan wewenang Anda)' : '') + '.', 'success'); loadReq();
      });
      $('pvAllYes').onclick = e => actAll(e.currentTarget, 'setuju');
      $('pvAllNo').onclick = e => actAll(e.currentTarget, 'tolak');
    }
  }
}

// ════════════════════════════════════════════════════════
// BAGIAN 9: BARANG KELUAR & BUKTI PENGELUARAN
// ════════════════════════════════════════════════════════
const KF = { q: '' };
PAGES.keluar = async function () {
  $('app-container').innerHTML = `
  <div class="card-x mb-3"><div class="card-h"><h3>Siap Dikeluarkan (sudah disetujui)</h3></div><div class="card-b" id="readyList">${skel(2)}</div></div>
  <div class="card-x mb-3"><div class="card-b"><div class="search-box"><i class="bi bi-search"></i><input class="form-control" placeholder="Cari riwayat barang keluar..." value="${esc(KF.q)}" oninput="KF.q=this.value;debounce(loadKeluar)" aria-label="Cari"></div></div></div>
  <div id="keluarTable">${skel(3)}</div>`;
  await Promise.all([loadReady(), loadKeluar()]);
};
async function loadReady() {
  const el = $('readyList'); if (!el) return;
  try {
    const rows = await api('listPermintaan', { status: 'Disetujui' });
    AppState.cache.req = AppState.cache.req || {}; rows.forEach(r => AppState.cache.req[r.ID] = r);
    el.innerHTML = rows.length ? rows.map(r => `<div class="timeline-item align-items-center justify-content-between flex-wrap">
      <div><span class="mono">${esc(r.NoDok)}</span> · <b>${esc(r.NamaBarang)}</b> — ${fmt(r.Jumlah)} ${esc(r.Satuan)}<div class="text-3" style="font-size:12px">${esc(r.Pemohon)} · disetujui ${esc(r.Penyetuju)} · ${discTag(r.Disiplin)}</div></div>
      <button class="btn-x btn-primary-x btn-sm-x" onclick="openKeluar('${esc(r.ID)}')"><i class="bi bi-box-arrow-up"></i> Keluarkan</button></div>`).join('') : emptyBox('bi-check2-all', 'Tidak ada permintaan yang menunggu dikeluarkan.');
  } catch (e) { el.innerHTML = errBox(e); }
}
function openKeluar(id) {
  const r = AppState.cache.req[id];
  openModal({
    title: 'Keluarkan Barang · ' + r.NoDok,
    body: `<div class="alert-x warn mb-3">${esc(r.NamaBarang)} — <b>${fmt(r.Jumlah)} ${esc(r.Satuan)}</b>. Stok akan berkurang dan bukti pengeluaran (PDF) dibuat.</div>
      <div class="fld"><label for="kPen">Nama penerima barang *</label><input id="kPen" class="form-control" list="dlKar2" value="${esc(r.Pemohon)}"><datalist id="dlKar2">${AppState.lookups.karyawan.map(x => `<option value="${esc(x.nama)}">`).join('')}</datalist></div>`,
    footer: `<button type="button" class="btn-x btn-ghost" data-bs-dismiss="modal">Batal</button><button type="button" class="btn-x btn-primary-x" id="kOk"><i class="bi bi-check2-circle"></i> Konfirmasi Keluar</button>`
  });
  $('kOk').onclick = e => withBtn(e.currentTarget, async () => {
    const res = await api('eksekusiKeluar', { permintaanId: id, penerima: $('kPen').value });
    closeModal(); toast('Berhasil', 'Barang keluar ' + res.noDok + ' tercatat.', 'success');
    PAGES.keluar();
    if (res.fileId) previewFile(res.fileId, 'Bukti Pengeluaran ' + res.noDok);
  });
}
async function loadKeluar() {
  const el = $('keluarTable'); if (!el) return;
  try {
    const r = await api('listKeluar', KF);
    el.innerHTML = r.rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>No. Dokumen</th><th>Barang</th><th class="r">Jumlah</th><th class="hide-sm">Pengeluar</th><th>Penerima</th><th>Bukti</th></tr></thead><tbody>
      ${r.rows.map(x => `<tr><td class="nowrap num">${esc(x.Tanggal)}</td><td class="mono nowrap">${esc(x.NoDok)}<div class="text-3" style="font-size:11px">${esc(x.NoReq)}</div></td><td>${esc(x.NamaBarang)}<div>${discTag(x.Disiplin)}</div></td>
      <td class="r num nowrap"><b>${fmt(x.Jumlah)}</b> ${esc(x.Satuan)}</td><td class="hide-sm">${esc(x.Pengeluar)}</td><td>${esc(x.Penerima)}</td>
      <td><button class="link-btn" onclick="lihatBukti('${esc(x.ID)}','${esc(x.NoDok)}')"><i class="bi bi-printer"></i> Cetak</button></td></tr>`).join('')}</tbody></table></div>
      <div class="pager"><span>Menampilkan ${r.rows.length} dari ${fmt(r.total)} data</span></div>` : emptyBox('bi-inbox', 'Belum ada barang keluar.');
  } catch (e) { el.innerHTML = errBox(e); }
}
async function lihatBukti(id, no) {
  try { const r = await api('cetakBukti', id); previewFile(r.fileId, 'Bukti Pengeluaran ' + no); } catch (e) { toast('Gagal', e.message, 'danger'); }
}

// ════════════════════════════════════════════════════════
// BAGIAN 10: LPB (PENCOCOKAN STOK FISIK)
// ════════════════════════════════════════════════════════
const LP = { items: [] };
PAGES.lpb = async function () {
  LP.items = [];
  $('app-container').innerHTML = `
  <div class="card-x mb-3"><div class="card-h"><h3>Form LPB — Cocokkan Stok Fisik</h3></div><div class="card-b">
    <div class="row g-3 mb-3">
      <div class="col-md-3 fld"><label for="lpTgl">Tanggal</label><input id="lpTgl" type="date" class="form-control" value="${today()}"></div>
      <div class="col-md-9 fld"><label class="form-label">Tambah barang yang dihitung</label><div id="lpPickWrap"></div></div>
    </div>
    <div id="lpItems"></div>
    <div class="row g-3 align-items-end mt-1">
      <div class="col-md-6 fld"><label for="lpCat">Catatan umum</label><input id="lpCat" class="form-control"></div>
      <div class="col-md-6 d-flex flex-wrap gap-3 align-items-center justify-content-md-end">
        ${role() === 'admin' ? `<label class="d-flex align-items-center gap-2 mb-0" style="font-size:13px"><input type="checkbox" id="lpAdj" class="form-check-input mt-0"> Sesuaikan stok sistem ke stok fisik</label>` : ''}
        <button class="btn-x btn-primary-x" id="lpSave"><i class="bi bi-save"></i> Simpan LPB</button>
      </div>
    </div></div></div>
  <h3 class="h6 mb-2">Riwayat LPB</h3><div id="lpbTable">${skel(3)}</div>`;
  mountLpbPicker(); renderLpbItems();
  $('lpSave').onclick = e => withBtn(e.currentTarget, async () => {
    if (!LP.items.length) throw new Error('Tambahkan minimal satu barang.');
    if (LP.items.some(i => i.fisik === '' || Number(i.fisik) < 0)) throw new Error('Isi stok fisik (tidak boleh kosong/negatif) untuk semua barang.');
    const r = await api('saveLPB', { tanggal: $('lpTgl').value, catatan: $('lpCat').value, sesuaikan: !!($('lpAdj') && $('lpAdj').checked), items: LP.items.map(i => ({ kode: i.Kode, fisik: i.fisik, catatan: i.catatan })) });
    toast('Berhasil', `LPB ${r.noDok} tersimpan. ${r.selisih} item berselisih.`, r.selisih ? 'warning' : 'success');
    PAGES.lpb();
  });
  loadLpbHistory();
};
function mountLpbPicker() {
  $('lpPickWrap').innerHTML = pickerHTML('lpPick');
  initPicker('lpPick', b => { if (!b) return; if (!LP.items.some(i => i.Kode === b.Kode)) LP.items.push({ Kode: b.Kode, Nama: b.Nama, Satuan: b.Satuan, Stok: b.Stok, fisik: '', catatan: '' }); renderLpbItems(); mountLpbPicker(); });
}
function renderLpbItems() {
  $('lpItems').innerHTML = LP.items.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Barang</th><th class="r">Sistem</th><th style="width:130px">Fisik *</th><th class="r">Selisih</th><th class="hide-sm">Catatan</th><th></th></tr></thead><tbody>
    ${LP.items.map((i, k) => `<tr><td><span class="mono">${esc(i.Kode)}</span><div>${esc(i.Nama)}</div></td><td class="r num">${fmt(i.Stok)} ${esc(i.Satuan)}</td>
    <td><input type="number" min="0" step="any" class="form-control" value="${esc(i.fisik)}" oninput="LP.items[${k}].fisik=this.value;updSelisih(${k})" aria-label="Stok fisik ${esc(i.Kode)}"></td>
    <td class="r num" id="lpSel${k}">${selisihHTML(i)}</td><td class="hide-sm"><input class="form-control" value="${esc(i.catatan)}" oninput="LP.items[${k}].catatan=this.value" aria-label="Catatan"></td>
    <td><button class="icon-btn" style="width:32px;height:32px" onclick="LP.items.splice(${k},1);renderLpbItems()" aria-label="Hapus"><i class="bi bi-x-lg"></i></button></td></tr>`).join('')}</tbody></table></div>` : emptyBox('bi-search', 'Cari dan pilih barang untuk dihitung.');
}
function selisihHTML(i) {
  if (i.fisik === '') return '<span class="text-3">-</span>';
  const s = Number(i.fisik) - Number(i.Stok);
  return `<b style="color:${s === 0 ? 'var(--success)' : 'var(--critical)'}">${s > 0 ? '+' : ''}${fmt(s)}</b>`;
}
function updSelisih(k) { $('lpSel' + k).innerHTML = selisihHTML(LP.items[k]); }
async function loadLpbHistory() {
  const el = $('lpbTable'); if (!el) return;
  try {
    const rows = await api('listLPB');
    el.innerHTML = rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>No. Dokumen</th><th>Barang</th><th class="r">Sistem</th><th class="r">Fisik</th><th class="r">Selisih</th><th class="hide-sm">Petugas</th></tr></thead><tbody>
      ${rows.map(x => `<tr><td class="nowrap num">${esc(x.Tanggal)}</td><td class="mono nowrap">${esc(x.NoDok)}</td><td>${esc(x.NamaBarang)}</td><td class="r num">${fmt(x.StokSistem)}</td><td class="r num">${fmt(x.StokFisik)}</td>
      <td class="r num"><b style="color:${Number(x.Selisih) === 0 ? 'var(--success)' : 'var(--critical)'}">${Number(x.Selisih) > 0 ? '+' : ''}${fmt(x.Selisih)}</b>${x.Disesuaikan === 'Y' ? ' <span class="chip info">disesuaikan</span>' : ''}</td><td class="hide-sm">${esc(x.Petugas)}</td></tr>`).join('')}</tbody></table></div>` : emptyBox('bi-journal', 'Belum ada LPB.');
  } catch (e) { el.innerHTML = errBox(e); }
}
