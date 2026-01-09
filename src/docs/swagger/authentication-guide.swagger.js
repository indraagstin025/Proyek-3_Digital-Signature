/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication Guide
 *     summary: "🔐 LOGIN - Dapatkan Authentication Cookie"
 *     description: |
 *       # Authentication Flow untuk DigiSign API
 *
 *       ## Cara Kerja Authentication (Cookie-Based)
 *
 *       DigiSign menggunakan **HTTP-only Cookies** untuk authentication (bukan Bearer Token).
 *
 *       ### Step 1: Login & Dapatkan Cookie
 *       1. Client POST ke `/api/auth/login` dengan email & password
 *       2. Server validate, return HTTP 200 dengan Set-Cookie headers:
 *          - `sb-access-token` (access token, short-lived: 1 jam)
 *          - `sb-refresh-token` (refresh token, long-lived: 7 hari)
 *       3. Browser otomatis menyimpan cookies
 *
 *       ### Step 2: Browser Otomatis Mengirim Cookie
 *       1. Setiap request ke endpoint yang require auth
 *       2. Browser otomatis attach cookies di request headers
 *       3. Server validate cookie, allow/deny akses
 *
 *       ### Step 3: Token Refresh (Otomatis)
 *       1. Ketika access-token expired (1 jam)
 *       2. Client bisa POST ke `/api/auth/refresh` dengan refresh-token
 *       3. Server return access-token baru
 *
 *       ## Testing di Swagger UI (Local/Production)
 *
 *       ### Opsi 1: Swagger UI Built-in Authorize (Recommended)
 *       - Klik tombol **"Authorize"** di atas kanan Swagger UI
 *       - Pilih security scheme **"cookieAuth"**
 *       - Browser akan auto-handle cookies setelah login pertama kali
 *
 *       ### Opsi 2: Login via Swagger terlebih dahulu
 *       1. Buka endpoint POST `/api/auth/login` di Swagger UI
 *       2. Masukkan email & password
 *       3. Execute
 *       4. Server akan set cookies di response headers
 *       5. Swagger UI akan auto-attach cookie ke request berikutnya
 *
 *       ### Opsi 3: Login via Postman / cURL
 *       ```bash
 *       # Login dan simpan cookie
 *       curl -X POST http://localhost:3000/api/auth/login \
 *         -H "Content-Type: application/json" \
 *         -d '{"email":"user@example.com","password":"password123"}' \
 *         -c cookies.txt
 *
 *       # Gunakan cookie untuk protected endpoint
 *       curl -X GET http://localhost:3000/api/users/me \
 *         -b cookies.txt
 *       ```
 *
 *       ## Cookie Details
 *
 *       | Cookie | Lifetime | Purpose | HttpOnly | Secure |
 *       |--------|----------|---------|----------|--------|
 *       | sb-access-token | 1 hour | Access ke API | ✅ Yes | ✅ Yes (prod) |
 *       | sb-refresh-token | 7 days | Refresh access-token | ✅ Yes | ✅ Yes (prod) |
 *
 *       ## Security Features
 *       - ✅ **HttpOnly**: Cookie tidak bisa diakses via JavaScript (CSRF protection)
 *       - ✅ **Secure**: Cookie hanya dikirim via HTTPS (production)
 *       - ✅ **SameSite**: Cookie hanya dikirim same-site (CSRF protection)
 *       - ✅ **Refresh Token Rotation**: Token refresh menghasilkan token baru
 *
 *       ## Error Scenarios
 *
 *       | Error | Penyebab | Solusi |
 *       |-------|---------|--------|
 *       | 401 Unauthorized | Cookie expired/invalid | Login ulang |
 *       | 403 Forbidden | User tidak punya akses | Login dengan akun yang tepat |
 *       | Cookie tidak diterima | CORS issue | Check CORS config, pastikan credentials: include |
 *       | CSRF token required | Missing CSRF token | Pastikan CSRF middleware aktif |
 *
 *       ---
 *
 *       **Untuk testing authenticated endpoint di Swagger UI:**
 *       1. ✅ Login dulu via `/api/auth/login`
 *       2. ✅ Browser akan simpan cookies otomatis
 *       3. ✅ Try other endpoints - cookies akan dikirim otomatis
 *       4. ✅ Swagger UI support cookies by default (browser-based)
 *
 *     security: []
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
 *               password:
 *                 type: string
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login berhasil, cookies di-set di response headers
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: "sb-access-token=eyJhbGc...; Path=/; HttpOnly; Secure; SameSite=Strict"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Login berhasil"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       description: User data
 *
 * /testing-guide:
 *   get:
 *     tags:
 *       - Authentication Guide
 *     summary: "📖 Guide: Cara Test Authenticated Endpoints"
 *     description: |
 *       # Panduan Testing Authenticated Endpoints
 *
 *       ## Scenario 1: Testing via Swagger UI (Easiest)
 *
 *       ```
 *       1. Buka Swagger UI: http://localhost:3000/api-docs
 *       2. Cari endpoint POST /api/auth/login
 *       3. Klik "Try it out"
 *       4. Masukkan email & password yang valid
 *       5. Klik "Execute"
 *       6. Response akan set cookies otomatis
 *       7. Cari endpoint yang protected (ada lock icon)
 *       8. Klik "Try it out"
 *       9. Klik "Execute" - cookies sudah otomatis terkirim
 *       ```
 *
 *       ## Scenario 2: Testing via Postman
 *
 *       ### Langkah 1: Config Cookie Manager
 *       ```
 *       1. Buka Postman
 *       2. Settings > Cookies > Manage Cookies
 *       3. Add domain: localhost:3000
 *       ```
 *
 *       ### Langkah 2: Login Request
 *       ```
 *       POST http://localhost:3000/api/auth/login
 *       Content-Type: application/json
 *
 *       {
 *         "email": "user@example.com",
 *         "password": "password123"
 *       }
 *       ```
 *
 *       ### Langkah 3: Test Protected Endpoint
 *       ```
 *       GET http://localhost:3000/api/users/me
 *       (Postman akan otomatis attach cookies)
 *       ```
 *
 *       ## Scenario 3: Testing via cURL
 *
 *       ```bash
 *       # 1. Login dan simpan cookies
 *       curl -X POST http://localhost:3000/api/auth/login \
 *         -H "Content-Type: application/json" \
 *         -d '{"email":"user@example.com","password":"password123"}' \
 *         -c cookies.txt \
 *         -v
 *
 *       # 2. Use cookie untuk request berikutnya
 *       curl -X GET http://localhost:3000/api/users/me \
 *         -b cookies.txt \
 *         -H "Content-Type: application/json"
 *       ```
 *
 *       ## Scenario 4: Testing via JavaScript (Frontend)
 *
 *       ```javascript
 *       // Login
 *       const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
 *         method: 'POST',
 *         credentials: 'include', // ⚠️ PENTING: include cookies
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({
 *           email: 'user@example.com',
 *           password: 'password123'
 *         })
 *       });
 *
 *       // Request authenticated endpoint
 *       // Cookies otomatis dikirim karena credentials: 'include'
 *       const meResponse = await fetch('http://localhost:3000/api/users/me', {
 *         method: 'GET',
 *         credentials: 'include', // ⚠️ PENTING: include cookies
 *       });
 *       ```
 *
 *       ## Common Issues & Solutions
 *
 *       | Issue | Penyebab | Solusi |
 *       |-------|---------|--------|
 *       | 401 Unauthorized | Cookie tidak terkirim | Pastikan credentials: 'include' di fetch |
 *       | Cookies tidak tersimpan | CORS cookie issue | Check Access-Control-Allow-Credentials |
 *       | "Cookie tidak valid" | Token expired | Login ulang |
 *       | CORS error saat login | CORS policy | Frontend harus di domain yang sama (prod) |
 *
 *       ## Best Practices
 *
 *       ✅ **DO:**
 *       - Selalu login pertama kali sebelum test protected endpoints
 *       - Pastikan cookies enabled di browser
 *       - Gunakan HTTPS di production
 *       - Include credentials di fetch/axios
 *
 *       ❌ **DON'T:**
 *       - Jangan share cookies antar session
 *       - Jangan simpan token di localStorage (vulnerable to XSS)
 *       - Jangan disable HttpOnly flag
 *
 *     responses:
 *       200:
 *         description: Guide informasi (ini hanya dokumentasi)
 */

export default {};
