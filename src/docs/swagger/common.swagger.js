/**
 * @swagger
 * components:
 *   parameters:
 *
 *     # ========== PAGINATION PARAMETERS ==========
 *
 *     PageParam:
 *       name: page
 *       in: query
 *       description: Nomor halaman (1-indexed)
 *       required: false
 *       schema:
 *         type: integer
 *         default: 1
 *         minimum: 1
 *         example: 1
 *
 *     LimitParam:
 *       name: limit
 *       in: query
 *       description: Jumlah item per halaman
 *       required: false
 *       schema:
 *         type: integer
 *         default: 20
 *         minimum: 1
 *         maximum: 100
 *         example: 20
 *
 *     SortParam:
 *       name: sort
 *       in: query
 *       description: Field untuk sorting (prefix dengan '-' untuk descending)
 *       required: false
 *       schema:
 *         type: string
 *         example: "-createdAt"
 *
 *     SearchParam:
 *       name: search
 *       in: query
 *       description: Keyword pencarian (case-insensitive)
 *       required: false
 *       schema:
 *         type: string
 *         example: "kontrak"
 *
 *     FilterStatusParam:
 *       name: status
 *       in: query
 *       description: Filter berdasarkan status
 *       required: false
 *       schema:
 *         type: string
 *         enum: [draft, pending, completed, archived]
 *
 *     DateFromParam:
 *       name: dateFrom
 *       in: query
 *       description: Filter dari tanggal (ISO 8601)
 *       required: false
 *       schema:
 *         type: string
 *         format: date-time
 *         example: "2025-01-01T00:00:00Z"
 *
 *     DateToParam:
 *       name: dateTo
 *       in: query
 *       description: Filter sampai tanggal (ISO 8601)
 *       required: false
 *       schema:
 *         type: string
 *         format: date-time
 *         example: "2025-12-31T23:59:59Z"
 *
 *   responses:
 *
 *     # ========== SUCCESS RESPONSES ==========
 *
 *     SuccessResponse:
 *       description: Request berhasil diproses
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "success"
 *                 description: Status response (always "success")
 *               message:
 *                 type: string
 *                 example: "Operasi berhasil"
 *                 description: Success message (optional)
 *               data:
 *                 type: object
 *                 description: Response data
 *
 *     PaginatedResponse:
 *       description: Response dengan pagination metadata
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "success"
 *               data:
 *                 type: array
 *                 items:
 *                   type: object
 *               pagination:
 *                 type: object
 *                 properties:
 *                   page:
 *                     type: integer
 *                     example: 1
 *                   limit:
 *                     type: integer
 *                     example: 20
 *                   total:
 *                     type: integer
 *                     example: 150
 *                   totalPages:
 *                     type: integer
 *                     example: 8
 *                   hasNextPage:
 *                     type: boolean
 *                     example: true
 *                   hasPrevPage:
 *                     type: boolean
 *                     example: false
 *
 *     # ========== ERROR RESPONSES ==========
 *
 *     BadRequestResponse:
 *       description: |
 *         **400 Bad Request** - Validasi input gagal
 *
 *         Penyebab umum:
 *         - Field wajib tidak diisi
 *         - Format data tidak valid (email, phone, dll)
 *         - Array kosong untuk field yang butuh minimal 1 item
 *         - Constraint unik terlanggar (duplicate email, dll)
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "fail"
 *               message:
 *                 type: string
 *                 example: "Array 'documentIds' (berisi ID dokumen) wajib diisi."
 *               errors:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     field:
 *                       type: string
 *                       example: "documentIds"
 *                     message:
 *                       type: string
 *                       example: "Harus berupa array tidak kosong"
 *
 *     UnauthorizedResponse:
 *       description: |
 *         **401 Unauthorized** - Autentikasi gagal atau tidak valid
 *
 *         Penyebab umum:
 *         - Cookie authentication tidak ada atau expired
 *         - Session sudah berakhir
 *         - User belum login
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "fail"
 *               message:
 *                 type: string
 *                 example: "Sesi berakhir, silakan login kembali."
 *
 *     ForbiddenResponse:
 *       description: |
 *         **403 Forbidden** - User tidak memiliki akses ke resource
 *
 *         Penyebab umum:
 *         - User bukan owner/admin resource
 *         - PIN/access code salah (untuk locked documents)
 *         - Akses ditolak karena role/permission
 *         - Akun terkunci (rate limiting PIN attempts)
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "fail"
 *               message:
 *                 type: string
 *                 example: "Akses ditolak (bukan owner paket)"
 *
 *     NotFoundResponse:
 *       description: |
 *         **404 Not Found** - Resource tidak ditemukan
 *
 *         Penyebab umum:
 *         - ID dokumen/user/group tidak ada
 *         - Signature ID tidak terdaftar
 *         - Invitation token expired/invalid
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "fail"
 *               message:
 *                 type: string
 *                 example: "Paket tidak ditemukan"
 *
 *     ConflictResponse:
 *       description: |
 *         **409 Conflict** - Conflict dengan state resource saat ini
 *
 *         Penyebab umum:
 *         - Document sudah signed (tidak bisa di-update)
 *         - Group signature belum finalized
 *         - Duplicate entry dalam batch operation
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "fail"
 *               message:
 *                 type: string
 *                 example: "Dokumen sudah ditandatangani, tidak bisa diubah"
 *
 *     UnprocessableEntityResponse:
 *       description: |
 *         **422 Unprocessable Entity** - Request tidak bisa diproses (logika bisnis)
 *
 *         Penyebab umum:
 *         - File PDF invalid/corrupt
 *         - Signature position invalid (out of bounds)
 *         - Quota limit tercapai
 *         - Payment transaction failed
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "fail"
 *               message:
 *                 type: string
 *                 example: "File PDF tidak valid atau corrupt"
 *
 *     TooManyRequestsResponse:
 *       description: |
 *         **429 Too Many Requests** - Rate limiting / throttling aktif
 *
 *         Penyebab umum:
 *         - Terlalu banyak percobaan PIN salah
 *         - API rate limit tercapai
 *         - Webhook retry limit
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "fail"
 *               message:
 *                 type: string
 *                 example: "Terlalu banyak percobaan. Silakan coba lagi dalam 15 menit"
 *               retryAfter:
 *                 type: integer
 *                 example: 900
 *                 description: Detik sampai bisa retry
 *
 *     InternalServerErrorResponse:
 *       description: |
 *         **500 Internal Server Error** - Error tidak terduga di server
 *
 *         Penyebab umum:
 *         - Database connection error
 *         - Storage service error
 *         - Third-party API (Midtrans, etc) failure
 *         - Unhandled exception
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "error"
 *               message:
 *                 type: string
 *                 example: "Terjadi kesalahan pada server. Silakan hubungi support"
 *               error:
 *                 type: object
 *                 nullable: true
 *                 description: Error detail (hanya di development)
 *
 *     ServiceUnavailableResponse:
 *       description: |
 *         **503 Service Unavailable** - Server sedang maintenance atau overload
 *
 *         Penyebab umum:
 *         - Database sedang maintenance
 *         - Storage service down
 *         - Server overload
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "error"
 *               message:
 *                 type: string
 *                 example: "Server sedang dalam maintenance. Silakan coba lagi nanti"
 *
 *   schemas:
 *
 *     # ========== STANDARD RESPONSE WRAPPERS ==========
 *
 *     PaginationMeta:
 *       type: object
 *       description: Metadata pagination untuk list endpoints
 *       properties:
 *         page:
 *           type: integer
 *           example: 1
 *           description: Halaman saat ini (1-indexed)
 *         limit:
 *           type: integer
 *           example: 20
 *           description: Item per halaman
 *         total:
 *           type: integer
 *           example: 150
 *           description: Total item di database
 *         totalPages:
 *           type: integer
 *           example: 8
 *           description: Total halaman
 *         hasNextPage:
 *           type: boolean
 *           example: true
 *           description: Apakah ada halaman berikutnya
 *         hasPrevPage:
 *           type: boolean
 *           example: false
 *           description: Apakah ada halaman sebelumnya
 *
 *     ErrorDetail:
 *       type: object
 *       description: Detail field-level error dari validasi
 *       properties:
 *         field:
 *           type: string
 *           example: "email"
 *           description: Nama field yang error
 *         value:
 *           type: string
 *           nullable: true
 *           description: Value yang dikirim
 *         message:
 *           type: string
 *           example: "Format email tidak valid"
 *           description: Error message untuk field ini
 *
 *     AuditTrail:
 *       type: object
 *       description: Informasi audit untuk tracking action
 *       properties:
 *         ipAddress:
 *           type: string
 *           example: "192.168.1.100"
 *           description: IP address user
 *         userAgent:
 *           type: string
 *           example: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
 *           description: Browser user agent
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2025-01-09T10:30:45Z"
 *           description: Waktu action terjadi
 *
 *     FileUploadResponse:
 *       type: object
 *       description: Response setelah upload file
 *       properties:
 *         fileId:
 *           type: string
 *           format: uuid
 *           description: ID file di storage
 *         fileName:
 *           type: string
 *           example: "kontrak_2025.pdf"
 *           description: Nama file
 *         fileSize:
 *           type: integer
 *           example: 1048576
 *           description: Ukuran file dalam bytes
 *         fileMimeType:
 *           type: string
 *           example: "application/pdf"
 *           description: MIME type file
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp upload
 *         url:
 *           type: string
 *           format: uri
 *           description: Signed URL untuk akses file
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Kapan signed URL expired (null = persistent)
 */

export default {};
