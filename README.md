# SIM Gudang

Sistem Informasi Manajemen Gudang: stok, barang masuk/keluar, permintaan & persetujuan, LPB, laporan, barcode.

- **Frontend:** berkas statis (HTML/CSS/JS) di GitHub Pages.
- **Backend:** Google Apps Script (API JSON) + Google Sheets/Drive sebagai database.

## Struktur
```
index.html          halaman utama (harus di root repository)
css/style.css       gaya tampilan
js/config.js        ← satu-satunya berkas yang WAJIB Anda edit (URL backend)
js/api.js           klien API (fetch ke Apps Script)
js/core.js          inti aplikasi, login, dashboard
js/pages-1.js       Barang, Barang Masuk, Permintaan, Barang Keluar, LPB
js/pages-2.js       Laporan, Master Pendukung, Pengaturan
js/barcode.js       scan barcode, label, cetak bukti
PANDUAN-INSTALASI.md
```

## Pemasangan singkat
1. Pasang backend (`Kode.gs`) di Apps Script, Deploy sebagai Web App (Anyone), salin URL `/exec`.
2. Tempel URL itu di `js/config.js`.
3. Push folder ini ke repository GitHub (Public), aktifkan GitHub Pages (branch `main`, folder `/ (root)`).

Langkah lengkap ada di `PANDUAN-INSTALASI.md`.

## Catatan
- Tidak ada kata sandi atau kunci rahasia di repository ini. Data tetap terlindungi login.
- Jalur berkas memakai alamat relatif, jadi situs berjalan di subfolder `https://USERNAME.github.io/NAMA-REPO/`.
- Setelah mengubah berkas, naikkan nomor `?v=` pada `index.html` bila browser masih memuat versi lama.

## Catatan versi
- **2.1.0:** Barang Keluar multi-item. Satu dokumen permintaan menjadi satu transaksi keluar dengan satu nomor BK dan satu bukti cetak yang memuat semua barang (barang bisa dicentang sebagian; bila stok salah satu barang kurang, tidak ada stok yang dipotong). Verifikasi barcode kini per barang.
- **2.0.0:** Migrasi ke GitHub Pages + Google Apps Script REST API.
