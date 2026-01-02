# 📱 Panduan Implementasi Frontend - Premium & Soft Lock

## 📋 Daftar Isi

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Tabel Limit FREE vs PREMIUM](#tabel-limit-free-vs-premium)
4. [Implementasi Komponen](#implementasi-komponen)
5. [Error Handling](#error-handling)
6. [Flow Diagram](#flow-diagram)

---

## Overview

Backend sudah mengimplementasikan sistem **Freemium** dengan strategi **Soft Lock**:

- ✅ **Data lama tetap aman** - User yang downgrade tidak kehilangan data
- ✅ **Limit hanya pada CREATE** - User tidak bisa menambah data baru melebihi limit
- ✅ **Error message deskriptif** - Backend mengembalikan pesan yang bisa langsung ditampilkan
- ✅ **Cron Job otomatis** - Premium yang expired otomatis downgrade ke FREE setiap hari jam 00:05 WIB

---

## API Endpoints

### 1. Get User Quota

Endpoint utama untuk mengambil informasi limit dan usage user.

```http
GET /api/users/me/quota
Authorization: Bearer <token>
```

**Response (FREE User):**

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

**Response (PREMIUM User):**

```json
{
  "status": "success",
  "data": {
    "userStatus": "PREMIUM",
    "premiumUntil": "2026-06-15T00:00:00.000Z",
    "isPremiumActive": true,
    "limits": {
      "maxFileSize": 52428800,
      "maxFileSizeLabel": "50 MB",
      "maxVersionsPerDocument": 20,
      "maxOwnedGroups": 10,
      "maxMembersPerGroup": 999,
      "maxDocsPerGroup": 100,
      "maxDocsPerPackage": 20
    },
    "usage": {
      "ownedGroups": 3,
      "totalPersonalDocuments": 25
    },
    "quotaPercentages": {
      "ownedGroups": 30
    }
  }
}
```

### 2. Get User Profile (includes status)

```http
GET /api/users/me
Authorization: Bearer <token>
```

Response sudah include `userStatus` dan `premiumUntil`.

---

## Tabel Limit FREE vs PREMIUM

| Fitur                   | FREE  | PREMIUM         |
| ----------------------- | ----- | --------------- |
| **Ukuran File Upload**  | 10 MB | 50 MB           |
| **Versi per Dokumen**   | 5     | 20              |
| **Grup yang Dimiliki**  | 1     | 10              |
| **Member per Grup**     | 5     | Unlimited (999) |
| **Dokumen per Grup**    | 10    | 100             |
| **Dokumen per Package** | 3     | 20              |

---

## Implementasi Komponen

### 1. Context Provider (React)

```jsx
// contexts/QuotaContext.jsx
import { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "../utils/api";

const QuotaContext = createContext(null);

export const QuotaProvider = ({ children }) => {
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchQuota = async () => {
    try {
      const response = await apiClient.get("/users/me/quota");
      setQuota(response.data.data);
    } catch (error) {
      console.error("Failed to fetch quota:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuota();
  }, []);

  // Refetch quota setelah aksi yang mengubah usage
  const refreshQuota = () => fetchQuota();

  return <QuotaContext.Provider value={{ quota, loading, refreshQuota }}>{children}</QuotaContext.Provider>;
};

export const useQuota = () => useContext(QuotaContext);
```

### 2. Status Badge Component

```jsx
// components/PremiumBadge.jsx
import { useQuota } from "../contexts/QuotaContext";
import { Crown, User } from "lucide-react";

export const PremiumBadge = () => {
  const { quota, loading } = useQuota();

  if (loading) return <span className="badge badge-ghost">Loading...</span>;

  const isPremium = quota?.isPremiumActive;

  return (
    <span className={`badge ${isPremium ? "badge-warning" : "badge-ghost"} gap-1`}>
      {isPremium ? <Crown size={14} /> : <User size={14} />}
      {quota?.userStatus || "FREE"}
    </span>
  );
};
```

### 3. Quota Progress Bar

```jsx
// components/QuotaProgressBar.jsx
import { useQuota } from "../contexts/QuotaContext";

export const QuotaProgressBar = ({ type, currentValue, label }) => {
  const { quota } = useQuota();

  if (!quota) return null;

  const limitMap = {
    groups: quota.limits.maxOwnedGroups,
    docsPerGroup: quota.limits.maxDocsPerGroup,
    docsPerPackage: quota.limits.maxDocsPerPackage,
    versions: quota.limits.maxVersionsPerDocument,
  };

  const maxValue = limitMap[type] || 10;
  const percentage = Math.min((currentValue / maxValue) * 100, 100);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className={isAtLimit ? "text-error" : isNearLimit ? "text-warning" : ""}>
          {currentValue}/{maxValue}
        </span>
      </div>
      <div className="w-full bg-base-300 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${isAtLimit ? "bg-error" : isNearLimit ? "bg-warning" : "bg-primary"}`} style={{ width: `${percentage}%` }} />
      </div>
      {isNearLimit && !quota.isPremiumActive && (
        <p className="text-xs text-warning mt-1">
          ⚠️ Hampir penuh!{" "}
          <a href="/pricing" className="link">
            Upgrade ke Premium
          </a>
        </p>
      )}
    </div>
  );
};
```

### 4. Disabled Button dengan Tooltip

```jsx
// components/LimitedActionButton.jsx
import { useQuota } from "../contexts/QuotaContext";

export const LimitedActionButton = ({ type, currentValue, onClick, children, ...props }) => {
  const { quota } = useQuota();

  if (!quota)
    return (
      <button disabled {...props}>
        {children}
      </button>
    );

  const limitMap = {
    groups: quota.limits.maxOwnedGroups,
    docsPerGroup: quota.limits.maxDocsPerGroup,
    docsPerPackage: quota.limits.maxDocsPerPackage,
    members: quota.limits.maxMembersPerGroup,
  };

  const maxValue = limitMap[type];
  const isDisabled = currentValue >= maxValue;

  return (
    <div className="tooltip" data-tip={isDisabled ? `Limit tercapai (${maxValue}). Upgrade ke Premium.` : ""}>
      <button onClick={onClick} disabled={isDisabled} className={`btn ${isDisabled ? "btn-disabled" : "btn-primary"}`} {...props}>
        {children}
      </button>
    </div>
  );
};

// Penggunaan:
// <LimitedActionButton type="groups" currentValue={myGroups.length} onClick={createGroup}>
//   Buat Grup Baru
// </LimitedActionButton>
```

### 5. Premium Expiry Warning

```jsx
// components/PremiumExpiryWarning.jsx
import { useQuota } from "../contexts/QuotaContext";
import { differenceInDays, format } from "date-fns";
import { id } from "date-fns/locale";

export const PremiumExpiryWarning = () => {
  const { quota } = useQuota();

  if (!quota?.isPremiumActive || !quota?.premiumUntil) return null;

  const expiryDate = new Date(quota.premiumUntil);
  const daysLeft = differenceInDays(expiryDate, new Date());

  // Tampilkan warning jika <= 7 hari
  if (daysLeft > 7) return null;

  return (
    <div className={`alert ${daysLeft <= 3 ? "alert-error" : "alert-warning"} mb-4`}>
      <div>
        <span>
          ⏰ Langganan Premium Anda akan berakhir dalam <strong>{daysLeft} hari</strong> ({format(expiryDate, "d MMMM yyyy", { locale: id })}).
        </span>
        <a href="/pricing" className="btn btn-sm btn-outline ml-2">
          Perpanjang Sekarang
        </a>
      </div>
    </div>
  );
};
```

### 6. File Size Validation (Before Upload)

```jsx
// hooks/useFileUpload.js
import { useQuota } from "../contexts/QuotaContext";
import { toast } from "react-hot-toast";

export const useFileUpload = () => {
  const { quota } = useQuota();

  const validateFileSize = (file) => {
    if (!quota) return { valid: false, error: "Quota not loaded" };

    const maxSize = quota.limits.maxFileSize;
    const maxSizeLabel = quota.limits.maxFileSizeLabel;

    if (file.size > maxSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return {
        valid: false,
        error: `File terlalu besar (${fileSizeMB} MB). Maksimal ${maxSizeLabel}.${!quota.isPremiumActive ? " Upgrade ke Premium untuk upload hingga 50 MB." : ""}`,
      };
    }

    return { valid: true };
  };

  const handleFileSelect = (file, onValid) => {
    const validation = validateFileSize(file);

    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    onValid(file);
  };

  return { validateFileSize, handleFileSelect, maxFileSize: quota?.limits?.maxFileSize };
};
```

### 7. Upgrade Prompt Modal

```jsx
// components/UpgradePromptModal.jsx
import { useQuota } from "../contexts/QuotaContext";
import { useNavigate } from "react-router-dom";

export const UpgradePromptModal = ({ isOpen, onClose, feature }) => {
  const { quota } = useQuota();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const featureMessages = {
    groups: "Buat hingga 10 grup",
    fileSize: "Upload file hingga 50 MB",
    members: "Undang anggota tanpa batas",
    docs: "Simpan hingga 100 dokumen per grup",
    versions: "Simpan hingga 20 versi per dokumen",
    package: "Tandatangani hingga 20 dokumen sekaligus",
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg">🚀 Upgrade ke Premium</h3>

        <p className="py-4">Anda telah mencapai batas paket FREE. Upgrade ke Premium untuk:</p>

        <ul className="list-disc list-inside space-y-2 mb-4">
          <li className="font-semibold text-primary">{featureMessages[feature]}</li>
          <li>Upload file hingga 50 MB</li>
          <li>Buat hingga 10 grup</li>
          <li>Anggota grup tanpa batas</li>
          <li>100 dokumen per grup</li>
          <li>20 versi per dokumen</li>
        </ul>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Nanti Saja
          </button>
          <button className="btn btn-primary" onClick={() => navigate("/pricing")}>
            Lihat Harga Premium
          </button>
        </div>
      </div>
    </div>
  );
};
```

### 8. Downgrade Notification (Setelah Premium Expired)

```jsx
// components/DowngradeNotification.jsx
import { useEffect, useState } from "react";
import { useQuota } from "../contexts/QuotaContext";

export const DowngradeNotification = () => {
  const { quota } = useQuota();
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // Cek localStorage apakah user pernah premium
    const wasPremium = localStorage.getItem("wasPremium") === "true";

    if (wasPremium && quota?.userStatus === "FREE") {
      setShowNotification(true);
      localStorage.removeItem("wasPremium");
    }

    // Simpan status jika premium
    if (quota?.isPremiumActive) {
      localStorage.setItem("wasPremium", "true");
    }
  }, [quota]);

  if (!showNotification) return null;

  return (
    <div className="alert alert-info shadow-lg mb-4">
      <div>
        <span>
          📢 Langganan Premium Anda telah berakhir. Akun Anda sekarang menggunakan paket FREE.
          <br />
          <small className="opacity-70">Semua data Anda tetap aman. Anda masih bisa mengakses dokumen yang sudah ada.</small>
        </span>
      </div>
      <div className="flex-none">
        <button className="btn btn-sm btn-ghost" onClick={() => setShowNotification(false)}>
          Tutup
        </button>
        <a href="/pricing" className="btn btn-sm btn-primary">
          Perpanjang Premium
        </a>
      </div>
    </div>
  );
};
```

---

## Error Handling

Backend sudah mengembalikan error message yang deskriptif. Frontend cukup menampilkan message tersebut:

```jsx
// utils/errorHandler.js
import { toast } from "react-hot-toast";

export const handleApiError = (error) => {
  const message = error.response?.data?.message || "Terjadi kesalahan";

  // Cek apakah error terkait limit/premium
  const isLimitError = message.includes("Upgrade") || message.includes("limit") || message.includes("batas");

  if (isLimitError) {
    toast.error(message, {
      duration: 5000,
      icon: "🔒",
    });

    // Opsional: Tampilkan upgrade modal
    // showUpgradeModal();
  } else {
    toast.error(message);
  }
};

// Penggunaan di API call:
try {
  await apiClient.post("/groups", { name: "Grup Baru" });
} catch (error) {
  handleApiError(error);
}
```

### Contoh Error Messages dari Backend:

| Error                       | Message                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Buat grup melebihi limit    | "Anda telah mencapai batas pembuatan grup (1 grup). Upgrade ke Premium untuk membuat hingga 10 grup."                         |
| Upload file terlalu besar   | "Ukuran file melebihi batas paket Anda (10MB). Upgrade ke Premium untuk upload hingga 50MB."                                  |
| Dokumen grup penuh          | "Penyimpanan grup penuh (10 dokumen). Upgrade Admin Grup ke Premium untuk kapasitas 100 dokumen."                             |
| Versi dokumen penuh         | "Batas revisi dokumen tercapai (5 versi). Upgrade ke Premium untuk batas 20 versi."                                           |
| Member grup penuh           | "Grup Basic (Free) maksimal hanya boleh memiliki 5 anggota. Upgrade akun Pemilik Grup ke Premium untuk anggota tak terbatas." |
| Package docs melebihi limit | "Maksimal 3 dokumen per paket. Upgrade ke Premium untuk kapasitas lebih besar (hingga 20 dokumen)."                           |

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER LOGIN                                │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GET /api/users/me/quota                       │
│                    (Fetch limit & usage)                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   userStatus = FREE     │     │  userStatus = PREMIUM   │
│   isPremiumActive: false│     │  isPremiumActive: true  │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  Show FREE limits       │     │  Show PREMIUM limits    │
│  - 10MB file            │     │  - 50MB file            │
│  - 1 grup               │     │  - 10 grup              │
│  - 5 member/grup        │     │  - Unlimited member     │
│  - 10 docs/grup         │     │  - 100 docs/grup        │
└───────────┬─────────────┘     └───────────┬─────────────┘
            │                               │
            ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     USER PERFORMS ACTION                         │
│               (Upload, Create Group, Add Member, etc)            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   Within Limit?         │     │   Exceeds Limit?        │
│   ✅ SUCCESS            │     │   ❌ ERROR 403          │
└─────────────────────────┘     └───────────┬─────────────┘
                                            │
                                            ▼
                              ┌─────────────────────────┐
                              │  Show Error Message     │
                              │  + Upgrade CTA          │
                              └─────────────────────────┘
```

### Premium Expiry Flow (Backend Cron Job)

```
┌─────────────────────────────────────────────────────────────────┐
│              CRON JOB (Setiap hari 00:05 WIB)                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│     Cari user dengan:                                            │
│     - userStatus = 'PREMIUM'                                     │
│     - premiumUntil < NOW                                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│     Update userStatus = 'FREE'                                   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│     Kirim WhatsApp Notification:                                 │
│     "Langganan Premium Anda telah berakhir..."                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Checklist Implementasi Frontend

- [ ] Setup `QuotaContext` dan `QuotaProvider`
- [ ] Tambahkan `<PremiumBadge />` di Header/Navbar
- [ ] Tambahkan `<PremiumExpiryWarning />` di Dashboard
- [ ] Tambahkan `<DowngradeNotification />` di Dashboard
- [ ] Implementasi `<QuotaProgressBar />` di halaman Group
- [ ] Implementasi `<LimitedActionButton />` untuk tombol Create
- [ ] Implementasi validasi file size sebelum upload
- [ ] Implementasi error handling untuk limit errors
- [ ] Buat halaman `/pricing` untuk upgrade
- [ ] (Opsional) Buat `<UpgradePromptModal />`

---

## Tips & Best Practices

1. **Fetch quota sekali saat login**, simpan di context/state global
2. **Refresh quota** setelah aksi yang mengubah usage (create group, upload doc, dll)
3. **Validasi di Frontend** untuk UX yang lebih baik, tapi **Backend tetap validasi** untuk keamanan
4. **Cache quota** dengan TTL 5-10 menit untuk mengurangi API calls
5. **Tampilkan warning** saat usage >= 80% dari limit
6. **Disable button** saat limit tercapai, jangan tunggu error dari backend

---

_Dokumentasi ini dibuat pada: 1 Januari 2026_
_Backend Version: DigiSign v2.0 dengan Premium/Freemium System_
