# 📋 Changelog - Cron Job Premium Expiry & Soft Lock Implementation

> **Tanggal Implementasi:** 1 Januari 2026  
> **Versi:** DigiSign v2.0

---

## 📁 File yang DIBUAT (Baru)

| File                                       | Deskripsi                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| `src/cron/premiumExpiryJob.js`             | Cron job untuk cek dan downgrade premium expired setiap hari jam 00:05 WIB |
| `src/cron/index.js`                        | Index file untuk inisialisasi semua cron jobs                              |
| `docs/FRONTEND_PREMIUM_IMPLEMENTATION.md`  | Dokumentasi implementasi frontend untuk sistem Premium                     |
| `docs/CRONJOB_IMPLEMENTATION_CHANGELOG.md` | Dokumentasi ini                                                            |

---

## 📝 File yang DIUBAH

### Core Application

| File         | Perubahan                                                   |
| ------------ | ----------------------------------------------------------- |
| `src/app.js` | Import & inisialisasi `initAllCronJobs()` saat server start |

### Services

| File                               | Perubahan                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/services/userService.js`      | Tambah method `getUserQuota()` untuk mengambil info limit & usage                          |
| `src/services/signatureService.js` | Tambah `userService` dependency + method `_checkVersionLimit()` untuk validasi limit versi |
| `src/services/groupService.js`     | Tambah version limit check di `finalizeGroupDocument()`                                    |
| `src/services/packageService.js`   | Tambah version limit check di `signPackage()`                                              |

### Controllers

| File                                 | Perubahan                                                               |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `src/controllers/userController.js`  | Tambah method `getMyQuota`                                              |
| `src/controllers/adminController.js` | Tambah method `triggerPremiumExpiryCheck` untuk manual trigger cron job |

### Routes

| File                        | Perubahan                                          |
| --------------------------- | -------------------------------------------------- |
| `src/routes/userRoutes.js`  | Tambah route `GET /api/users/me/quota`             |
| `src/routes/adminRoutes.js` | Tambah route `POST /api/admin/cron/premium-expiry` |

### Repository

| File                                            | Perubahan                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/repository/prisma/PrismaUserRepository.js` | Tambah method `getUserUsageStats()` untuk menghitung owned groups & personal docs |

---

## 📦 Dependencies Baru

```bash
npm install node-cron
```

**Package:** `node-cron`  
**Versi:** Latest  
**Fungsi:** Scheduling cron jobs dalam Node.js

---

## 🔄 Ringkasan Perubahan per Fitur

### 1. Cron Job Premium Expiry

**Tujuan:** Otomatis downgrade user Premium yang expired ke FREE

**File terkait:**

- `src/cron/premiumExpiryJob.js` - Logic utama cron job
- `src/cron/index.js` - Inisialisasi cron jobs
- `src/app.js` - Integrasi ke server startup

**Jadwal:** Setiap hari jam 00:05 WIB

**Fitur:**

- Cari user PREMIUM dengan `premiumUntil < now`
- Update `userStatus` ke FREE
- Kirim notifikasi WhatsApp ke user yang expired

---

### 2. Endpoint Manual Trigger (Admin Only)

**Tujuan:** Testing cron job tanpa menunggu jadwal

**Endpoint:** `POST /api/admin/cron/premium-expiry`

**File terkait:**

- `src/controllers/adminController.js`
- `src/routes/adminRoutes.js`

**Response:**

```json
{
  "success": true,
  "message": "Premium expiry check executed successfully.",
  "data": {
    "success": true,
    "message": "Berhasil mengupdate 2 user ke FREE tier.",
    "count": 2,
    "users": [{ "email": "user1@test.com", "expiredAt": "2025-12-31T..." }]
  }
}
```

---

### 3. Endpoint Quota Info

**Tujuan:** Frontend bisa mengambil info limit & usage untuk menampilkan progress bar, warning, dll

**Endpoint:** `GET /api/users/me/quota`

**File terkait:**

- `src/services/userService.js`
- `src/controllers/userController.js`
- `src/routes/userRoutes.js`
- `src/repository/prisma/PrismaUserRepository.js`

**Response:**

```json
{
  "status": "success",
  "data": {
    "userStatus": "FREE",
    "premiumUntil": null,
    "isPremiumActive": false,
    "limits": {
      "maxFileSize": 10485760,
      "maxFileSizeLabel": "10 MB",
      "maxVersionsPerDocument": 5,
      "maxOwnedGroups": 1,
      "maxMembersPerGroup": 5,
      "maxDocsPerGroup": 10,
      "maxDocsPerPackage": 3
    },
    "usage": {
      "ownedGroups": 1,
      "totalPersonalDocuments": 8
    },
    "quotaPercentages": {
      "ownedGroups": 100
    }
  }
}
```

---

### 4. Version Limit Check (Soft Lock)

**Tujuan:** Mencegah user FREE membuat lebih dari 5 versi dokumen

**File terkait:**

- `src/services/signatureService.js` - Personal signature
- `src/services/groupService.js` - Group document finalize
- `src/services/packageService.js` - Package batch signing

**Limit:**
| Tier | Max Versi per Dokumen |
|------|----------------------|
| FREE | 5 |
| PREMIUM | 20 |

**Error Message:**

```
"Batas revisi dokumen tercapai (5 versi). Upgrade ke Premium untuk batas 20 versi."
```

---

## 🧪 Testing

### Test Cron Job Manual

```bash
# Via curl
curl -X POST http://localhost:3000/api/admin/cron/premium-expiry \
  -H "Authorization: Bearer <admin_token>"
```

### Test Quota Endpoint

```bash
curl http://localhost:3000/api/users/me/quota \
  -H "Authorization: Bearer <user_token>"
```

### Simulasi Premium Expired

1. Set `premiumUntil` user ke tanggal kemarin di database:

```sql
UPDATE users
SET premium_until = '2025-12-31 00:00:00'
WHERE email = 'test@example.com';
```

2. Trigger cron job manual via endpoint admin
3. Verifikasi user status berubah ke FREE
4. Cek WhatsApp notification terkirim (jika ada nomor HP)

---

## 📊 Tabel Limit FREE vs PREMIUM

| Fitur                   | FREE  | PREMIUM   |
| ----------------------- | ----- | --------- |
| **Ukuran File Upload**  | 10 MB | 50 MB     |
| **Versi per Dokumen**   | 5     | 20        |
| **Grup yang Dimiliki**  | 1     | 10        |
| **Member per Grup**     | 5     | Unlimited |
| **Dokumen per Grup**    | 10    | 100       |
| **Dokumen per Package** | 3     | 20        |

---

## 🔗 Dokumentasi Terkait

- [Frontend Implementation Guide](./FRONTEND_PREMIUM_IMPLEMENTATION.md)

---

_Dokumentasi dibuat pada: 1 Januari 2026_
