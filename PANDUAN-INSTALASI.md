# Panduan Instalasi SIM Gudang (GitHub Pages + Google Apps Script)

Urutan: **A. Backend** → **B. Frontend** → **C. Pembaruan** → **D. Jika ada masalah**.
Kerjakan satu langkah, pastikan hasilnya sesuai, baru lanjut.

---

## A. Backend (Google Apps Script)

Anda memakai proyek Apps Script SIM Gudang yang sudah ada, jadi **data lama tidak berubah**.

1. Buka proyek Apps Script SIM Gudang di https://script.google.com.
2. Buka file `Kode`. Tekan Ctrl+A, Delete, lalu tempel seluruh isi `Kode.gs` (versi baru dari folder `sim-gudang-backend`). Simpan (Ctrl+S).
3. Buka **Project Settings** (ikon roda gigi), centang **Show "appsscript.json" manifest file in editor**. Buka `appsscript.json`, ganti isinya dengan `appsscript.json` dari folder `sim-gudang-backend`, lalu simpan.
4. Pilih fungsi `setupAppEnvironment` di menu fungsi, klik **Run**. Aman dijalankan ulang: tidak membuat data ganda dan hanya mencatat ID spreadsheet/folder di sheet `AppConfig`. Izinkan akses bila diminta.
5. **Deploy → Manage deployments → ikon pensil → Version: New version → Deploy.**
   Pastikan: *Execute as: Me* dan *Who has access: Anyone*.
   Bila Anda memakai deployment yang sama, alamat `/exec` **tidak berubah**. Salin URL Web app (berakhiran `/exec`).
6. **Tes backend:** buka `URL_ANDA/exec?action=ping` di browser. Hasil yang benar:
   `{"success":true,"data":{"app":"SIM Gudang","versi":"2.0",...},"message":"OK"}`
   - Diminta masuk akun Google → akses belum *Anyone* (ulangi langkah 5).
   - Halaman HTML/galat → URL bukan yang berakhiran `/exec`, atau versi baru belum di-Deploy.
7. Setelah GitHub Pages berjalan (bagian B), file lama boleh dihapus dari proyek Apps Script: `Index`, `Stylesheet`, `JS_Core`, `JS_Halaman1`, `JS_Halaman2`, `JS_Barcode`. Tidak terpakai lagi.

---

## B. Frontend (GitHub Pages)

### B1. Isi alamat backend
Buka `js/config.js`, ganti `PASTE_URL_EXEC_DI_SINI` dengan URL `/exec` dari langkah A5 (tetap di dalam tanda kutip). Simpan.

### B2. Pasang Git
Unduh dari https://git-scm.com (Windows: terima pilihan bawaan). Buka terminal baru (Windows: Git Bash atau PowerShell), cek:
```
git --version
```
Atur identitas (sekali saja):
```
git config --global user.name "Nama Anda"
git config --global user.email "email@anda.com"
```

### B3. Buat repository di GitHub
1. Masuk https://github.com → tombol **+** → **New repository**.
2. Nama: `sim-gudang` (huruf kecil, tanpa spasi). Pilih **Public**.
3. **Jangan** centang README/.gitignore/license. Klik **Create repository**.

### B4. Unggah dari terminal
Ekstrak ZIP. **Folder hasil ekstrak (yang berisi `index.html`) adalah folder yang Anda pakai di sini.**
```
cd "C:\jalur\ke\sim-gudang"
git init
git add .
git commit -m "SIM Gudang: versi pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/sim-gudang.git
git push -u origin main
```
Ganti `USERNAME` dengan nama pengguna GitHub Anda. Saat diminta kata sandi, GitHub tidak menerima kata sandi akun, gunakan **Personal Access Token**:
GitHub → foto profil → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)** → centang scope **repo** → Generate → salin token (hanya tampil sekali) → tempel sebagai kata sandi.

### B5. Aktifkan GitHub Pages
Repository → **Settings → Pages** → *Source: Deploy from a branch* → Branch **main**, folder **/ (root)** → **Save**.
Tunggu 1–2 menit, muat ulang halaman Settings → Pages sampai muncul alamat situs:
`https://USERNAME.github.io/sim-gudang/`

### B6. Tes
Buka alamat itu. Di bawah tombol Masuk harus tampil **"Server terhubung"** berwarna hijau. Masuk dengan akun Anda.
**Segera ganti password semua akun awal** (admin123, staff123, dst.) lewat menu Ganti Password dan Pengaturan, karena aplikasi kini dapat dijangkau dari internet.

---

## C. Pembaruan berikutnya
Setelah mengubah berkas di folder:
```
git add .
git commit -m "pesan perubahan"
git push
```
Tunggu 1–2 menit, lalu tekan **Ctrl+Shift+R** di browser. Bila browser masih memuat berkas lama, naikkan nomor `?v=2.0.0` di `index.html`.
Perubahan di `Kode.gs` (backend) tidak lewat GitHub: tempel di Apps Script lalu **Deploy → New version**.

---

## D. Jika ada masalah

| Gejala | Penyebab & solusi |
|---|---|
| Situs 404 di GitHub Pages | `index.html` harus di root repository (bukan di dalam subfolder). Cek di GitHub: `index.html` terlihat langsung di halaman utama repo. Pastikan Pages memakai branch `main` dan folder `/ (root)`. |
| "Alamat backend belum diisi" | `js/config.js` belum diganti. Isi, simpan, push. |
| "Tidak dapat menghubungi server" | URL di `config.js` salah/terpotong, atau internet putus. Buka `URL/exec?action=ping` langsung di browser. |
| "Backend membalas halaman HTML" | Akses deployment bukan *Anyone*, URL bukan `/exec`, atau versi baru belum di-Deploy. Ulangi A5. |
| "Berkas gagal dimuat: js/..." | Berkas belum terunggah atau huruf besar/kecil namanya berbeda (GitHub peka huruf besar/kecil). Cek di repository. |
| `Authentication failed` saat push | Gunakan Personal Access Token (lihat B4), bukan kata sandi akun. |
| `remote origin already exists` | `git remote set-url origin https://github.com/USERNAME/sim-gudang.git` |
| `rejected ... fetch first` | Repo GitHub berisi berkas yang tidak ada di komputer. Jika repo masih kosong/baru: `git push -u origin main --force`. |
| Kamera barcode tidak mau menyala | Browser meminta izin kamera: pilih *Izinkan*. Situs harus lewat `https://` (GitHub Pages sudah https). |
| Login terkunci | Setelah 5 kali salah, akun terkunci 15 menit. Tunggu, lalu coba lagi. |

---

## Catatan keamanan
- Repository **Public** hanya berisi kode tampilan dan alamat API. Tidak ada kata sandi atau kunci rahasia. Data tetap terlindungi login dan pengecekan hak akses di server.
- Alamat `/exec` bukan rahasia, tetapi tanpa akun yang sah orang lain tidak dapat membaca data.
- Jangan memasukkan data pribadi atau kata sandi ke dalam berkas repository.
