import express from "express";
import "dotenv/config";
import cors from "cors";
import morgan from "morgan";
import logger from "./utils/logger.js";
import multer from "multer";

// Impor client yang sudah terpusat
import {PrismaClient} from "@prisma/client";
import { supabase } from "./config/supabaseClient.js";

// Impor BaseError untuk error handler
import BaseError from "./errors/BaseError.js";

// --- Impor Service ---
import { AuthService } from "./services/authService.js";
import { UserService } from "./services/userService.js";
import { DocumentService } from "./services/documentService.js";
import { SignatureService } from "./services/signatureService.js";
import { PDFService } from "./services/pdfService.js";

// --- Impor Repository ---
import { PrismaUserRepository } from "./repository/prisma/PrismaUserRepository.js";
import { PrismaDocumentRepository } from "./repository/prisma/PrismaDocumentRepository.js";
import { PrismaVersionRepository } from "./repository/prisma/PrismaVersionRepository.js";
import { PrismaSignatureRepository } from "./repository/prisma/PrismaSignatureRepository.js";
import  SupabaseAuthRepository  from "./repository/supabase/SupabaseAuthRepository.js";
import  SupabaseFileStorage  from "./repository/supabase/SupabaseFileStorage.js";

// --- Impor Controller & Rute ---
import { createAuthController } from "./controllers/authController.js";
import { createUserController } from "./controllers/userController.js";
import { createAdminController } from "./controllers/adminController.js";
import { createDocumentController } from "./controllers/documentController.js";
import { createSignatureController } from "./controllers/signatureController.js";

import createAuthRoutes from "./routes/authRoutes.js";
import createUserRoutes from "./routes/userRoutes.js";
import createDocumentRoutes from "./routes/documentRoutes.js";
import createSignatureRoutes from "./routes/signatureRoutes.js";

const app = express();

// --- Middleware Awal ---
const stream = { write: (message) => logger.http(message.trim()) };
app.use(morgan("tiny", { stream }));
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));

// --- Health Check Route ---
app.get("/", (req, res) => res.json({ message: "✅ API Signify sudah berjalan" }));

// --- Dependency Injection ---
// Repositories
const prisma = new PrismaClient();
const authRepository = new SupabaseAuthRepository(supabase);
const userRepository = new PrismaUserRepository(prisma); // Sekarang 'prisma' sudah terdefinisi
const documentRepository = new PrismaDocumentRepository(prisma);
const versionRepository = new PrismaVersionRepository(prisma);
const signatureRepository = new PrismaSignatureRepository(prisma);
const fileStorage = new SupabaseFileStorage(supabase);

// Services
const authService = new AuthService(authRepository);
const userService = new UserService(userRepository, fileStorage);
const pdfService = new PDFService(versionRepository, signatureRepository, fileStorage);
const signatureService = new SignatureService(signatureRepository, documentRepository, versionRepository, pdfService);
const documentService = new DocumentService(documentRepository, versionRepository, signatureRepository, fileStorage, pdfService);

// Controllers
const authController = createAuthController(authService);
const userController = createUserController(userService);
const adminController = createAdminController(userService);
const documentController = createDocumentController(documentService);
const signatureController = createSignatureController(documentService, signatureService);

// --- Routes ---
app.use("/api/auth", createAuthRoutes(authController));
app.use("/api/users", createUserRoutes(userController, adminController));
app.use("/api/documents", createDocumentRoutes(documentController));
app.use("/api/signatures", createSignatureRoutes(signatureController));

// --- Global Error Handler ---
app.use((err, req, res, next) => {
    logger.error(`${err.statusCode || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    logger.error(err.stack);

    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ status: "fail", message: `Ukuran file terlalu besar. Maksimal 5 MB.` });
        }
        return res.status(400).json({ status: "fail", message: err.message });
    }

    if (err instanceof BaseError) {
        return res.status(err.statusCode).json({
            status: err.status,
            code: err.code,
            message: err.message,
        });
    }

    return res.status(500).json({
        status: "error",
        message: "Terjadi kesalahan internal pada server.",
    });
});

// --- Server Start ---
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`✅ Server berjalan di http://localhost:${port}`);
});