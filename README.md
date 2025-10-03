# Signify - Aplikasi Tanda Tangan Digital ✍️

Selamat datang di **Signify**!
Platform modern untuk mengelola dan menandatangani dokumen secara digital dengan **aman, cepat, dan efisien**. Proyek ini menghilangkan kebutuhan cetak–tanda tangan–scan, dan menggantinya dengan alur kerja digital yang terverifikasi.

---

## ✨ Fitur Utama
- **Autentikasi Pengguna**: Login & registrasi aman menggunakan **Supabase Auth**.
- **Manajemen Profil**: Update email, username, dan foto profil.
- **Upload & Kelola Dokumen**: Unggah dokumen PDF, lihat status, dan riwayat versi.
- **Tanda Tangan Digital**: Proses penandatanganan dokumen dengan hashing & verifikasi.
- **Workspace Kolaboratif**: Berbagi dokumen dan tanda tangan bersama tim.
- **Keamanan**: JWT untuk autentikasi sesi, hashing & validasi integritas dokumen.

---

## 🛠️ Stack Teknologi

### Backend
- **[Node.js](https://nodejs.org/)** – runtime JavaScript.
- **[Express.js](https://expressjs.com/)** – framework backend untuk routing & middleware.
- **[Prisma ORM](https://www.prisma.io/)** – ORM untuk PostgreSQL.
- **[PostgreSQL](https://www.postgresql.org/)** – database relasional.
- **[Supabase](https://supabase.com/)** – layanan Auth & File Storage.

### Frontend
- **[React.js](https://react.dev/)** – framework frontend.
- **[React Router](https://reactrouter.com/)** – manajemen routing.
- **[Axios](https://axios-http.com/)** – HTTP client.
- **[Tailwind CSS](https://tailwindcss.com/)** – styling utility-first.

📌 Frontend repo: [Signify Frontend](https://github.com/indraagstin025/Proyek-3_Digital-Signature-Frontend)

### Tools
- **Git** – version control.
- **Nodemon** – auto restart server saat development.
- **dotenv** – konfigurasi environment variables.

---

### Langkah-langkah Instalasi

1.  **Clone Repository**
    Buka terminal Anda dan clone repository ini ke mesin lokal Anda.
    ```bash
    git clone https://github.com/indraagstin025/Proyek-3_Digital-Signature.git
    cd nama-folder-proyek
    ```

2.  **Instal Dependensi (Termasuk Express)**
    Jalankan perintah berikut di folder utama proyek. Perintah ini akan membaca file `package.json` dan menginstal semua library yang dibutuhkan, **termasuk Express.js** dan semua dependensi lainnya untuk backend dan frontend.

    ```bash
    npm install
    ```

3.  **Konfigurasi Environment Variable**
    Proyek ini membutuhkan beberapa kunci API dan konfigurasi database yang disimpan dalam file `.env`.

    * Salin file `.env.example` menjadi file baru bernama `.env`:
        ```bash
        cp .env.example .env
        ```
    * Buka file `.env` yang baru dibuat dan isi nilainya sesuai dengan konfigurasi Anda:
        ```env
        # URL koneksi ke database PostgreSQL Anda
        DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
        SUPABASE_URL="URL_SUPABASE_ANDA"
        

        # Kunci dari proyek Supabase Anda
        VITE_SUPABASE_URL="URL_PROYEK_SUPABASE_ANDA"
        VITE_SUPABASE_ANON_KEY="KUNCI_ANON_SUPABASE_ANDA"
        ```

4.  **Migrasi Database**
    Jalankan perintah Prisma berikut untuk menerapkan skema database dan membuat tabel-tabel yang diperlukan.
    ```bash
    npx prisma migrate dev
    ```

### Menjalankan Proyek

Setelah instalasi dan konfigurasi selesai, Anda bisa menjalankan server development.

```bash
npm run dev
```

Server backend akan berjalan (biasanya di `http://localhost:3000`) dan frontend akan dapat diakses (biasanya di `http://localhost:5173` atau port lain yang ditentukan oleh Vite/React). Buka browser Anda dan akses URL frontend untuk melihat aplikasi berjalan.

---
## 📄 Lisensi

Proyek ini dilisensikan di bawah Lisensi MIT.