/**
 * @swagger
 * components:
 *   schemas:
 *
 *     # ========== ENUMS & VALUE LISTS ==========
 *
 *     DocumentStatus:
 *       type: string
 *       enum:
 *         - draft
 *         - pending
 *         - completed
 *         - archived
 *       description: |
 *         Status dokumen dalam lifecycle:
 *
 *         - **draft**: Dokumen baru, belum di-upload atau belum siap untuk ditandatangani
 *         - **pending**: Dokumen di-upload dan menunggu proses signature (signer diminta menandatangani)
 *         - **completed**: Semua tanda tangan sudah diterima, dokumen final
 *         - **archived**: Dokumen sudah disimpan ke archive storage (readonly)
 *       example: "pending"
 *
 *     DocumentType:
 *       type: string
 *       enum:
 *         - Contract
 *         - Agreement
 *         - Invoice
 *         - Receipt
 *         - Certificate
 *         - Report
 *         - Letter
 *         - General
 *       description: |
 *         Tipe/kategori dokumen:
 *
 *         - **Contract**: Perjanjian/kontrak bisnis
 *         - **Agreement**: Kesepakatan/memorandum
 *         - **Invoice**: Faktur/tagihan
 *         - **Receipt**: Bukti terima/kwitansi
 *         - **Certificate**: Sertifikat/dokumen penghargaan
 *         - **Report**: Laporan/dokumentasi
 *         - **Letter**: Surat resmi
 *         - **General**: Dokumen umum/tidak terklasifikasi
 *       example: "Contract"
 *
 *     UserStatus:
 *       type: string
 *       enum:
 *         - FREE
 *         - PREMIUM
 *         - ENTERPRISE
 *       description: |
 *         Status subscription user:
 *
 *         - **FREE**: Plan gratis dengan batasan fitur (quota limit)
 *         - **PREMIUM**: Subscription berbayar dengan akses expanded
 *         - **ENTERPRISE**: Enterprise plan dengan support dedicated
 *       example: "PREMIUM"
 *
 *     GroupMemberRole:
 *       type: string
 *       enum:
 *         - admin_group
 *         - signer
 *         - viewer
 *       description: |
 *         Peran member dalam group:
 *
 *         - **admin_group**: Admin group (bisa manage members & documents)
 *         - **signer**: Member yang bisa menandatangani dokumen
 *         - **viewer**: Viewer only (read-only access)
 *       example: "signer"
 *
 *     InvitationStatus:
 *       type: string
 *       enum:
 *         - active
 *         - used
 *         - expired
 *       description: |
 *         Status invitation token:
 *
 *         - **active**: Token masih berlaku dan bisa digunakan
 *         - **used**: Token sudah digunakan untuk join group
 *         - **expired**: Token sudah kadaluarsa (past expiresAt date)
 *       example: "active"
 *
 *     SignatureStatus:
 *       type: string
 *       enum:
 *         - PENDING
 *         - SIGNED
 *         - REJECTED
 *       description: |
 *         Status signature request (untuk group document signing):
 *
 *         - **PENDING**: Menunggu signer menandatangani
 *         - **SIGNED**: Sudah ditandatangani oleh signer
 *         - **REJECTED**: Ditolak oleh signer
 *       example: "PENDING"
 *
 *     SigningMethod:
 *       type: string
 *       enum:
 *         - canvas
 *         - qrcode
 *       description: |
 *         Metode pembuatan signature:
 *
 *         - **canvas**: Drawn signature (user menggambar di canvas/touchpad)
 *         - **qrcode**: QR Code verification (user scan QR code dari dokumen fisik untuk verification online)
 *       example: "canvas"
 *
 *     SignatureDraftStatus:
 *       type: string
 *       enum:
 *         - draft
 *         - finalized
 *       description: |
 *         Status draft signature:
 *
 *         - **draft**: Signature masih dalam draft, bisa di-update/delete
 *         - **finalized**: Signature final, tidak bisa di-update/delete
 *       example: "finalized"
 *
 *     PackageStatus:
 *       type: string
 *       enum:
 *         - draft
 *         - in_progress
 *         - completed
 *       description: |
 *         Status package/envelope batch signing:
 *
 *         - **draft**: Package baru, dokumen belum mulai signed
 *         - **in_progress**: Sedang dalam proses signing
 *         - **completed**: Semua dokumen dalam package sudah signed
 *       example: "in_progress"
 *
 *     TransactionStatus:
 *       type: string
 *       enum:
 *         - PENDING
 *         - COMPLETED
 *         - CANCELLED
 *         - EXPIRED
 *       description: |
 *         Status transaksi pembayaran (dari Midtrans):
 *
 *         - **PENDING**: User sedang dalam proses pembayaran (belum selesai)
 *         - **COMPLETED**: Pembayaran berhasil (settlement dari Midtrans)
 *         - **CANCELLED**: User membatalkan atau payment gateway reject
 *         - **EXPIRED**: Request pembayaran kadaluarsa
 *       example: "COMPLETED"
 *
 *     PlanType:
 *       type: string
 *       enum:
 *         - starter
 *         - professional
 *         - enterprise
 *       description: |
 *         Tipe subscription plan:
 *
 *         - **starter**: Plan entry-level untuk individual/startup
 *         - **professional**: Plan mid-tier untuk SME/team
 *         - **enterprise**: Plan premium untuk enterprise dengan SLA
 *       example: "professional"
 *
 *     AuditAction:
 *       type: string
 *       enum:
 *         - CREATE_USER
 *         - UPDATE_USER
 *         - DELETE_USER
 *         - FORCE_DELETE_DOCUMENT
 *         - LOGIN
 *         - LOGOUT
 *         - UPDATE_GROUP
 *         - SIGN_DOCUMENT_PERSONAL
 *         - SIGN_DOCUMENT_GROUP
 *         - SIGN_PACKAGE
 *         - TRANSACTION_SUCCESS
 *         - TRANSACTION_CANCELLED
 *       description: |
 *         Tipe action yang di-audit untuk compliance tracking:
 *
 *         - **CREATE_USER**: Admin membuat user baru
 *         - **UPDATE_USER**: User update profile atau admin update user
 *         - **DELETE_USER**: Admin delete user account
 *         - **FORCE_DELETE_DOCUMENT**: Admin force delete dokumen
 *         - **LOGIN**: User login ke sistem
 *         - **LOGOUT**: User logout dari sistem
 *         - **UPDATE_GROUP**: Update group information
 *         - **SIGN_DOCUMENT_PERSONAL**: User tandatangani dokumen personal
 *         - **SIGN_DOCUMENT_GROUP**: User tandatangani dokumen dalam group
 *         - **SIGN_PACKAGE**: User tandatangani package dokumen
 *         - **TRANSACTION_SUCCESS**: Transaksi pembayaran berhasil
 *         - **TRANSACTION_CANCELLED**: Transaksi pembayaran dibatalkan
 *       example: "SIGN_DOCUMENT_PERSONAL"
 *
 *     HttpMethod:
 *       type: string
 *       enum:
 *         - GET
 *         - POST
 *         - PUT
 *         - PATCH
 *         - DELETE
 *         - HEAD
 *         - OPTIONS
 *       description: HTTP method untuk API request
 *       example: "POST"
 *
 *     # ========== RESPONSE STATUS CODES ==========
 *
 *     HttpStatusCode:
 *       type: integer
 *       description: |
 *         HTTP response status code:
 *
 *         **2xx Success:**
 *         - 200: OK - Request berhasil
 *         - 201: Created - Resource berhasil dibuat
 *         - 204: No Content - Request berhasil tapi no response body
 *
 *         **4xx Client Error:**
 *         - 400: Bad Request - Validasi input gagal
 *         - 401: Unauthorized - Autentikasi diperlukan
 *         - 403: Forbidden - Akses ditolak
 *         - 404: Not Found - Resource tidak ditemukan
 *         - 409: Conflict - Conflict dengan state saat ini
 *         - 422: Unprocessable Entity - Logika bisnis validation gagal
 *         - 429: Too Many Requests - Rate limit tercapai
 *
 *         **5xx Server Error:**
 *         - 500: Internal Server Error - Error di server
 *         - 503: Service Unavailable - Server maintenance/overload
 *       example: 200
 *
 *     # ========== COMMON VALUE CONSTANTS ==========
 *
 *     Boolean:
 *       type: boolean
 *       description: Nilai boolean (true/false)
 *       example: true
 *
 *     UUID:
 *       type: string
 *       format: uuid
 *       description: |
 *         UUID (Universally Unique Identifier) v4 format:
 *         8-4-4-4-12 hexadecimal digits
 *       example: "550e8400-e29b-41d4-a716-446655440000"
 *
 *     Email:
 *       type: string
 *       format: email
 *       description: Email address (valid RFC 5322)
 *       example: "user@example.com"
 *
 *     PhoneNumber:
 *       type: string
 *       description: Phone number (international format recommended)
 *       example: "+6281234567890"
 *
 *     DateTime:
 *       type: string
 *       format: date-time
 *       description: ISO 8601 datetime format with timezone
 *       example: "2025-01-09T10:30:45Z"
 *
 *     Date:
 *       type: string
 *       format: date
 *       description: ISO 8601 date format (YYYY-MM-DD)
 *       example: "2025-01-09"
 *
 *     Timestamp:
 *       type: integer
 *       description: Unix timestamp (seconds since epoch)
 *       example: 1736418645
 *
 *     ByteSize:
 *       type: integer
 *       description: File/data size in bytes
 *       example: 1048576
 *       format: int64
 *
 *     PercentageInteger:
 *       type: integer
 *       description: Percentage value (0-100)
 *       minimum: 0
 *       maximum: 100
 *       example: 75
 *
 *     Latitude:
 *       type: number
 *       format: double
 *       description: Latitude coordinate (-90 to 90)
 *       example: -6.2088
 *
 *     Longitude:
 *       type: number
 *       format: double
 *       description: Longitude coordinate (-180 to 180)
 *       example: 106.8456
 *
 *     # ========== COMMON REGEX PATTERNS ==========
 *
 *     PasswordRequirements:
 *       type: string
 *       description: |
 *         Password requirements (regex pattern):
 *         - Minimum 8 characters
 *         - Minimum 1 uppercase letter (A-Z)
 *         - Minimum 1 lowercase letter (a-z)
 *         - Minimum 1 digit (0-9)
 *         - Minimum 1 special character (!@#$%^&*)
 *       pattern: '^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$'
 *       example: "SecurePass123!"
 *
 *     PhoneNumberPattern:
 *       type: string
 *       description: |
 *         Phone number pattern:
 *         - Accept international format (+xx)
 *         - Accept Indonesia format (62xx or 0xx)
 *       pattern: '^(\+62|62|0)[0-9]{9,12}$'
 *       example: "+6281234567890"
 *
 *     # ========== COLLECTION & PAGINATION SIZES ==========
 *
 *     DefaultPageSize:
 *       type: integer
 *       description: Default items per page jika tidak dispesifikasi
 *       enum: [20]
 *       example: 20
 *
 *     MaxPageSize:
 *       type: integer
 *       description: Maximum items per page untuk prevent abuse
 *       enum: [100]
 *       example: 100
 *
 *     MaxUploadFileSize:
 *       type: integer
 *       description: Maximum file upload size dalam bytes (50MB)
 *       enum: [52428800]
 *       example: 52428800
 *
 *     MaxBatchSize:
 *       type: integer
 *       description: Maximum items dalam batch operation
 *       enum: [1000]
 *       example: 1000
 */

export default {};
