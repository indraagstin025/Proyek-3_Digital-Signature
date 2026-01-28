/**
 * @file app.js
 * @description Entry point server Express. Menginisialisasi konfigurasi, dependency injection,
 * middleware, controller, routing, dan menjalankan server utama.
 */

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import "dotenv/config";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { initSocket } from "./socket/socketHandler.js";
import { trafficLogger } from "./middleware/trafficLogger.js";
import logger from "./utils/logger.js";
import { supabase, supabaseBucket } from "./config/supabaseClient.js";
import FileStorage from "./repository/interface/FileStorage.js";
import errorHandler from "./middleware/errorHandler.js";
import AuthError from "./errors/AuthError.js";
import CommonError from "./errors/CommonError.js";
import swaggerConfig from "./config/swaggerConfig.js";

import { PrismaAdminRepository } from "./repository/prisma/PrismaAdminRepository.js";
import PrismaUserRepository from "./repository/prisma/PrismaUserRepository.js";
import { PrismaDocumentRepository } from "./repository/prisma/PrismaDocumentRepository.js";
import { PrismaVersionRepository } from "./repository/prisma/PrismaVersionRepository.js";
import { PrismaSignatureRepository } from "./repository/prisma/PrismaSignatureRepository.js";
import { PrismaDashboardRepository } from "./repository/prisma/PrismaDashboardRepository.js";
import SupabaseAuthRepository from "./repository/supabase/SupabaseAuthRepository.js";
import SupabaseFileStorage from "./repository/supabase/SupabaseFileStorage.js";

import { PrismaGroupRepository } from "./repository/prisma/PrismaGroupRepository.js";
import { PrismaGroupMemberRepository } from "./repository/prisma/PrismaGroupMemberRepository.js";
import { PrismaGroupInvitationRepository } from "./repository/prisma/PrismaGroupInvitationRepository.js";
import { PrismaGroupDocumentSignerRepository } from "./repository/prisma/PrismaGroupDocumentSignerRepository.js";
import { PrismaPackageRepository } from "./repository/prisma/PrismaPackageRepository.js";
import { PrismaHistoryRepository } from "./repository/prisma/PrismaHistoryRepository.js";
import { PrismaAuditLogRepository } from "./repository/prisma/PrismaAuditLogRepository.js";
import { PrismaGroupSignatureRepository } from "./repository/prisma/PrismaGroupSignatureRepository.js";

import { AuthService } from "./services/authService.js";
import { UserService } from "./services/userService.js";
import { DocumentService } from "./services/documentService.js";
import { SignatureService } from "./services/signatureService.js";
import { PDFService } from "./services/pdfService.js";
import { AdminService } from "./services/adminService.js";
import { GroupService } from "./services/groupService.js";
import { PackageService } from "./services/packageService.js";
import { DashboardService } from "./services/dashboardService.js";
import { HistoryService } from "./services/historyService.js";
import { AuditService } from "./services/auditService.js";
import { aiService } from "./services/aiService.js";
import { GroupSignatureService } from "./services/groupSignatureService.js";
import { PaymentService } from "./services/paymentService.js";

import { createAuthController } from "./controllers/authController.js";
import { createUserController } from "./controllers/userController.js";
import { createAdminController } from "./controllers/adminController.js";
import { createDocumentController } from "./controllers/documentController.js";
import { createSignatureController } from "./controllers/signatureController.js";
import { createGroupController } from "./controllers/groupController.js";
import { createPackageController } from "./controllers/packageController.js";
import { createDashboardController } from "./controllers/dashboardController.js";
import { createHistoryController } from "./controllers/historyController.js";
import { createGroupSignatureController } from "./controllers/groupSignatureController.js";
import { createPaymentController } from "./controllers/paymentController.js";

import createAuthRoutes from "./routes/authRoutes.js";
import createUserRoutes from "./routes/userRoutes.js";
import createDocumentRoutes from "./routes/documentRoutes.js";
import createSignatureRoutes from "./routes/signatureRoutes.js";
import { createGroupSignatureRoutes } from "./routes/groupSignatureRoutes.js";
import createAdminRoutes from "./routes/adminRoutes.js";
import createGroupRoutes from "./routes/groupRoutes.js";
import { createPackageRoutes } from "./routes/packageRoutes.js";
import createDashboardRoutes from "./routes/dashboardRoutes.js";
import { createHistoryRoutes } from "./routes/historyRoutes.js";
import createPaymentRoutes from "./routes/paymentRoutes.js";

// Cron Jobs
import { initAllCronJobs } from "./cron/index.js";

/**
 * Inisialisasi aplikasi dan Prisma Client
 */
const app = express();

// [PENTING] Trust Proxy ditaruh paling atas agar mendeteksi HTTPS dari Railway/Cloudflare
app.set("trust proxy", 1);

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
  "http://localhost:5175",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

// ============================================================
// Chrome Private Network Access Support
// ============================================================
// Chrome blocks public websites from accessing private IPs (192.168.x.x, 10.x.x.x, 127.0.0.1)
// This middleware handles the preflight request for Private Network Access
app.use((req, res, next) => {
  // Handle Chrome's Private Network Access preflight
  if (req.method === 'OPTIONS') {
    const requestPrivateNetwork = req.headers['access-control-request-private-network'];
    if (requestPrivateNetwork === 'true') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
  }
  next();
});

const corsOptions = {
  origin: (origin, callback) => {
    // Izinkan request tanpa origin (seperti dari curl/mobile apps tertentu)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin); // Log jika ada yg kena blok
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // ✅ PENTING: Allow credentials (cookies, auth headers)
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Cache-Control",
    "Set-Cookie", // ✅ PENTING: Allow Set-Cookie header
    "Cookie", // ✅ PENTING: Allow Cookie header
  ],
  exposedHeaders: [
    "Set-Cookie", // ✅ PENTING: Expose Set-Cookie header ke frontend
    "X-Total-Count", // Pagination metadata
    "X-Page-Count",
  ],
  optionsSuccessStatus: 200, // ✅ Changed dari 204 ke 200 untuk better compatibility
  maxAge: 86400, // Cache preflight 24 jam
};

const io = new Server(httpServer, {
  path: "/socket.io/",
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  // ✅ Heartbeat configuration to reduce false disconnects
  pingTimeout: 30000,     // 30 seconds (default: 20s) - Time to wait for pong response
  pingInterval: 35000,    // 35 seconds (default: 25s) - Interval between ping packets
  // Longer timeout prevents false disconnects during:
  // - Temporary network latency, browser tab backgrounded, mobile network transitions
});

initSocket(io);

app.use(cors(corsOptions));

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
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

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
// Note: Cookie logging handled by authMiddleware for authenticated routes

app.use(trafficLogger);

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
const avatarStorage = new FileStorage();
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
const userService = new UserService(userRepository, avatarStorage);

const pdfService = new PDFService(versionRepository, signatureRepository, fileStorage);

const signatureService = new SignatureService(signatureRepository, documentRepository, versionRepository, pdfService, auditService, userService);

const groupSignatureService = new GroupSignatureService(prismaGroupSignatureRepository, groupDocumentSignerRepository, documentRepository, versionRepository, groupMemberRepository, pdfService, auditService);

const documentService = new DocumentService(documentRepository, versionRepository, signatureRepository, fileStorage, pdfService, groupMemberRepository, groupDocumentSignerRepository, aiService, prismaGroupSignatureRepository, userService);
const groupService = new GroupService(
  groupRepository,
  groupMemberRepository,
  groupInvitationRepository,
  documentRepository,
  fileStorage,
  groupDocumentSignerRepository,
  versionRepository,
  pdfService,
  prismaGroupSignatureRepository,
  io,
  userService
);

const packageService = new PackageService(packageRepository, documentRepository, versionRepository, pdfService, auditService, userService);

const paymentService = new PaymentService();

/**
 * Controllers
 */
const authController = createAuthController(authService, { AuthError, CommonError });
const userController = createUserController(userService);
const adminController = createAdminController(adminService);
const documentController = createDocumentController(documentService, signatureRepository, fileStorage, io);
const groupSignatureController = createGroupSignatureController(groupSignatureService, groupService, io);
const signatureController = createSignatureController(documentService, signatureService, packageService, groupSignatureService);
const groupController = createGroupController(groupService);
const packageController = createPackageController(packageService);
const dashboardController = createDashboardController(dashboardService);
const historyController = createHistoryController(historyService);
const paymentController = createPaymentController(paymentService);

/**
 * ======================================================
 * 📚 Swagger API Documentation Setup
 * ======================================================
 */
const specs = swaggerJsdoc(swaggerConfig);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    swaggerOptions: {
      persistAuthorization: true,
      displayOperationId: true,
    },
    customCss: `.swagger-ui .topbar { display: none }
              .swagger-ui .model-box { box-shadow: 0 0 20px rgba(0, 0, 0, 0.3); }`,
    customSiteTitle: "DigiSign API Documentation",
  })
);

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
app.use("/api/payments", createPaymentRoutes(paymentController));
app.use("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date() });
});

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
const server = httpServer.listen(port, () => {
  logger.info(`Server berjalan pada http://localhost:${port} (WebSocket Ready)`);
  // Initialize all cron jobs after server starts
  initAllCronJobs();
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 300000;
