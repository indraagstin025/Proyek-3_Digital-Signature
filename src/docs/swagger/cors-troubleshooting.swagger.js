/**
 * @swagger
 * /cors-troubleshooting:
 *   get:
 *     tags:
 *       - Troubleshooting
 *     summary: "🔧 Guide: CORS & Cookies Issues"
 *     description: |
 *       # CORS (Cross-Origin Resource Sharing) Troubleshooting Guide
 *
 *       ## Apa itu CORS?
 *
 *       CORS adalah security policy browser untuk kontrol akses cross-origin (antar domain).
 *       Tanpa CORS config yang benar, browser akan BLOCK request dan cookies tidak terkirim.
 *
 *       ## DigiSign CORS Configuration
 *
 *       **Allowed Origins (Whitelist):**
 *       ```
 *       - https://www.moodvis.my.id (Production)
 *       - https://moodvis.my.id (Production)
 *       - http://localhost:5173 (Vite dev)
 *       - http://localhost:5174 (Vite dev)
 *       - http://localhost:5175 (Vite dev)
 *       - http://localhost:3000 (Swagger UI)
 *       - http://127.0.0.1:3000 (Swagger UI loopback)
 *       ```
 *
 *       **CORS Headers yang Aktif:**
 *       ```
 *       ✅ credentials: true - Allow cookies
 *       ✅ allowedHeaders: Set-Cookie, Cookie - Terima/kirim cookies
 *       ✅ exposedHeaders: Set-Cookie - Expose cookies ke frontend
 *       ✅ optionsSuccessStatus: 200 - Preflight success
 *       ```
 *
 *       ## Common CORS Issues & Solutions
 *
 *       ### ❌ Error: "Access to XMLHttpRequest blocked by CORS policy"
 *
 *       **Penyebab:** Frontend origin tidak di-whitelist
 *
 *       **Solusi:**
 *       ```javascript
 *       // app.js - Tambahkan origin frontend:
 *       const allowedOrigins = [
 *         "https://www.moodvis.my.id",
 *         "http://localhost:5173", // ← Tambahkan origin Anda di sini
 *       ];
 *       ```
 *
 *       ### ❌ Error: "The value of the 'Access-Control-Allow-Credentials' header in the response is '' which must be 'true'"
 *
 *       **Penyebab:** credentials tidak di-allow (cookies tidak di-send)
 *
 *       **Solusi di Axios/Fetch:**
 *       ```javascript
 *       // FETCH
 *       fetch('http://localhost:3000/api/users/me', {
 *         method: 'GET',
 *         credentials: 'include' // ✅ PENTING: Include cookies
 *       });
 *
 *       // AXIOS
 *       axios.defaults.withCredentials = true; // ✅ Global setting
 *       axios.get('/api/users/me');
 *       ```
 *
 *       ### ❌ Error: "Request header field 'set-cookie' is not allowed by Access-Control-Allow-Headers"
 *
 *       **Penyebab:** set-cookie/cookie header tidak di-allow
 *
 *       **Solusi:** Sudah di-fix di app.js:
 *       ```javascript
 *       allowedHeaders: [
 *         "Content-Type",
 *         "Authorization",
 *         "Set-Cookie", // ✅ Sudah ditambahkan
 *         "Cookie",     // ✅ Sudah ditambahkan
 *       ],
 *       ```
 *
 *       ### ❌ Error: "Cookie tidak diterima / 401 Unauthorized di endpoint protected"
 *
 *       **Penyebab:** Cookies tidak terkirim
 *
 *       **Checklist:**
 *       ```
 *       ✅ Sudah login? (POST /api/auth/login)
 *       ✅ Cookies tersimpan di browser? (DevTools → Application → Cookies)
 *       ✅ Fetch include credentials? (credentials: 'include')
 *       ✅ Axios withCredentials? (axios.defaults.withCredentials = true)
 *       ✅ Frontend origin di whitelist? (check CORS config)
 *       ✅ Browser cookies enabled? (Settings → Privacy)
 *       ```
 *
 *       ### ❌ Error: "Preflight request failed" / "OPTIONS 404"
 *
 *       **Penyebab:** OPTIONS endpoint tidak terhandle
 *
 *       **Solusi:** Sudah di-fix di app.js:
 *       ```javascript
 *       app.options('*', cors(corsOptions)); // ✅ Handle preflight
 *       ```
 *
 *       ---
 *
 *       ## Checklist CORS Setup
 *
 *       ### Backend (app.js):
 *       ```
 *       ✅ Frontend origin di allowedOrigins
 *       ✅ credentials: true
 *       ✅ allowedHeaders include 'Set-Cookie', 'Cookie'
 *       ✅ exposedHeaders include 'Set-Cookie'
 *       ✅ app.options('*', cors()) untuk preflight
 *       ```
 *
 *       ### Frontend (fetch/axios):
 *       ```javascript
 *       // ✅ FETCH
 *       fetch(url, {
 *         credentials: 'include'
 *       })
 *
 *       // ✅ AXIOS
 *       axios.defaults.withCredentials = true;
 *       ```
 *
 *       ### Browser:
 *       ```
 *       ✅ Cookies enabled
 *       ✅ DevTools Network tab → lihat response headers
 *       ✅ DevTools Application → Cookies → check sb-access-token ada
 *       ```
 *
 *       ---
 *
 *       ## Testing CORS
 *
 *       ### Opsi 1: Browser DevTools Console
 *       ```javascript
 *       // Paste di console (setelah login)
 *       fetch('http://localhost:3000/api/users/me', {
 *         credentials: 'include'
 *       })
 *       .then(r => r.json())
 *       .then(d => console.log(d))
 *       .catch(e => console.error(e))
 *       ```
 *
 *       ### Opsi 2: cURL (with cookies)
 *       ```bash
 *       # Save cookies dari login
 *       curl -X POST http://localhost:3000/api/auth/login \
 *         -H "Content-Type: application/json" \
 *         -d '{"email":"user@example.com","password":"password123"}' \
 *         -c cookies.txt
 *
 *       # Use cookies di protected endpoint
 *       curl -X GET http://localhost:3000/api/users/me \
 *         -b cookies.txt \
 *         -H "Origin: http://localhost:5173"
 *       ```
 *
 *       ### Opsi 3: Postman
 *       ```
 *       1. Settings → Cookies
 *       2. Add cookies manually
 *       3. Atau auto-capture dari login response
 *       4. Protected endpoints akan auto-include cookies
 *       ```
 *
 *       ---
 *
 *       ## Debug CORS Error
 *
 *       ### Di Browser Console (F12):
 *       ```
 *       1. Lihat tab "Network"
 *       2. Cari request yang error
 *       3. Check:
 *          - Response Headers → Access-Control-Allow-*
 *          - Request Headers → Cookie (ada atau tidak?)
 *          - Status code (200, 401, 403, dst)
 *       4. Lihat tab "Console" → lihat error message lengkap
 *       ```
 *
 *       ### Di Server Console (logs):
 *       ```
 *       [app.js] ✅ Cookies Diterima: [ 'sb-access-token' ]
 *       [app.js] ❌ TIDAK ADA COOKIES YANG DITERIMA
 *       ```
 *
 *       Jika melihat ❌, berarti CORS cookies tidak terkirim.
 *
 *       ---
 *
 *       ## Production vs Development
 *
 *       | | Development | Production |
 *       |---|---|---|
 *       | Allowed Origins | localhost:5173-5175 | https://moodvis.my.id |
 *       | HTTPS Required | ❌ No | ✅ Yes |
 *       | Cookie Secure | ❌ False | ✅ True |
 *       | SameSite | ✅ Strict | ✅ Strict |
 *       | CORS Origin | Flexible | Strict |
 *
 *       ---
 *
 *       ## Quick Fix Checklist
 *
 *       Jika CORS masih error, follow order ini:
 *
 *       1. ✅ **Backend:**
 *          - Restart server (npm run dev)
 *          - Check CORS config di app.js
 *          - Check cookies logged (console output)
 *
 *       2. ✅ **Frontend:**
 *          - Add `credentials: 'include'` di fetch/axios
 *          - Set `withCredentials: true` di axios
 *          - Clear cache & hard refresh (Ctrl+Shift+R)
 *
 *       3. ✅ **Browser:**
 *          - Check cookies di DevTools (Application → Cookies)
 *          - Check Network tab → Request Headers → Cookie
 *          - Clear cookies & login ulang
 *
 *       4. ✅ **If still error:**
 *          - Check browser console error message lengkap
 *          - Check server logs untuk [Blocked by CORS]
 *          - Add origin ke allowedOrigins di app.js
 *
 *     responses:
 *       200:
 *         description: Troubleshooting guide (documentation only)
 */

export default {};
