/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: Endpoint untuk autentikasi user (register, login, logout, reset password)
 *
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register user baru
 *     description: |
 *       Mendaftarkan user baru dengan email dan password.
 *       User akan menerima email verifikasi.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *                 description: Email untuk login
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: "SecurePass123!"
 *                 description: Password minimal 8 karakter
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *                 description: Nama lengkap user
 *               phoneNumber:
 *                 type: string
 *                 example: "+6281234567890"
 *                 description: Nomor telepon (opsional)
 *               address:
 *                 type: string
 *                 example: "Jl. Contoh No. 123"
 *                 description: Alamat user (opsional)
 *     responses:
 *       201:
 *         description: User berhasil terdaftar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Registrasi berhasil. Silakan cek email Anda untuk verifikasi."
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID user
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *       400:
 *         description: Validasi gagal atau email sudah terdaftar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Email sudah terdaftar"
 *       500:
 *         description: Server error
 *
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login user
 *     description: |
 *       Login menggunakan email dan password.
 *       Akan mengembalikan access token yang disimpan dalam cookie httpOnly.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *                 description: Email terdaftar
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "SecurePass123!"
 *                 description: Password user
 *     responses:
 *       200:
 *         description: Login berhasil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login berhasil"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       description: Detail user yang login
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: "sb-access-token=...; HttpOnly; Path=/; SameSite=Lax"
 *             description: |
 *               Cookie dengan access token dan refresh token.
 *               Disimpan sebagai httpOnly cookie untuk keamanan.
 *       401:
 *         description: Email atau password salah
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Email atau password salah"
 *       500:
 *         description: Server error
 *
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Logout user
 *     description: |
 *       Logout user dan menghapus cookie authentication.
 *       Token di-invalidate di backend.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logout berhasil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Anda telah berhasil Logout."
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: "sb-access-token=; MaxAge=-1; Path=/; SameSite=Lax"
 *             description: Cookie authentication dihapus
 *       401:
 *         description: User tidak authenticated atau cookie tidak valid
 *       500:
 *         description: Server error
 *
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Request reset password
 *     description: |
 *       Mengirim email reset password ke alamat email user.
 *       Link dalam email akan expired dalam beberapa jam.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *                 description: Email terdaftar untuk menerima link reset
 *     responses:
 *       200:
 *         description: |
 *           Email reset password telah dikirim
 *           (Pesan yang sama untuk email terdaftar maupun tidak, untuk keamanan)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Jika email terdaftar, link reset password sudah dikirim ke email Anda."
 *       500:
 *         description: Server error
 *
 * /api/auth/reset-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Reset password user
 *     description: |
 *       Reset password menggunakan token dari email reset.
 *       Token hanya berlaku selama beberapa jam.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *               - refreshToken
 *               - newPassword
 *             properties:
 *               accessToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 description: Access token dari link reset password di email
 *               refreshToken:
 *                 type: string
 *                 example: "refresh_token_dari_email"
 *                 description: Refresh token dari link reset password di email
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: "NewSecurePass123!"
 *                 description: Password baru minimal 8 karakter
 *     responses:
 *       200:
 *         description: Password berhasil direset
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Password berhasil diubah"
 *       400:
 *         description: Token tidak valid, expired, atau password tidak memenuhi kriteria
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Token tidak valid atau expired"
 *       500:
 *         description: Server error
 */

export default {};
