/**
 * @file app.js
 * @description File utama dan titik masuk (entry point) untuk server Express.
 * Bertanggung jawab untuk:
 * - Menginisialisasi aplikasi Express.
 * - Mengkonfigurasi middleware global (CORS, JSON parser, logger, dll.).
 * - Melakukan Dependency Injection (DI) untuk semua lapisan aplikasi (Repositories, Services, Controllers).
 * - Mendaftarkan semua rute API.
 * - Menyiapkan Global Error Handler.
 * - Menjalankan server pada port yang ditentukan.
 */

// --- Impor Modul Pihak Ketiga ---
import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';

// --- Impor Modul Internal (Utilitas, Konfigurasi, Middleware, Errors) ---
import logger from './utils/logger.js';
import { supabase, supabaseBucket } from './config/supabaseClient.js';
import errorHandler from './middleware/errorHandler.js';
import AuthError from './errors/AuthError.js';
import CommonError from './errors/CommonError.js';

// --- Impor Lapisan Aplikasi (Repositories) ---
import { PrismaAdminRepository } from './repository/prisma/PrismaAdminRepository.js';
import PrismaUserRepository from './repository/prisma/PrismaUserRepository.js';
import { PrismaDocumentRepository } from './repository/prisma/PrismaDocumentRepository.js';
import { PrismaVersionRepository } from './repository/prisma/PrismaVersionRepository.js';
import { PrismaSignatureRepository } from './repository/prisma/PrismaSignatureRepository.js';
import SupabaseAuthRepository from './repository/supabase/SupabaseAuthRepository.js';
import SupabaseFileStorage from './repository/supabase/SupabaseFileStorage.js';

// --- Impor Lapisan Aplikasi (Services) ---
import { AuthService } from './services/authService.js';
import { UserService } from './services/userService.js';
import { DocumentService } from './services/documentService.js';
import { SignatureService } from './services/signatureService.js';
import { PDFService } from './services/pdfService.js';
import { AdminService } from './services/adminService.js';

// --- Impor Lapisan Aplikasi (Controllers) ---
import { createAuthController } from './controllers/authController.js';
import { createUserController } from './controllers/userController.js';
import { createAdminController } from './controllers/adminController.js';
import { createDocumentController } from './controllers/documentController.js';
import { createSignatureController } from './controllers/signatureController.js';

// --- Impor Lapisan Aplikasi (Routes) ---
import createAuthRoutes from './routes/authRoutes.js';
import createUserRoutes from './routes/userRoutes.js';
import createDocumentRoutes from './routes/documentRoutes.js';
import createSignatureRoutes from './routes/signatureRoutes.js';
import createAdminRoutes from './routes/adminRoutes.js';


// =================================================================
// INISIALISASI APLIKASI
// =================================================================
const app = express();
const prisma = new PrismaClient();


// =================================================================
// KONFIGURASI MIDDLEWARE
// =================================================================

/**
 * @section Konfigurasi Middleware
 * Mengatur semua middleware yang akan digunakan secara global oleh aplikasi Express.
 */

// Konfigurasi CORS terpusat untuk mengizinkan request dari frontend
const corsOptions = {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
 // Menangani pre-flight requests untuk semua rute

// Middleware untuk logging request HTTP menggunakan Morgan dan Winston
const stream = {
    write: (message) => logger.http(message.trim()),
};
const morganMiddleware = morgan(":method :url :status :res[content-length] - :response-time ms", { stream });
app.use(morganMiddleware);

// Middleware untuk parsing body request sebagai JSON
app.use(express.json());

// Middleware untuk parsing cookies
app.use(cookieParser());


// =================================================================
// DEPENDENCY INJECTION CONTAINER
// =================================================================

/**
 * @section Dependency Injection (DI)
 * Menginisialisasi dan menyambungkan semua kelas dari berbagai lapisan aplikasi,
 * mulai dari Repository, Service, hingga Controller.
 */

// -- 1. Repositories (Lapisan Akses Data) --
const authRepository = new SupabaseAuthRepository(supabase, prisma);
const adminRepository = new PrismaAdminRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const documentRepository = new PrismaDocumentRepository(prisma);
const versionRepository = new PrismaVersionRepository(prisma);
const signatureRepository = new PrismaSignatureRepository(prisma);
const fileStorage = new SupabaseFileStorage(prisma, supabaseBucket);

// -- 2. Services (Lapisan Logika Bisnis) --
const authService = new AuthService(authRepository);
const adminService = new AdminService(adminRepository);
const userService = new UserService(userRepository, fileStorage);
const pdfService = new PDFService(versionRepository, signatureRepository, fileStorage);
const signatureService = new SignatureService(signatureRepository, documentRepository, versionRepository, pdfService);
const documentService = new DocumentService(documentRepository, versionRepository, signatureRepository, fileStorage, pdfService);

// -- 3. Controllers (Lapisan Presentasi) --
const authController = createAuthController(authService, { AuthError, CommonError });
const userController = createUserController(userService);
const adminController = createAdminController(adminService);
const documentController = createDocumentController(documentService, fileStorage);
const signatureController = createSignatureController(documentService, signatureService);


// =================================================================
// REGISTRASI RUTE API
// =================================================================

/**
 * @section Registrasi Rute
 * Menghubungkan rute-rute API ke controller yang sesuai.
 */
app.use("/api/auth", createAuthRoutes(authController));
app.use("/api/users", createUserRoutes(userController, adminController));
app.use("/api/admin", createAdminRoutes(adminController));
app.use("/api/documents", createDocumentRoutes(documentController));
app.use("/api/signatures", createSignatureRoutes(signatureController));


// =================================================================
// RUTE DASAR DAN PENANGANAN ERROR
// =================================================================

/**
 * @route GET /
 * @description Rute untuk health check, memastikan API berjalan.
 */
app.get("/", (req, res) => {
    res.json({
        message: "✅ API sudah berjalan",
        status: "success",
        timestamp: new Date().toISOString(),
    });
});

/**
 * @section Global Error Handler
 * Middleware terakhir yang menangkap semua error yang terjadi di dalam aplikasi
 * dan mengirimkan respons error yang terstruktur.
 */
app.use(errorHandler);


// =================================================================
// MENJALANKAN SERVER
// =================================================================
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`✅ Server berjalan di http://localhost:${port}`);
    logger.info(`Server berjalan di http://localhost:${port}`);
});