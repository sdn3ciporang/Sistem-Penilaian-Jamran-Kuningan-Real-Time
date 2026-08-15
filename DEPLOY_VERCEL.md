# Panduan Deployment & Koneksi Cloud Firestore di Vercel

Aplikasi **Sistem Penilaian Lomba Pramuka Real-Time** kini telah dikonfigurasi dengan arsitektur **Direct Cloud Firestore Client**, sehingga setelah dipublikasikan/dideploy ke **Vercel** (maupun hosting lainnya), aplikasi **tetap 100% terhubung langsung ke Google Cloud Firestore (`penilaianjamrankuningan`) secara real-time** tanpa memerlukan backend terpisah dan bebas dari error server.

---

### ✨ Peningkatan yang Diterapkan:
1. **Direct Google Cloud Firestore Integration (`firebaseClient.ts`)**:
   - Web browser juri dan admin terhubung langsung ke Firebase Firestore menggunakan SDK resmi Firebase v12.
   - Master data (55 pangkalan, daftar pos lomba, akun juri, dan skor) otomatis disinkronkan secara aman.
2. **Real-time Live Sync Antar-Perangkat**:
   - Menggunakan listener `onSnapshot` Firestore, sehingga setiap juri menginput nilai dari HP di lapangan, layar Dashboard Admin, Rekap, Ranking, dan Pantauan Pos di laptop/proyektor langsung terupdate seketika (*live real-time*).
3. **Pencegahan Error JSON (`Unexpected token 'A'`)**:
   - Pemanggilan data dilengkapi *safe parsing* dan fallback otomatis ke Cloud Firestore saat endpoint `/api` serverless tidak aktif di Vercel.
4. **Offline Resilience**:
   - Jika jaringan internet di pos terputus sejenak, nilai tetap tersimpan aman di penyimpanan lokal HP dan otomatis terkirim saat internet kembali aktif.

---

### 🚀 Cara Deploy ke Vercel (vercel.app)

#### Langkah 1: Export Project dari AI Studio
1. Klik menu **Settings (ikon gear)** di pojok kanan atas AI Studio.
2. Pilih **Export to GitHub** (atau **Download ZIP** lalu unggah ke repositori GitHub Anda).

#### Langkah 2: Deploy di Vercel
1. Buka [https://vercel.com/new](https://vercel.com/new) dan login.
2. Pilih repositori GitHub proyek penilaian ini.
3. Pengaturan build di Vercel:
   - **Framework Preset**: `Vite`
   - **Build Command**: `vite build`
   - **Output Directory**: `dist`
4. Klik **Deploy**.

Aplikasi Anda akan langsung online (contoh: `https://penilaian-pramuka.vercel.app`) dan **langsung terhubung penuh dengan Cloud Firestore**.
