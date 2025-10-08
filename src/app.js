import express from "express";
import "dotenv/config";
import cors from "cors";
import morgan from "morgan";
import logger from "./utils/logger.js";
import multer from "multer";
import AppError from "./errors/AppError.js";
import AuthError from "./errors/AuthError.js";
import CommonError from "./errors/CommonError.js";
import errorHandler from "./middleware/errorHandler.js";
import { supabase, supabaseBucket } from './config/supabaseClient.js';

import { PrismaClient } from "@prisma/client";
import { AuthService } from "./services/authService.js";
import { UserService } from "./services/userService.js";
import { DocumentService } from "./services/documentService.js";
import { SignatureService } from "./services/signatureService.js";
import { PDFService } from "./services/pdfService.js";

import PrismaUserRepository from "./repository/prisma/PrismaUserRepository.js";
import {PrismaDocumentRepository} from "./repository/prisma/PrismaDocumentRepository.js";
import { PrismaVersionRepository } from "./repository/prisma/PrismaVersionRepository.js";
import { PrismaSignatureRepository } from "./repository/prisma/PrismaSignatureRepository.js";
import SupabaseAuthRepository from "./repository/supabase/SupabaseAuthRepository.js";
import SupabaseFileStorage from "./repository/supabase/SupabaseFileStorage.js";

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



const stream = {
  write: (message) => logger.http(message.trim()),
};

const morganMiddleware = morgan(":method :url :status :res[content-length] - :response-time ms", { stream });
app.use(morganMiddleware);
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
      credentials: true,
  })
);

app.get("/", (req, res) => {
  res.json({
    message: "✅ API sudah berjalan",
    status: "success",
    timestamp: new Date().toISOString(),
  });
});


const authRepository = new SupabaseAuthRepository(supabase, prisma);
const userRepository = new PrismaUserRepository(prisma);
const documentRepository = new PrismaDocumentRepository(prisma);
const versionRepository = new PrismaVersionRepository(prisma);
const signatureRepository = new PrismaSignatureRepository(prisma);
const fileStorage = new SupabaseFileStorage(prisma, supabaseBucket);

const authService = new AuthService(authRepository);
const userService = new UserService(userRepository, fileStorage);
const pdfService = new PDFService(versionRepository, signatureRepository, fileStorage);
const signatureService = new SignatureService(signatureRepository, documentRepository, versionRepository, pdfService);
const documentService = new DocumentService(documentRepository, versionRepository, signatureRepository, fileStorage, pdfService);

const authController = createAuthController(authService, { AuthError, CommonError});
const userController = createUserController(userService);
const adminController = createAdminController(userService);
const documentController = createDocumentController(documentService);
const signatureController = createSignatureController(documentService, signatureService);

app.use("/api/auth", createAuthRoutes(authController));
app.use("/api/users", createUserRoutes(userController, adminController));
app.use("/api/documents", createDocumentRoutes(documentController));
app.use("/api/signatures", createSignatureRoutes(signatureController));


app.use((err, req, res, next) => {
    console.log("--- ERROR DITANGKAP OLEH HANDLER GLOBAL ---");
    console.log(err);
    console.log("-----------------------------------------");

    err.statusCode = err.statusCode || 500;
    err.status = err.status || "error";

    logger.error(
        `${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`
    );
    logger.error(err.stack);

    if (err.code === "DOCUMENT_ENCRYPTED") {
        return res.status(403).json({
            status: "fail",
            message:
                "Dokumen ini terproteksi kata sandi atau terenkripsi dan tidak dapat diubah.",
        });
    }

    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                status: "error",
                message: `Ukuran file terlalu besar. Maksimal ${
                    process.env.MAX_FILE_SIZE_MB || 5
                } MB.`,
            });
        }
        return res.status(400).json({ status: "error", message: err.message });
    }

    return res.status(err.statusCode).json({
        status: err.status,
        message: err.message || "Terjadi kesalahan internal pada server",
    });
});

app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server berjalan di http://localhost:${port}`);
});
