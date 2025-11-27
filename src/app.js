/**
 * @file app.js
 * @description Entry point server Express. Menginisialisasi konfigurasi, dependency injection,
 * middleware, controller, routing, dan menjalankan server utama.
 */

import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';

import logger from './utils/logger.js';
import { supabase, supabaseBucket } from './config/supabaseClient.js';
import errorHandler from './middleware/errorHandler.js';
import AuthError from './errors/AuthError.js';
import CommonError from './errors/CommonError.js';

import { PrismaAdminRepository } from './repository/prisma/PrismaAdminRepository.js';
import PrismaUserRepository from './repository/prisma/PrismaUserRepository.js';
import { PrismaDocumentRepository } from './repository/prisma/PrismaDocumentRepository.js';
import { PrismaVersionRepository } from './repository/prisma/PrismaVersionRepository.js';
import { PrismaSignatureRepository } from './repository/prisma/PrismaSignatureRepository.js';
import SupabaseAuthRepository from './repository/supabase/SupabaseAuthRepository.js';
import SupabaseFileStorage from './repository/supabase/SupabaseFileStorage.js';

import { PrismaGroupRepository } from './repository/prisma/PrismaGroupRepository.js';
import { PrismaGroupMemberRepository } from './repository/prisma/PrismaGroupMemberRepository.js';
import { PrismaGroupInvitationRepository } from './repository/prisma/PrismaGroupInvitationRepository.js';
import { PrismaPackageRepository } from './repository/prisma/PrismaPackageRepository.js';

import { AuthService } from './services/authService.js';
import { UserService } from './services/userService.js';
import { DocumentService } from './services/documentService.js';
import { SignatureService } from './services/signatureService.js';
import { PDFService } from './services/pdfService.js';
import { AdminService } from './services/adminService.js';
import { GroupService } from './services/groupService.js';
import { PackageService } from './services/packageService.js';

import { createAuthController } from './controllers/authController.js';
import { createUserController } from './controllers/userController.js';
import { createAdminController } from './controllers/adminController.js';
import { createDocumentController } from './controllers/documentController.js';
import { createSignatureController } from './controllers/signatureController.js';
import { createGroupController } from './controllers/groupController.js';
import { createPackageController } from './controllers/packageController.js';

import createAuthRoutes from './routes/authRoutes.js';
import createUserRoutes from './routes/userRoutes.js';
import createDocumentRoutes from './routes/documentRoutes.js';
import createSignatureRoutes from './routes/signatureRoutes.js';
import createAdminRoutes from './routes/adminRoutes.js';
import createGroupRoutes from './routes/groupRoutes.js';
import { createPackageRoutes } from './routes/packageRoutes.js';

/**
 * Inisialisasi aplikasi dan Prisma Client
 */
const app = express();
const prisma = new PrismaClient();

/**
 * Konfigurasi CORS
 */
const corsOptions = {
    origin: [
        "https://proyek-3-digital-signature-frontend.vercel.app",
        "http://localhost:5173",
    ],
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.set("trust proxy", 1);

/**
 * Logging HTTP
 */
const morganStream = {
    write: (message) => logger.http(message.trim()),
};
app.use(morgan(":method :url :status :res[content-length] - :response-time ms", { stream: morganStream }));

/**
 * Body Parser
 */
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * ======================================================
 * 🛠 JSON Parse Error Handler (PATCH DITAMBAHKAN DI SINI)
 * ======================================================
 */
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({
            status: "fail",
            message: "JSON tidak valid",
        });
    }
    next(err);
});

app.use(cookieParser());

/**
 * Dependency Injection (Repositories + Services + Controllers)
 */
const authRepository = new SupabaseAuthRepository(supabase, prisma);
const adminRepository = new PrismaAdminRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const documentRepository = new PrismaDocumentRepository(prisma);
const versionRepository = new PrismaVersionRepository(prisma);
const signatureRepository = new PrismaSignatureRepository(prisma);
const fileStorage = new SupabaseFileStorage(prisma, supabaseBucket);
const groupRepository = new PrismaGroupRepository(prisma);
const groupMemberRepository = new PrismaGroupMemberRepository(prisma);
const groupInvitationRepository = new PrismaGroupInvitationRepository(prisma);
const packageRepository = new PrismaPackageRepository(prisma);

const authService = new AuthService(authRepository);
const adminService = new AdminService(adminRepository);
const userService = new UserService(userRepository, fileStorage);
const pdfService = new PDFService(versionRepository, signatureRepository, fileStorage);
const signatureService = new SignatureService(signatureRepository, documentRepository, versionRepository, pdfService);
const documentService = new DocumentService(
    documentRepository,
    versionRepository,
    signatureRepository,
    fileStorage,
    pdfService,
    groupMemberRepository
);
const groupService = new GroupService(
    groupRepository,
    groupMemberRepository,
    groupInvitationRepository,
    documentRepository
);
const packageService = new PackageService(
    packageRepository,
    documentRepository,
    versionRepository,
    pdfService
);

/**
 * Controllers
 */
const authController = createAuthController(authService, { AuthError, CommonError });
const userController = createUserController(userService);
const adminController = createAdminController(adminService);
const documentController = createDocumentController(
    documentService,
    signatureRepository,
    fileStorage
);
const signatureController = createSignatureController(documentService, signatureService, packageService);
const groupController = createGroupController(groupService);
const packageController = createPackageController(packageService);

/**
 * Routes
 */
app.use("/api/auth", createAuthRoutes(authController));
app.use("/api/users", createUserRoutes(userController, adminController));
app.use("/api/admin", createAdminRoutes(adminController));
app.use("/api/documents", createDocumentRoutes(documentController));
app.use("/api/signatures", createSignatureRoutes(signatureController));
app.use("/api/groups", createGroupRoutes(groupController));
app.use("/api/packages", createPackageRoutes(packageController));

/**
 * Root Route
 */
app.get("/", (req, res) => {
    res.json({
        message: "API is running",
        status: "success",
        timestamp: new Date().toISOString(),
    });
});

/**
 * Global Error Handler
 */
app.use(errorHandler);

/**
 * Start Server
 */
const port = process.env.PORT || 3000;
app.listen(port, () => {
    logger.info(`Server berjalan pada http://localhost:${port}`);
});
