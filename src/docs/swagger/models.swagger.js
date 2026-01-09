/**
 * @swagger
 * components:
 *   schemas:
 *
 *     # ========== USER & PROFILE ==========
 *
 *     User:
 *       type: object
 *       description: Model pengguna aplikasi DigiSign
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *           description: UUID identifier unik user
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *           description: Email unik user (primary login identifier)
 *         name:
 *           type: string
 *           example: "John Doe"
 *           description: Nama lengkap user
 *         phoneNumber:
 *           type: string
 *           nullable: true
 *           example: "+6281234567890"
 *           description: Nomor telepon user (optional)
 *         title:
 *           type: string
 *           nullable: true
 *           example: "CEO"
 *           description: Jabatan/title user di perusahaan
 *         company:
 *           type: string
 *           nullable: true
 *           example: "PT Innovate Indonesia"
 *           description: Nama perusahaan user
 *         address:
 *           type: string
 *           nullable: true
 *           description: Alamat user
 *         profilePictureUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *           example: "https://storage.example.com/avatars/user123.jpg"
 *           description: URL foto profil user (formatted dengan signed URL jika dari storage)
 *         isSuperAdmin:
 *           type: boolean
 *           example: false
 *           description: Flag apakah user adalah super admin
 *         userStatus:
 *           type: string
 *           enum: [FREE, PREMIUM, ENTERPRISE]
 *           example: "FREE"
 *           description: Status subscription user
 *         premiumUntil:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-12-31T23:59:59Z"
 *           description: Tanggal kadaluarsa premium subscription
 *         tourProgress:
 *           type: object
 *           example: { "documentCreation": true, "groupInvitation": false }
 *           description: JSON object tracking status tutorial/onboarding user
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2025-01-09T10:30:00Z"
 *           description: Timestamp pembuatan akun
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2025-01-09T15:45:00Z"
 *           description: Timestamp update profil terakhir
 *
 *     UserProfilePicture:
 *       type: object
 *       description: History/riwayat foto profil user
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: UUID identifier unik photo record
 *         userId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User
 *         url:
 *           type: string
 *           format: uri
 *           example: "https://storage.example.com/avatars/photo123.jpg"
 *           description: URL foto yang sudah di-format
 *         hash:
 *           type: string
 *           example: "a1b2c3d4e5f6..."
 *           description: Hash foto untuk duplicate detection
 *         isActive:
 *           type: boolean
 *           example: true
 *           description: Apakah foto ini sedang aktif sebagai profil utama
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp upload foto
 *
 *     # ========== DOCUMENT & VERSIONS ==========
 *
 *     Document:
 *       type: object
 *       description: Model dokumen yang akan ditandatangani
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: UUID identifier unik dokumen
 *         title:
 *           type: string
 *           example: "Kontrak Kerjasama 2025"
 *           description: Judul dokumen
 *         status:
 *           type: string
 *           enum: [draft, pending, completed, archived]
 *           example: "pending"
 *           description: Status dokumen (draft=belum upload, pending=waiting signature, dll)
 *         type:
 *           type: string
 *           example: "Contract"
 *           description: Tipe dokumen (Contract, Agreement, Invoice, dll)
 *         userId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User (pemilik dokumen)
 *         groupId:
 *           type: integer
 *           nullable: true
 *           description: Foreign key ke Group (jika dokumen dibuat dalam group context)
 *         currentVersionId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: Foreign key ke DocumentVersion (versi aktif saat ini)
 *         signedFileUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL file dokumen yang sudah ditandatangani (signed/final)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp pembuatan dokumen
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp update dokumen terakhir
 *
 *     DocumentVersion:
 *       type: object
 *       description: Versi/revisi dokumen (support version control)
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: UUID identifier unik version
 *         documentId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke Document
 *         url:
 *           type: string
 *           format: uri
 *           example: "https://storage.example.com/documents/v1/doc123.pdf"
 *           description: URL file PDF di storage
 *         hash:
 *           type: string
 *           example: "sha256hash..."
 *           description: Hash file untuk integrity verification
 *         signedFileHash:
 *           type: string
 *           nullable: true
 *           description: Hash file PDF yang sudah signed (untuk verifikasi)
 *         digitalSignature:
 *           type: string
 *           nullable: true
 *           description: Digital signature data (encoded/serialized)
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Updated terms and conditions"
 *           description: Deskripsi perubahan di versi ini
 *         userId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: User yang upload versi ini
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp upload versi
 *
 *     # ========== SIGNATURES (PERSONAL & GROUP) ==========
 *
 *     SignaturePersonal:
 *       type: object
 *       description: Tanda tangan digital pada dokumen secara personal/mandiri
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: UUID identifier unik signature
 *         documentVersionId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke DocumentVersion
 *         signerId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User (yang menandatangani)
 *         method:
 *           type: string
 *           enum: [canvas, qrcode]
 *           example: "canvas"
 *           description: Metode pembuatan signature (canvas=drawn, qrcode=via QR scan)
 *         signatureImageUrl:
 *           type: string
 *           format: uri
 *           description: Base64 atau URL gambar tanda tangan
 *         qrCodeDataUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL QR Code untuk verifikasi (ditampilkan di dokumen)
 *         positionX:
 *           type: number
 *           example: 100.5
 *           description: Posisi X di halaman (pixel)
 *         positionY:
 *           type: number
 *           example: 200.75
 *           description: Posisi Y di halaman (pixel)
 *         pageNumber:
 *           type: integer
 *           example: 1
 *           description: Nomor halaman tempat signature ditempatkan
 *         width:
 *           type: number
 *           example: 150
 *           description: Lebar signature di PDF (pixel)
 *         height:
 *           type: number
 *           example: 75
 *           description: Tinggi signature di PDF (pixel)
 *         displayQrCode:
 *           type: boolean
 *           example: true
 *           description: Apakah QR Code ditampilkan di dokumen
 *         status:
 *           type: string
 *           enum: [draft, finalized]
 *           example: "finalized"
 *           description: Status signature (draft=belum final, finalized=sudah ditandatangani)
 *         accessCode:
 *           type: string
 *           nullable: true
 *           example: "123456"
 *           description: PIN/access code untuk proteksi dokumen (optional)
 *         retryCount:
 *           type: integer
 *           example: 0
 *           description: Counter percobaan PIN yang salah
 *         lockedUntil:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Timestamp sampai kapan dokumen terkunci (rate limiting)
 *         signedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp tanda tangan dibuat
 *         ipAddress:
 *           type: string
 *           example: "192.168.1.1"
 *           nullable: true
 *           description: IP address penandatangan (audit trail)
 *         userAgent:
 *           type: string
 *           nullable: true
 *           description: User agent browser penandatangan (audit trail)
 *         signerPublicKey:
 *           type: string
 *           nullable: true
 *           description: Public key untuk signature verification
 *
 *     SignatureGroup:
 *       type: object
 *       description: Tanda tangan dalam konteks group document signing workflow
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: UUID identifier unik
 *         documentVersionId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke DocumentVersion
 *         signerId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User (penandatangan dalam group)
 *         method:
 *           type: string
 *           enum: [canvas, qrcode]
 *           description: Metode pembuatan signature
 *         signatureImageUrl:
 *           type: string
 *           format: uri
 *           description: URL gambar signature
 *         positionX:
 *           type: number
 *           description: Posisi X di halaman
 *         positionY:
 *           type: number
 *           description: Posisi Y di halaman
 *         pageNumber:
 *           type: integer
 *           description: Nomor halaman
 *         width:
 *           type: number
 *         height:
 *           type: number
 *         status:
 *           type: string
 *           enum: [draft, finalized]
 *           description: Status signature
 *         accessCode:
 *           type: string
 *           nullable: true
 *         retryCount:
 *           type: integer
 *         lockedUntil:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         signedAt:
 *           type: string
 *           format: date-time
 *         ipAddress:
 *           type: string
 *           nullable: true
 *         userAgent:
 *           type: string
 *           nullable: true
 *
 *     # ========== PACKAGES (BATCH SIGNING) ==========
 *
 *     SigningPackage:
 *       type: object
 *       description: Paket/envelope yang berisi multiple dokumen untuk batch signing
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: UUID identifier unik package
 *         title:
 *           type: string
 *           example: "Batch Signing Q1 2025"
 *           nullable: true
 *           description: Judul paket
 *         status:
 *           type: string
 *           enum: [draft, in_progress, completed]
 *           example: "completed"
 *           description: Status paket signing
 *         userId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User (pemilik paket)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp pembuatan paket
 *
 *     PackageDocument:
 *       type: object
 *       description: Dokumen individual dalam sebuah signing package
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         packageId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke SigningPackage
 *         docVersionId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke DocumentVersion
 *         order:
 *           type: integer
 *           example: 1
 *           description: Urutan dokumen dalam paket
 *
 *     PackageSignature:
 *       type: object
 *       description: Tanda tangan untuk dokumen dalam package context
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         packageDocumentId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke PackageDocument
 *         signerId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User (penandatangan)
 *         signatureImageUrl:
 *           type: string
 *           format: uri
 *           description: URL gambar signature
 *         positionX:
 *           type: number
 *           description: Posisi X di halaman
 *         positionY:
 *           type: number
 *           description: Posisi Y di halaman
 *         pageNumber:
 *           type: integer
 *           description: Nomor halaman tempat signature
 *         width:
 *           type: number
 *         height:
 *           type: number
 *         status:
 *           type: string
 *           enum: [draft, signed]
 *           description: Status signature
 *         accessCode:
 *           type: string
 *           nullable: true
 *         retryCount:
 *           type: integer
 *         lockedUntil:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         ipAddress:
 *           type: string
 *           nullable: true
 *           description: IP address penandatangan (audit trail)
 *         userAgent:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     # ========== GROUP MANAGEMENT ==========
 *
 *     Group:
 *       type: object
 *       description: Kelompok/tim untuk collaborative document signing
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *           description: Auto-increment ID untuk group
 *         name:
 *           type: string
 *           example: "Legal Department"
 *           description: Nama group/tim
 *         adminId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User (admin/owner group)
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp pembuatan group
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp update group terakhir
 *
 *     GroupMember:
 *       type: object
 *       description: Member dari sebuah group
 *       properties:
 *         id:
 *           type: integer
 *         groupId:
 *           type: integer
 *           description: Foreign key ke Group
 *         userId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User
 *         role:
 *           type: string
 *           enum: [admin_group, signer, viewer]
 *           example: "signer"
 *           description: Peran member dalam group
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     GroupInvitation:
 *       type: object
 *       description: Undangan untuk join group dengan token unik
 *       properties:
 *         id:
 *           type: integer
 *         groupId:
 *           type: integer
 *           description: Foreign key ke Group
 *         token:
 *           type: string
 *           example: "inv_token_abc123..."
 *           description: Token unik untuk acceptance invitation
 *         email:
 *           type: string
 *           format: email
 *           nullable: true
 *           description: Email target (optional, untuk tracking)
 *         role:
 *           type: string
 *           enum: [admin_group, signer, viewer]
 *           description: Peran yang akan diberikan setelah join
 *         status:
 *           type: string
 *           enum: [active, used, expired]
 *           example: "active"
 *           description: Status invitation
 *         usageLimit:
 *           type: integer
 *           nullable: true
 *           example: 1
 *           description: Berapa kali token bisa digunakan (null = unlimited)
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Tanggal kadaluarsa invitation
 *         inviterId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User (yang mengirim invitation)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     GroupDocumentSigner:
 *       type: object
 *       description: Request signature untuk document dalam group context
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         documentId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke Document
 *         userId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User (signer)
 *         status:
 *           type: string
 *           enum: [PENDING, SIGNED, REJECTED]
 *           example: "PENDING"
 *           description: Status signing request
 *         order:
 *           type: integer
 *           example: 1
 *           description: Urutan penandatangan (sequential signing)
 *         signatureGroupId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: Foreign key ke SignatureGroup (hasil signature)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     # ========== PAYMENTS & AUDIT ==========
 *
 *     Transaction:
 *       type: object
 *       description: Transaksi pembayaran subscription (Midtrans integration)
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: UUID identifier unik transaksi
 *         orderId:
 *           type: string
 *           example: "ORDER-20250109-001"
 *           description: Order ID (unique di Midtrans)
 *         userId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User
 *         amount:
 *           type: number
 *           example: 99000
 *           description: Nominal pembayaran dalam Rupiah
 *         planType:
 *           type: string
 *           enum: [starter, professional, enterprise]
 *           example: "professional"
 *           description: Paket/plan yang dibeli
 *         status:
 *           type: string
 *           enum: [PENDING, COMPLETED, CANCELLED, EXPIRED]
 *           example: "COMPLETED"
 *           description: Status transaksi (dari Midtrans webhook)
 *         snapToken:
 *           type: string
 *           nullable: true
 *           description: Snap token dari Midtrans untuk payment gateway
 *         snapUrl:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL redirect ke Midtrans payment page
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp pembuatan transaksi
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp update status terakhir
 *
 *     AuditLog:
 *       type: object
 *       description: Audit trail semua aktivitas penting di sistem
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: UUID identifier unik
 *         action:
 *           type: string
 *           enum: [
 *             CREATE_USER, UPDATE_USER, DELETE_USER,
 *             FORCE_DELETE_DOCUMENT,
 *             LOGIN, LOGOUT,
 *             UPDATE_GROUP,
 *             SIGN_DOCUMENT_PERSONAL, SIGN_DOCUMENT_GROUP, SIGN_PACKAGE,
 *             TRANSACTION_SUCCESS, TRANSACTION_CANCELLED
 *           ]
 *           example: "SIGN_DOCUMENT_PERSONAL"
 *           description: Tipe action yang dilakukan
 *         description:
 *           type: string
 *           nullable: true
 *           example: "User menandatangani dokumen: Kontrak Kerja"
 *           description: Deskripsi detail action
 *         actorId:
 *           type: string
 *           format: uuid
 *           description: Foreign key ke User (yang melakukan action)
 *         targetId:
 *           type: string
 *           nullable: true
 *           example: "doc_123"
 *           description: ID resource yang di-action-kan (document, user, dll)
 *         ipAddress:
 *           type: string
 *           nullable: true
 *           example: "192.168.1.100"
 *           description: IP address dari device yang melakukan action
 *         userAgent:
 *           type: string
 *           nullable: true
 *           description: Browser/client user agent string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp action terjadi
 *
 *     ApiRequestLog:
 *       type: object
 *       description: Log setiap API request untuk monitoring dan debugging
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         method:
 *           type: string
 *           enum: [GET, POST, PUT, PATCH, DELETE]
 *           example: "POST"
 *           description: HTTP method
 *         endpoint:
 *           type: string
 *           example: "/api/documents"
 *           description: Endpoint yang di-akses
 *         statusCode:
 *           type: integer
 *           example: 200
 *           description: HTTP response status code
 *         duration:
 *           type: integer
 *           example: 245
 *           description: Durasi request dalam milliseconds
 *         userId:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: Foreign key ke User (yang membuat request)
 *         ipAddress:
 *           type: string
 *           nullable: true
 *           description: IP address client
 *         userAgent:
 *           type: string
 *           nullable: true
 *           description: User agent browser
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp request dibuat
 */

export default {};
