/**
 * @file app.js
 * @description Entry point server Express. Menginisialisasi konfigurasi, dependency injection,
 * middleware, controller, routing, dan menjalankan server utama.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import 'dotenv/config';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import { initSocket } from "./socket/socketHandler.js";

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
import { PrismaDashboardRepository } from './repository/prisma/PrismaDashboardRepository.js';
import SupabaseAuthRepository from './repository/supabase/SupabaseAuthRepository.js';
import SupabaseFileStorage from './repository/supabase/SupabaseFileStorage.js';

import { PrismaGroupRepository } from './repository/prisma/PrismaGroupRepository.js';
import { PrismaGroupMemberRepository } from './repository/prisma/PrismaGroupMemberRepository.js';
import { PrismaGroupInvitationRepository } from './repository/prisma/PrismaGroupInvitationRepository.js';
import { PrismaGroupDocumentSignerRepository } from "./repository/prisma/PrismaGroupDocumentSignerRepository.js";
import { PrismaPackageRepository } from './repository/prisma/PrismaPackageRepository.js';
import { PrismaHistoryRepository } from "./repository/prisma/PrismaHistoryRepository.js";
import { PrismaAuditLogRepository } from "./repository/prisma/PrismaAuditLogRepository.js";
import { PrismaGroupSignatureRepository } from "./repository/prisma/PrismaGroupSignatureRepository.js";

import { AuthService } from './services/authService.js';
import { UserService } from './services/userService.js';
import { DocumentService } from './services/documentService.js';
import { SignatureService } from './services/signatureService.js';
import { PDFService } from './services/pdfService.js';
import { AdminService } from './services/adminService.js';
import { GroupService } from './services/groupService.js';
import { PackageService } from './services/packageService.js';
import { DashboardService } from './services/dashboardService.js';
import { HistoryService } from "./services/historyService.js";
import { AuditService } from "./services/auditService.js";
import { aiService } from "./services/aiService.js";
import { GroupSignatureService } from "./services/groupSignatureService.js";

import { createAuthController } from './controllers/authController.js';
import { createUserController } from './controllers/userController.js';
import { createAdminController } from './controllers/adminController.js';
import { createDocumentController } from './controllers/documentController.js';
import { createSignatureController } from './controllers/signatureController.js';
import { createGroupController } from './controllers/groupController.js';
import { createPackageController } from './controllers/packageController.js';
import { createDashboardController } from './controllers/dashboardController.js';
import { createHistoryController } from "./controllers/historyController.js";
import { createGroupSignatureController } from "./controllers/groupSignatureController.js";


import createAuthRoutes from './routes/authRoutes.js';
import createUserRoutes from './routes/userRoutes.js';
import createDocumentRoutes from './routes/documentRoutes.js';
import createSignatureRoutes from './routes/signatureRoutes.js';
import { createGroupSignatureRoutes } from "./routes/groupSignatureRoutes.js";
import createAdminRoutes from './routes/adminRoutes.js';
import createGroupRoutes from './routes/groupRoutes.js';
import { createPackageRoutes } from './routes/packageRoutes.js';
import createDashboardRoutes from './routes/dashboardRoutes.js';
import { createHistoryRoutes } from "./routes/historyRoutes.js";

/**
 * Inisialisasi aplikasi dan Prisma Client
 */
const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

/**
 * Konfigurasi CORS
 */

const allowedOrigins = [
    "https://www.moodvis.my.id",
    "https://moodvis.my.id",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175"
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    optionsSuccessStatus: 204,
};

const io = new Server(httpServer, {
    path: "/socket.io/",
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ["websocket", "polling"]
});

initSocket(io);

app.use(cors(corsOptions));
app.set("trust proxy", 1);

/**
 * Logging HTTP Logger
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
 * 🛠 JSON Parse Error Handler
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
const groupDocumentSignerRepository = new PrismaGroupDocumentSignerRepository(prisma);
const packageRepository = new PrismaPackageRepository(prisma);
const dashboardRepository = new PrismaDashboardRepository(prisma);
const historyRepository = new PrismaHistoryRepository(prisma);
const auditRepository = new PrismaAuditLogRepository(prisma);
const prismaGroupSignatureRepository = new PrismaGroupSignatureRepository(prisma);


const dashboardService = new DashboardService(dashboardRepository, groupDocumentSignerRepository);
const authService = new AuthService(authRepository);
const auditService = new AuditService(auditRepository);
const adminService = new AdminService(adminRepository, auditService);
const historyService = new HistoryService(historyRepository);
const userService = new UserService(userRepository,
    fileStorage
);

const pdfService = new PDFService(versionRepository,
    signatureRepository,
    fileStorage
);

const signatureService = new SignatureService(
    signatureRepository,
    documentRepository,
    versionRepository,
    pdfService,
    auditService
);

const groupSignatureService = new GroupSignatureService(
    prismaGroupSignatureRepository, // Pastikan variabel ini benar
    groupDocumentSignerRepository,
    documentRepository,
    versionRepository,
    groupMemberRepository,
    pdfService,
    auditService
);

const documentService = new DocumentService(
    documentRepository,
    versionRepository,
    signatureRepository,
    fileStorage,
    pdfService,
    groupMemberRepository,
    groupDocumentSignerRepository,
    aiService,
    prismaGroupSignatureRepository
);
const groupService = new GroupService(
    groupRepository,
    groupMemberRepository,
    groupInvitationRepository,
    documentRepository,
    fileStorage,
    groupDocumentSignerRepository,
    signatureRepository,
    versionRepository,
    pdfService,
    prismaGroupSignatureRepository
);

const packageService = new PackageService(
    packageRepository,
    documentRepository,
    versionRepository,
    pdfService,
    auditService
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
const groupSignatureController = createGroupSignatureController(groupSignatureService);
const signatureController = createSignatureController(documentService, signatureService, packageService);
const groupController = createGroupController(groupService);
const packageController = createPackageController(packageService);
const dashboardController = createDashboardController(dashboardService);
const historyController = createHistoryController(historyService);


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
app.use("/api/dashboard", createDashboardRoutes(dashboardController));
app.use("/api/history", createHistoryRoutes(historyController));
app.use("/api/group-signatures", createGroupSignatureRoutes(groupSignatureController));

/**
 * Root Route App
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
httpServer.listen(port, () => {
    logger.info(`Server berjalan pada http://localhost:${port} (WebSocket Ready)`);
});
