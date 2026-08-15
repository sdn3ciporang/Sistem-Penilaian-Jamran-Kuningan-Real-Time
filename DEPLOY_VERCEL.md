# Panduan Lengkap Deployment ke Vercel (vercel.app)

Aplikasi **Sistem Penilaian Lomba Pramuka Real-Time** telah dirancang dengan arsitektur **Hybrid Cloud (Direct Firebase Client + Serverless Backend)** sehingga **100% seluruh fitur dapat berjalan mulus di Vercel**.

---

### 🌟 Fitur-Fitur yang Siap Berjalan di Vercel:
1. **Input Nilai Real-Time oleh Juri**:
   - Terhubung langsung ke Cloud Firestore (`penilaianjamrankuningan`).
   - Setiap nilai yang disimpan langsung muncul di layar Admin, Rekap, dan Ranking tanpa jeda.
2. **Master Pangkalan & Master Juri**:
   - Tambah, edit, hapus data.
   - **Download Template Excel** & **Import Excel massal** berjalan 100% di browser.
3. **Upload Nilai Massal (Excel Scoring)**:
   - Import file nilai Excel per pos / semua pos sekaligus dengan kalkulasi otomatis.
4. **Pantauan Pos & Real-Time Monitor**:
   - Sinkronisasi instan via Firebase `onSnapshot` listener.
5. **Kalkulasi Juara & Tie-breaker**:
   - Perhitungan Juara Umum, Juara Regu Putra, Juara Regu Putri, dan Juara Favorit.
6. **Cetak & Ekspor Dokumen**:
   - Cetak Kartu QR Juri (PDF), Piagam Juara (PDF), dan Berita Acara Rekap Nilai (Excel/PDF).
7. **Offline Mode & Stopwatch**:
   - Stopwatch presisi milidetik dan penyimpanan otomatis ke antrean lokal jika sinyal internet pos drop.

---

### 🚀 3 Langkah Mudah Deploy ke Vercel:

#### 1. Export Proyek dari AI Studio
- Buka menu **Settings (ikon gear)** di AI Studio (kanan atas).
- Klik **Export to GitHub** (atau unduh sebagai **ZIP** dan push ke akun GitHub Anda).

#### 2. Import Repositori di Vercel
- Kunjungi dashboard **[vercel.com/new](https://vercel.com/new)**.
- Hubungkan akun GitHub Anda dan pilih repositori proyek ini.

#### 3. Konfigurasi Build & Deploy
- Vercel akan otomatis mengenali berkas `vercel.json`:
  - **Framework Preset**: `Vite`
  - **Build Command**: `vite build`
  - **Output Directory**: `dist`
- Klik **Deploy**.

Dalam hitungan detik, aplikasi Anda aktif di URL Vercel (misalnya `https://lomba-pramuka.vercel.app`) dan langsung siap digunakan oleh seluruh juri dan panitia di lapangan!
