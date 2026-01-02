# DigiSign - Arsitektur Sistem Lengkap

**Dokumentasi Komprehensif Arsitektur Frontend React JS + Backend Node.js**

---

## 1. Ringkasan Arsitektur Sistem

DigiSign adalah platform digital signature yang mengintegrasikan frontend berbasis React JS dan backend Node.js/Express dengan arsitektur layered yang scalable dan secure.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                           │
│                       DIGISIGN SYSTEM ARCHITECTURE                       │
│                                                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                       PRESENTATION LAYER                           │ │
│  │                    (Frontend - React JS)                           │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  • Single Page Application (SPA)                                  │ │
│  │  • Component-Based Architecture                                   │ │
│  │  • State Management (Redux/Context API)                           │ │
│  │  • Real-time Communication (WebSocket)                            │ │
│  │  • Responsive UI/UX                                               │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│           │                                                             │
│           │  HTTP REST API + WebSocket                                 │
│           │                                                             │
│           ▼                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │               API GATEWAY / LOAD BALANCER (nginx)                  │ │
│  │  • Request Routing                                                 │ │
│  │  • SSL/TLS Termination                                             │ │
│  │  • Rate Limiting                                                   │ │
│  │  • CORS Handling                                                   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│           │                                                             │
│           ▼                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │               APPLICATION LAYER                                    │ │
│  │            (Backend - Node.js/Express)                             │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  Controllers → Services → Repositories                             │ │
│  │  • Business Logic Orchestration                                    │ │
│  │  • Request/Response Handling                                       │ │
│  │  • Error Management                                                │ │
│  │  • Validation & Authorization                                      │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│           │                                                             │
│           ▼                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │               PERSISTENCE LAYER                                    │ │
│  │          (Database, Cache, File Storage)                           │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐              │ │
│  │  │ PostgreSQL  │  │   Redis     │  │   AWS S3     │              │ │
│  │  │  Database   │  │   Cache     │  │ File Storage │              │ │
│  │  └─────────────┘  └─────────────┘  └──────────────┘              │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│           │                                                             │
│           ▼                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │               EXTERNAL INTEGRATIONS                                │ │
│  ├────────────────────────────────────────────────────────────────────┤ │
│  │                                                                    │ │
│  │  • Midtrans API (Payment Gateway)                                  │ │
│  │  • SendGrid/SMTP (Email Service)                                   │ │
│  │  • AWS S3 (File Storage)                                           │ │
│  │  • Optional: AI Services                                           │ │
│  │                                                                    │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Architecture (React JS)

### 2.1 Struktur Direktori Frontend

```
frontend/
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── manifest.json
│
├── src/
│   ├── index.js                    # Entry point aplikasi
│   ├── App.js                      # Root component
│   │
│   ├── components/                 # Reusable UI Components
│   │   ├── common/                 # Generic components
│   │   │   ├── Header.js
│   │   │   ├── Sidebar.js
│   │   │   ├── Footer.js
│   │   │   ├── Button.js
│   │   │   ├── Modal.js
│   │   │   └── Toast.js
│   │   │
│   │   ├── auth/                   # Authentication components
│   │   │   ├── LoginForm.js
│   │   │   ├── RegisterForm.js
│   │   │   ├── ForgotPassword.js
│   │   │   └── VerifyEmail.js
│   │   │
│   │   ├── document/               # Document management components
│   │   │   ├── DocumentList.js
│   │   │   ├── DocumentUpload.js
│   │   │   ├── DocumentDetail.js
│   │   │   ├── DocumentViewer.js
│   │   │   └── DocumentVersions.js
│   │   │
│   │   ├── signature/              # Signature request components
│   │   │   ├── SignatureRequest.js
│   │   │   ├── SignaturePad.js
│   │   │   ├── SignerList.js
│   │   │   └── SignatureStatus.js
│   │   │
│   │   ├── payment/                # Payment components
│   │   │   ├── SubscriptionPlans.js
│   │   │   ├── PaymentForm.js
│   │   │   ├── PaymentStatus.js
│   │   │   └── Invoice.js
│   │   │
│   │   ├── group/                  # Group management components
│   │   │   ├── GroupList.js
│   │   │   ├── GroupForm.js
│   │   │   ├── MemberList.js
│   │   │   └── InviteMembers.js
│   │   │
│   │   └── dashboard/              # Dashboard components
│   │       ├── DashboardSummary.js
│   │       ├── DocumentStats.js
│   │       ├── ActionItems.js
│   │       └── ActivityFeed.js
│   │
│   ├── pages/                      # Page-level components (routes)
│   │   ├── Dashboard.js
│   │   ├── Documents.js
│   │   ├── Signatures.js
│   │   ├── Payments.js
│   │   ├── Groups.js
│   │   ├── Profile.js
│   │   ├── Settings.js
│   │   └── Admin.js
│   │
│   ├── services/                   # API & Business Logic
│   │   ├── api/                    # API client services
│   │   │   ├── authService.js
│   │   │   ├── documentService.js
│   │   │   ├── signatureService.js
│   │   │   ├── paymentService.js
│   │   │   ├── groupService.js
│   │   │   ├── userService.js
│   │   │   └── axiosInstance.js
│   │   │
│   │   ├── websocket/              # WebSocket service
│   │   │   └── socketService.js
│   │   │
│   │   └── helpers/                # Utility functions
│   │       ├── dateHelper.js
│   │       ├── formatHelper.js
│   │       ├── validationHelper.js
│   │       └── storageHelper.js
│   │
│   ├── store/                      # State Management (Redux/Context)
│   │   ├── actions/
│   │   │   ├── authActions.js
│   │   │   ├── documentActions.js
│   │   │   └── uiActions.js
│   │   │
│   │   ├── reducers/
│   │   │   ├── authReducer.js
│   │   │   ├── documentReducer.js
│   │   │   ├── signatureReducer.js
│   │   │   └── uiReducer.js
│   │   │
│   │   ├── slices/                 # Redux Toolkit slices
│   │   │   ├── authSlice.js
│   │   │   ├── documentsSlice.js
│   │   │   └── uiSlice.js
│   │   │
│   │   └── store.js                # Store configuration
│   │
│   ├── hooks/                      # Custom React Hooks
│   │   ├── useAuth.js
│   │   ├── useDocument.js
│   │   ├── useSignature.js
│   │   ├── useFetch.js
│   │   └── useWebSocket.js
│   │
│   ├── styles/                     # CSS/SCSS files
│   │   ├── variables.scss
│   │   ├── globals.scss
│   │   ├── components.scss
│   │   ├── pages.scss
│   │   └── responsive.scss
│   │
│   ├── constants/                  # Application constants
│   │   ├── apiEndpoints.js
│   │   ├── messages.js
│   │   ├── errorCodes.js
│   │   └── permissions.js
│   │
│   ├── config/                     # Configuration files
│   │   ├── environment.js
│   │   ├── theme.js
│   │   └── navigation.js
│   │
│   └── utils/                      # Utility functions
│       ├── localStorage.js
│       ├── encryption.js
│       └── logger.js
│
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

### 2.2 Frontend Component Architecture

```
                          App (Root)
                            │
                ┌───────────┴───────────┐
                │                       │
            Router              Layout Component
                │                   │
        ┌───────┼───────┐        ┌──┴──┐
        │       │       │        │     │
     Pages  Pages  Pages    Header  Footer
      │      │      │        │
      │      │      │      Sidebar
      │      │      │
   Components  Components  Components
     │          │          │
    Sub-       Sub-       Sub-
  Components Components Components
```

### 2.3 Data Flow Frontend

```
User Interaction
      │
      ▼
Component Event Handler
      │
      ▼
Dispatch Action (Redux/Context)
      │
      ▼
API Service Call (axios/fetch)
      │
      ▼
HTTP Request ke Backend
      │
      ▼
Backend Response
      │
      ▼
Update Store (Redux)
      │
      ▼
Re-render Component
      │
      ▼
Update UI
```

### 2.4 Key Technologies Frontend

| Kategori             | Teknologi                    | Versi  | Fungsi                  |
| -------------------- | ---------------------------- | ------ | ----------------------- |
| **Framework**        | React                        | 18+    | UI Library              |
| **Routing**          | React Router                 | 6+     | Client-side routing     |
| **State Management** | Redux Toolkit / Context API  | Latest | Global state            |
| **HTTP Client**      | Axios                        | Latest | API requests            |
| **Real-time**        | Socket.io Client             | Latest | WebSocket communication |
| **UI Components**    | Material-UI / Ant Design     | Latest | Component library       |
| **Form Handling**    | Formik / React Hook Form     | Latest | Form validation         |
| **Styling**          | SCSS / Tailwind CSS          | Latest | CSS preprocessing       |
| **Date/Time**        | Moment.js / Day.js           | Latest | Date manipulation       |
| **Charts**           | Recharts / Chart.js          | Latest | Data visualization      |
| **PDF Viewer**       | react-pdf / pdfjs            | Latest | PDF display             |
| **Testing**          | Jest / React Testing Library | Latest | Unit testing            |
| **Build Tool**       | Webpack / Vite               | Latest | Bundle & dev server     |
| **Package Manager**  | npm / yarn                   | Latest | Dependency management   |

---

## 3. Backend Architecture (Node.js/Express)

### 3.1 Struktur Backend

```
backend/
├── src/
│   ├── app.js                      # Express app initialization
│   ├── server.js                   # Server entry point
│   │
│   ├── config/                     # Configuration
│   │   ├── database.js
│   │   ├── redis.js
│   │   ├── environment.js
│   │   ├── logger.js
│   │   └── cors.js
│   │
│   ├── controllers/                # Request handlers
│   │   ├── authController.js
│   │   ├── documentController.js
│   │   ├── signatureController.js
│   │   ├── paymentController.js
│   │   ├── userController.js
│   │   ├── groupController.js
│   │   ├── dashboardController.js
│   │   ├── historyController.js
│   │   ├── adminController.js
│   │   └── packageController.js
│   │
│   ├── services/                   # Business logic
│   │   ├── authService.js
│   │   ├── documentService.js
│   │   ├── signatureService.js
│   │   ├── paymentService.js
│   │   ├── userService.js
│   │   ├── groupService.js
│   │   ├── dashboardService.js
│   │   ├── historyService.js
│   │   ├── pdfService.js
│   │   ├── emailService.js
│   │   ├── auditService.js
│   │   ├── adminService.js
│   │   └── aiService.js
│   │
│   ├── repositories/               # Data access
│   │   ├── userRepository.js
│   │   ├── documentRepository.js
│   │   ├── signatureRepository.js
│   │   ├── paymentRepository.js
│   │   ├── groupRepository.js
│   │   ├── historyRepository.js
│   │   └── auditRepository.js
│   │
│   ├── middleware/                 # Express middleware
│   │   ├── authMiddleware.js
│   │   ├── errorHandler.js
│   │   ├── requestValidator.js
│   │   ├── rateLimiter.js
│   │   ├── cors.js
│   │   ├── logging.js
│   │   └── securityHeaders.js
│   │
│   ├── routes/                     # API routes
│   │   ├── authRoutes.js
│   │   ├── documentRoutes.js
│   │   ├── signatureRoutes.js
│   │   ├── paymentRoutes.js
│   │   ├── userRoutes.js
│   │   ├── groupRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── historyRoutes.js
│   │   ├── adminRoutes.js
│   │   └── index.js
│   │
│   ├── validators/                 # Input validation
│   │   ├── authValidator.js
│   │   ├── documentValidator.js
│   │   ├── signatureValidator.js
│   │   └── paymentValidator.js
│   │
│   ├── errors/                     # Custom error classes
│   │   ├── AppError.js
│   │   ├── ValidationError.js
│   │   ├── AuthenticationError.js
│   │   ├── AuthorizationError.js
│   │   └── NotFoundError.js
│   │
│   ├── utils/                      # Utility functions
│   │   ├── jwtHelper.js
│   │   ├── encryptionHelper.js
│   │   ├── dateHelper.js
│   │   ├── paginationHelper.js
│   │   ├── fileHelper.js
│   │   ├── emailHelper.js
│   │   ├── logger.js
│   │   └── validators.js
│   │
│   ├── socket/                     # WebSocket handlers
│   │   ├── socketHandler.js
│   │   ├── notificationHandler.js
│   │   └── eventEmitter.js
│   │
│   ├── cron/                       # Scheduled tasks
│   │   ├── subscriptionCron.js
│   │   ├── cleanupCron.js
│   │   └── auditCron.js
│   │
│   ├── integrations/               # External API integrations
│   │   ├── midtransIntegration.js
│   │   ├── emailServiceIntegration.js
│   │   ├── s3Integration.js
│   │   └── aiServiceIntegration.js
│   │
│   └── prisma/                     # Database ORM
│       ├── schema.prisma           # Database schema
│       └── migrations/             # Database migrations
│
├── __test__/                       # Test files
│   ├── controllers/
│   ├── services/
│   └── integration/
│
├── .env.example
├── .env
├── package.json
├── jest.config.js
├── .gitignore
└── README.md
```

### 3.2 Service Layer Detail

```
DocumentService
├── uploadDocument(file, metadata)
├── createVersion(documentId, file)
├── updateDocument(id, updates)
├── deleteDocument(id)
├── getDocument(id)
├── listDocuments(userId, filters)
├── rollbackVersion(documentId, versionId)
└── shareDocument(documentId, recipients)

SignatureService
├── createRequest(document, signers)
├── sendRequest(signatureId)
├── sign(signatureId, signatureData)
├── reject(signatureId, reason)
├── verify(signatureId)
├── getStatus(signatureId)
├── getPendingSignatures(userId)
└── generateSigningLink(signatureId)

PaymentService
├── createSubscription(userId, plan)
├── generateSnapToken(payment)
├── handleWebhook(data)
├── updatePaymentStatus(orderId)
├── upgradeSubscription(userId, newPlan)
├── cancelSubscription(userId)
└── processRefund(paymentId)

UserService
├── register(email, password, name)
├── login(email, password)
├── updateProfile(userId, data)
├── changePassword(userId, oldPass, newPass)
├── uploadProfilePicture(userId, file)
├── deleteAccount(userId)
└── getUsageStats(userId)

DashboardService
├── getDashboardSummary(userId)
├── getDocumentCounts(userId)
├── getActionItems(userId)
├── getRecentActivity(userId)
└── cacheData(userId)
```

### 3.3 API Endpoints Overview

```
AUTH ENDPOINTS
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/verify-email
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password

DOCUMENT ENDPOINTS
GET    /api/v1/documents
POST   /api/v1/documents (upload)
GET    /api/v1/documents/:id
PUT    /api/v1/documents/:id
DELETE /api/v1/documents/:id
GET    /api/v1/documents/:id/versions
POST   /api/v1/documents/:id/versions/rollback
POST   /api/v1/documents/:id/share

SIGNATURE ENDPOINTS
POST   /api/v1/signatures (create request)
POST   /api/v1/signatures/:id/send
POST   /api/v1/signatures/:id/sign
POST   /api/v1/signatures/:id/reject
GET    /api/v1/signatures/:id/status
GET    /api/v1/signatures/pending
GET    /api/v1/signatures/:id/download

PAYMENT ENDPOINTS
POST   /api/v1/payments/subscribe
POST   /api/v1/payments/cancel
POST   /api/v1/payments/webhook
GET    /api/v1/payments/status/:orderId
POST   /api/v1/payments/refund

USER ENDPOINTS
GET    /api/v1/users/profile
PUT    /api/v1/users/profile
POST   /api/v1/users/profile-picture
POST   /api/v1/users/change-password
DELETE /api/v1/users/account

GROUP ENDPOINTS
GET    /api/v1/groups
POST   /api/v1/groups
GET    /api/v1/groups/:id
PUT    /api/v1/groups/:id
DELETE /api/v1/groups/:id
POST   /api/v1/groups/:id/members
DELETE /api/v1/groups/:id/members/:memberId

DASHBOARD ENDPOINTS
GET    /api/v1/dashboard/summary
GET    /api/v1/dashboard/counts
GET    /api/v1/dashboard/actions
GET    /api/v1/dashboard/activity
```

### 3.4 Middleware Pipeline

```
Incoming Request
      │
      ▼
┌──────────────────┐
│ CORS Middleware  │ ─────► Check origin, allow cross-origin requests
└──────────────────┘
      │
      ▼
┌──────────────────┐
│ Body Parser      │ ─────► Parse JSON request body
└──────────────────┘
      │
      ▼
┌──────────────────┐
│ Request Logging  │ ─────► Log incoming requests
└──────────────────┘
      │
      ▼
┌──────────────────┐
│ Rate Limiter     │ ─────► Check request rate limit
└──────────────────┘
      │
      ▼
┌──────────────────┐
│ Auth Middleware  │ ─────► Verify JWT token
└──────────────────┘
      │
      ▼
┌──────────────────┐
│ Validator        │ ─────► Validate request data
└──────────────────┘
      │
      ▼
┌──────────────────┐
│ Controller       │ ─────► Handle business logic
└──────────────────┘
      │
      ▼
┌──────────────────┐
│ Error Handler    │ ─────► Catch and format errors
└──────────────────┘
      │
      ▼
Response to Client
```

---

## 4. Data Flow & Request Lifecycle

### 4.1 Complete Request-Response Cycle

```
FRONTEND SIDE
═════════════

[1] User Action
    └─> Click button, submit form, etc.

[2] Component Handler
    └─> Dispatch action to Redux/Context
        └─> updateDocument(docId, data)

[3] API Service Call
    └─> Call documentService.update(docId, data)
        └─> axios.put('/api/v1/documents/:id', data)

[4] HTTP Request
    └─> Method: PUT
    └─> URL: http://api.digisign.com/api/v1/documents/123
    └─> Headers: Authorization: Bearer {token}
    └─> Body: {title: "New Title", ...}


BACKEND SIDE
════════════

[5] Request Arrives at Load Balancer
    └─> nginx routes to available server

[6] Middleware Chain Processing
    ├─> CORS Check
    ├─> Body Parser (JSON parsing)
    ├─> Request Logger (log request)
    ├─> Rate Limiter (check rate limit)
    ├─> Auth Middleware (verify JWT)
    └─> Validator (validate request data)

[7] Route Matching
    └─> PUT /api/v1/documents/:id
    └─> Matched to documentController.update()

[8] Controller Execution
    ├─> Extract path param (id)
    ├─> Extract user from request
    ├─> Call documentService.updateDocument(id, data)
    └─> Format response

[9] Service Layer (Business Logic)
    ├─> documentService.updateDocument(id, data)
    ├─> Validate business rules
    ├─> Call documentRepository.findById(id)
    ├─> Check authorization
    ├─> Update document in database
    ├─> Call auditService.log()
    └─> Return updated document

[10] Repository Layer (Data Access)
     ├─> documentRepository.findById(id)
     │   └─> Query: SELECT * FROM documents WHERE id = ?
     │       └─> Return document object
     ├─> documentRepository.update(id, data)
     │   └─> Query: UPDATE documents SET ... WHERE id = ?
     │       └─> Return updated rows
     └─> Clear cache (Redis invalidation)

[11] Database Operations
     ├─> PostgreSQL executes queries
     ├─> Returns result to repository
     └─> Log to audit trail

[12] Service Return
     └─> Return updated document with metadata

[13] Controller Response Formatting
     ├─> Create success response
     ├─> Include status code (200)
     ├─> Include data (updated document)
     ├─> Add metadata (timestamp, etc.)
     └─> Send response

[14] HTTP Response
     └─> Status: 200 OK
     └─> Headers: Content-Type: application/json
     └─> Body: {
            success: true,
            data: {id: 123, title: "New Title", ...},
            message: "Document updated successfully"
         }

FRONTEND SIDE (continued)
═════════════════════════

[15] Response Received in Browser
     └─> axios promise resolves with response data

[16] Redux Action Handler (Reducer)
     └─> dispatch(updateDocumentSuccess(updatedDoc))
     └─> Update store: documents[docId] = updatedDoc

[17] Component Re-render
     └─> Component selects new state from store
     └─> useSelector hook triggers update

[18] UI Update
     └─> React renders new component with updated data
     └─> User sees updated document in UI

[19] User Notification
     └─> Show success toast: "Document updated successfully"
     └─> Auto-hide after 3 seconds
```

### 4.2 Real-time Communication Flow

```
WebSocket Connection Established
           │
           ▼
Frontend connects via Socket.io
    socket = io('https://api.digisign.com')
           │
           ▼
Backend WebSocket Handler
    socket.on('connect', (socket) => {
        socket.join(`user_${userId}`)
    })
           │
           ▼
Event Emitted from Backend
    eventBus.emit('signature:requested', {
        signatureId: 'sig_123',
        signerId: 'user_456'
    })
           │
           ▼
Broadcasting to Specific User
    io.to(`user_456`).emit('signature:requested', data)
           │
           ▼
Frontend Receives Event
    socket.on('signature:requested', (data) => {
        dispatch(addPendingSignature(data))
        showNotification('New signature request!')
    })
           │
           ▼
UI Updates in Real-time
    Component re-renders with new data
    User sees notification immediately
```

---

## 5. Authentication & Authorization Flow

### 5.1 JWT Token Flow

```
LOGIN REQUEST
    │
    ▼
POST /api/v1/auth/login
    {email, password}
    │
    ▼
authService.login(email, password)
    ├─> Find user by email
    ├─> Verify password with bcrypt
    └─> Generate JWT tokens
           │
           ├─> Access Token (15 min)
           │   Header: {alg: HS256, typ: JWT}
           │   Payload: {userId, email, role, iat, exp}
           │   Signature: HMAC-SHA256(secret)
           │
           └─> Refresh Token (7 days)
               Header: {alg: HS256, typ: JWT}
               Payload: {userId, tokenType: 'refresh'}
               Signature: HMAC-SHA256(secret)
    │
    ▼
Response to Frontend
    {
        success: true,
        data: {
            user: {id, email, name, role},
            token: "eyJhbGc...",
            refreshToken: "eyJhbGc...",
            expiresIn: 900 (15 min in seconds)
        }
    }
    │
    ▼
Frontend Storage
    ├─> localStorage.setItem('token', token)
    ├─> localStorage.setItem('refreshToken', refreshToken)
    └─> Store user in Redux


SUBSEQUENT REQUESTS (WITH TOKEN)
    │
    ▼
Frontend adds token to request header
    Authorization: Bearer eyJhbGc...
    │
    ▼
authMiddleware.verifyToken()
    ├─> Extract token from header
    ├─> Verify signature with secret key
    ├─> Check expiration
    └─> Extract userId and attach to request
           │
           ├─> If valid: Continue to controller
           └─> If invalid/expired:
               ├─> Check refresh token
               ├─> Call POST /api/v1/auth/refresh-token
               └─> If refresh valid: Get new access token
                   else: Redirect to login


TOKEN REFRESH
    │
    ▼
POST /api/v1/auth/refresh-token
    {refreshToken}
    │
    ▼
authService.refreshToken(refreshToken)
    ├─> Verify refresh token signature
    ├─> Check expiration
    └─> Generate new access token
           │
           ▼
Response
    {
        success: true,
        data: {
            token: "new_eyJhbGc...",
            expiresIn: 900
        }
    }
    │
    ▼
Frontend Updates Token
    localStorage.setItem('token', newToken)
    Retry original request with new token
```

### 5.2 Authorization Levels

```
Role Hierarchy
├─ SUPER_ADMIN
│   └─> All system permissions
│
├─ ADMIN
│   ├─> View all users
│   ├─> Manage system settings
│   ├─> View audit logs
│   └─> Handle disputes
│
├─ PREMIUM_USER
│   ├─> Create unlimited documents
│   ├─> Request multiple signers
│   ├─> API access
│   ├─> Advanced analytics
│   └─> Custom branding
│
├─ STANDARD_USER
│   ├─> Create limited documents
│   ├─> Request signatures
│   ├─> Basic dashboard
│   └─> Email support
│
└─ FREE_USER
    ├─> Create 5 documents/month
    ├─> Request signatures
    ├─> Limited features
    └─> Community support


Resource-Level Authorization
    └─> Each resource checks: canUserAccess(userId, resourceId)
        ├─> Owner check: userId === resource.userId
        ├─> Group check: userId in group.members
        ├─> Share check: userId in resource.sharedWith
        └─> Admin override: user.role === ADMIN
```

---

## 6. Database Architecture

### 6.1 Database Schema Overview

```
USERS TABLE
├── id (UUID, PK)
├── email (VARCHAR, UNIQUE)
├── password_hash (VARCHAR)
├── name (VARCHAR)
├── profile_picture (VARCHAR, nullable)
├── tier (ENUM: FREE, STANDARD, PREMIUM)
├── tier_until (TIMESTAMP, nullable)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── deleted_at (TIMESTAMP, nullable) ──────► Soft delete

DOCUMENTS TABLE
├── id (UUID, PK)
├── user_id (UUID, FK → USERS)
├── group_id (UUID, FK → GROUPS, nullable)
├── title (VARCHAR)
├── description (TEXT, nullable)
├── status (ENUM: DRAFT, PENDING, SIGNED, REJECTED)
├── current_version_id (UUID, FK → DOCUMENT_VERSIONS)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── deleted_at (TIMESTAMP, nullable)

DOCUMENT_VERSIONS TABLE
├── id (UUID, PK)
├── document_id (UUID, FK → DOCUMENTS)
├── version_number (INTEGER)
├── file_url (VARCHAR)
├── file_hash (VARCHAR)
├── file_size (BIGINT)
├── created_at (TIMESTAMP)
└── created_by (UUID, FK → USERS)

SIGNATURES TABLE
├── id (UUID, PK)
├── doc_version_id (UUID, FK → DOCUMENT_VERSIONS)
├── requester_id (UUID, FK → USERS)
├── signer_id (UUID, FK → USERS)
├── status (ENUM: PENDING, SIGNED, REJECTED, EXPIRED)
├── signature_data (TEXT)
├── signed_at (TIMESTAMP, nullable)
├── expires_at (TIMESTAMP)
├── ip_address (VARCHAR)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

SIGNATURE_FIELDS TABLE
├── id (UUID, PK)
├── doc_version_id (UUID, FK → DOCUMENT_VERSIONS)
├── field_name (VARCHAR)
├── page_number (INTEGER)
├── position_x (DECIMAL)
├── position_y (DECIMAL)
├── width (DECIMAL)
├── height (DECIMAL)
├── is_required (BOOLEAN)
├── field_type (ENUM: SIGNATURE, INITIALS, TIMESTAMP)
└── created_at (TIMESTAMP)

GROUPS TABLE
├── id (UUID, PK)
├── name (VARCHAR)
├── user_id (UUID, FK → USERS)
├── description (TEXT, nullable)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

GROUP_MEMBERS TABLE
├── id (UUID, PK)
├── group_id (UUID, FK → GROUPS)
├── member_id (UUID, FK → USERS)
├── role (ENUM: OWNER, MEMBER, VIEWER)
├── joined_at (TIMESTAMP)
└── status (ENUM: ACTIVE, INACTIVE, INVITED)

PAYMENTS TABLE
├── id (UUID, PK)
├── user_id (UUID, FK → USERS)
├── order_id (VARCHAR, UNIQUE)
├── amount (DECIMAL)
├── currency (VARCHAR)
├── status (ENUM: PENDING, COMPLETED, FAILED, REFUNDED)
├── plan (ENUM: MONTHLY, YEARLY)
├── transaction_id (VARCHAR, nullable)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

AUDIT_LOGS TABLE
├── id (UUID, PK)
├── user_id (UUID, FK → USERS, nullable)
├── action (VARCHAR)
├── resource_type (VARCHAR)
├── resource_id (UUID, nullable)
├── changes (JSONB)
├── ip_address (VARCHAR)
├── user_agent (VARCHAR)
├── timestamp (TIMESTAMP)
└── details (JSONB, nullable)
```

### 6.2 Database Relationships

```
USERS (1) ──────┬────── (N) DOCUMENTS
               │
               ├────── (N) SIGNATURES (as requester)
               │
               ├────── (N) SIGNATURES (as signer)
               │
               ├────── (N) GROUPS
               │
               ├────── (N) PAYMENTS
               │
               ├────── (N) GROUP_MEMBERS
               │
               └────── (N) AUDIT_LOGS

DOCUMENTS (1) ──┬────── (N) DOCUMENT_VERSIONS
               │
               ├────── (N) SIGNATURES
               │
               ├────── (1) GROUPS (optional)
               │
               └────── (N) SIGNATURE_FIELDS

DOCUMENT_VERSIONS (1) ──┬────── (N) SIGNATURES
                       │
                       ├────── (N) SIGNATURE_FIELDS
                       │
                       └────── (1) DOCUMENTS

GROUPS (1) ─┬────── (N) GROUP_MEMBERS
            │
            └────── (N) DOCUMENTS
```

---

## 7. Security Implementation

### 7.1 Security Layers

```
LAYER 1: TRANSPORT SECURITY
├─ HTTPS/TLS 1.2+
├─ Certificate Management
├─ HSTS Header
└─ Perfect Forward Secrecy

LAYER 2: AUTHENTICATION
├─ JWT Token-based Auth
├─ Password Hashing (bcrypt)
├─ Token Expiration & Refresh
├─ Secure Cookie Storage (HttpOnly)
└─ Session Management

LAYER 3: AUTHORIZATION
├─ Role-Based Access Control (RBAC)
├─ Resource-level Authorization
├─ Permission Validation
└─ Admin Override Logic

LAYER 4: DATA SECURITY
├─ Input Validation & Sanitization
├─ SQL Injection Prevention (Parameterized Queries)
├─ XSS Prevention (Output Encoding)
├─ CSRF Protection (Token Validation)
├─ Rate Limiting
└─ File Upload Validation

LAYER 5: DIGITAL SIGNATURE SECURITY
├─ PKI (Public Key Infrastructure)
├─ SHA-256 Hashing
├─ PKCS#7 Format
├─ Non-Repudiation
└─ Signature Verification

LAYER 6: INFRASTRUCTURE SECURITY
├─ DDoS Protection (CloudFlare)
├─ Web Application Firewall (WAF)
├─ Load Balancer SSL Termination
├─ Database Encryption at Rest
├─ Backup Encryption
└─ Access Control Lists (ACL)

LAYER 7: LOGGING & MONITORING
├─ Comprehensive Audit Logging
├─ Security Event Monitoring
├─ Failed Login Tracking
├─ Suspicious Activity Alerts
└─ Log Retention & Analysis
```

### 7.2 Security Checklist

```
✓ Password Requirements
  └─ Min 8 characters
  └─ Mix of uppercase, lowercase, numbers, symbols
  └─ No dictionary words
  └─ Force change on first login

✓ Token Management
  └─ Access Token: 15 minutes
  └─ Refresh Token: 7 days
  └─ Rotate refresh tokens
  └─ Revoke on logout

✓ Input Validation
  └─ Validate all inputs
  └─ Whitelist allowed characters
  └─ Check data types
  └─ Enforce size limits

✓ File Upload Security
  └─ Validate file type
  └─ Check file size (max 100MB)
  └─ Scan for viruses
  └─ Generate random filenames
  └─ Store outside web root

✓ Database Security
  └─ Use parameterized queries
  └─ Principle of least privilege
  └─ Encrypt sensitive data
  └─ Regular backups with encryption
  └─ PITR (Point-in-Time Recovery)

✓ API Security
  └─ Rate limiting per IP
  └─ Rate limiting per user
  └─ CORS configuration
  └─ API versioning
  └─ Request signing (webhooks)

✓ Error Handling
  └─ Don't expose sensitive info in errors
  └─ Log detailed errors internally
  └─ Show generic errors to users
  └─ Implement circuit breaker
```

---

## 8. Performance Optimization

### 8.1 Caching Strategy

```
CACHING LAYERS

Layer 1: HTTP Caching (Browser/CDN)
├─ Cache-Control headers
├─ ETag validation
├─ 304 Not Modified responses
└─ Max-age: 1 hour for static assets

Layer 2: Application Caching (Redis)
├─ Dashboard summary: 5 minutes
├─ User sessions: 24 hours
├─ Document metadata: 30 minutes
├─ Permission checks: 1 hour
├─ API responses: Based on data type
└─ Cache invalidation on updates

Layer 3: Query Optimization (Database)
├─ Indexed columns
│  └─ user_id, document_id, status, created_at
├─ Denormalization where needed
├─ Lazy loading for relationships
├─ Query pagination
└─ Connection pooling

Layer 4: Frontend Caching (Browser Storage)
├─ localStorage: User preferences, auth tokens
├─ sessionStorage: Temporary form data
├─ IndexedDB: Large datasets, offline support
└─ Service Workers: Offline capability
```

### 8.2 Performance Metrics

```
Target Metrics
├─ First Contentful Paint (FCP): < 1.5s
├─ Largest Contentful Paint (LCP): < 2.5s
├─ Cumulative Layout Shift (CLS): < 0.1
├─ Time to Interactive (TTI): < 3.5s
├─ API Response Time: < 200ms (median)
└─ 99th Percentile Response: < 1s

Optimization Techniques
├─ Code splitting (lazy loading)
├─ Bundle optimization
├─ Image optimization
├─ Lazy load images
├─ Minification & compression
├─ HTTP/2 multiplexing
├─ Gzip compression
├─ Database indexing
├─ Query optimization
├─ Connection pooling
├─ Horizontal scaling
└─ CDN for static assets
```

---

## 9. Deployment Architecture

### 9.1 Production Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT SIDE                              │
├─────────────────────────────────────────────────────────────┤
│  React SPA built with:                                      │
│  ├─ npm run build (production build)                        │
│  ├─ Source maps disabled                                    │
│  ├─ Tree shaking enabled                                    │
│  ├─ Minification enabled                                    │
│  └─ Gzip compression enabled                                │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│              STATIC HOSTING (S3 + CloudFront)              │
├─────────────────────────────────────────────────────────────┤
│  ├─ Upload build artifacts to S3                           │
│  ├─ CloudFront CDN distribution                            │
│  ├─ Cache headers configured                               │
│  ├─ HTTPS/TLS enabled                                      │
│  └─ Geographic distribution (edge locations)               │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    DNS & ROUTING                            │
├─────────────────────────────────────────────────────────────┤
│  ├─ Route53 (DNS management)                               │
│  ├─ Health checks                                          │
│  ├─ Geolocation routing                                    │
│  └─ Auto-failover                                          │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY (nginx)                      │
├─────────────────────────────────────────────────────────────┤
│  ├─ Load balancer                                          │
│  ├─ SSL/TLS termination                                    │
│  ├─ Request routing                                        │
│  ├─ Rate limiting                                          │
│  ├─ Gzip compression                                       │
│  └─ Request logging                                        │
└─────────────────────────────────────────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
Server 1    Server 2    Server 3
Node.js     Node.js     Node.js
Port 3000   Port 3000   Port 3000
    │             │             │
    └──────┬──────┴──────┬──────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                   SHARED SERVICES                           │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL (Primary-Replica)                              │
│  └─ Primary: Write operations                              │
│  └─ Replica 1: Read operations                             │
│  └─ Replica 2: Backup/Analytics                            │
│                                                             │
│  Redis Cluster                                             │
│  └─ Session storage                                        │
│  └─ Dashboard cache                                        │
│  └─ Pub/Sub for real-time                                  │
│                                                             │
│  AWS S3                                                    │
│  └─ Document storage                                       │
│  └─ PDF storage                                            │
│  └─ Backup storage                                         │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 CI/CD Pipeline

```
Git Push
    │
    ▼
GitHub Actions Triggered
    ├─ Event: push to main/develop
    │
    ▼
├─ Checkout code
├─ Setup Node.js environment
├─ Install dependencies (npm install)
│
├─ Linting & Code Quality
│  ├─ ESLint
│  ├─ Prettier check
│  └─ SonarQube analysis
│
├─ Unit Tests
│  ├─ Jest tests
│  ├─ Code coverage > 80%
│  └─ Test report generation
│
├─ Build
│  ├─ npm run build (for frontend)
│  ├─ Docker build
│  └─ Push to Docker registry
│
├─ Security Scanning
│  ├─ Dependency vulnerability check
│  ├─ SAST (Static Application Security Testing)
│  └─ Container scanning
│
├─ Staging Deployment
│  ├─ Deploy to staging environment
│  ├─ Run integration tests
│  ├─ Run smoke tests
│  └─ Performance testing
│
├─ Production Deployment (Manual Approval)
│  ├─ Blue-green deployment
│  ├─ Canary release (10% traffic)
│  ├─ Monitor metrics
│  ├─ Gradually increase traffic (50%, 100%)
│  └─ Auto-rollback on errors
│
▼
Deployment Complete
    ├─ Slack notification
    ├─ Email notification
    └─ Dashboard update
```

---

## 10. Monitoring & Observability

### 10.1 Monitoring Stack

```
METRICS COLLECTION (Prometheus)
├─ Application metrics
│  ├─ HTTP request duration
│  ├─ Request count by endpoint
│  ├─ Error rate
│  ├─ Database query duration
│  └─ Cache hit/miss rate
│
├─ Infrastructure metrics
│  ├─ CPU usage
│  ├─ Memory usage
│  ├─ Disk I/O
│  ├─ Network bandwidth
│  └─ Connections
│
└─ Business metrics
   ├─ Active users
   ├─ Documents created
   ├─ Signatures completed
   ├─ Payment revenue
   └─ Tier distribution

VISUALIZATION (Grafana)
├─ Real-time dashboards
├─ Custom graphs
├─ Alert visualization
└─ Trend analysis

LOG AGGREGATION (ELK Stack)
├─ Elasticsearch: Store & index logs
├─ Logstash: Parse & transform logs
├─ Kibana: Search & visualize logs
└─ Structured logging (JSON)

ALERTING (AlertManager)
├─ Threshold-based alerts
├─ Anomaly detection
├─ Alert routing & grouping
└─ Notification channels (email, Slack, PagerDuty)

ERROR TRACKING (Sentry)
├─ Exception tracking
├─ Stack trace analysis
├─ User impact assessment
├─ Release tracking
└─ Performance monitoring

UPTIME MONITORING
├─ Health checks
├─ Synthetic monitoring
├─ Endpoint monitoring
└─ Certificate expiration tracking
```

### 10.2 Alert Thresholds

```
Critical Alerts
├─ Database down: Immediate
├─ API down: Immediate
├─ Error rate > 5%: Immediate
├─ Response time > 1000ms: 5 minutes
└─ Memory usage > 90%: Immediate

Warning Alerts
├─ CPU usage > 80%: 5 minutes
├─ Disk usage > 85%: 30 minutes
├─ Cache hit rate < 60%: 30 minutes
└─ Failed login attempts > 10: 15 minutes
```

---

## 11. Development Best Practices

### 11.1 Code Standards

```
Frontend Best Practices
├─ Component Structure
│  ├─ Functional components with hooks
│  ├─ Proper prop validation (PropTypes)
│  ├─ Memoization for expensive renders
│  └─ Custom hooks for reusable logic
│
├─ State Management
│  ├─ Redux for global state
│  ├─ Local state for component-specific data
│  ├─ Avoid prop drilling
│  └─ Normalize state shape
│
├─ Performance
│  ├─ Code splitting by route
│  ├─ Lazy load heavy components
│  ├─ Image optimization
│  ├─ Memoize selectors (reselect)
│  └─ Virtual scrolling for long lists
│
├─ Testing
│  ├─ 80%+ code coverage
│  ├─ Unit tests for components
│  ├─ Integration tests for features
│  ├─ E2E tests for critical flows
│  └─ Snapshot tests for UI
│
└─ Code Quality
   ├─ ESLint configuration
   ├─ Prettier formatting
   ├─ Pre-commit hooks
   ├─ Code review process
   └─ TypeScript for type safety

Backend Best Practices
├─ Code Organization
│  ├─ Separation of concerns
│  ├─ Single responsibility principle
│  ├─ DRY (Don't Repeat Yourself)
│  └─ SOLID principles
│
├─ Error Handling
│  ├─ Custom error classes
│  ├─ Proper error propagation
│  ├─ Global error handler
│  ├─ Error logging
│  └─ User-friendly messages
│
├─ Database
│  ├─ Parameterized queries
│  ├─ Proper indexing
│  ├─ Connection pooling
│  ├─ Transaction management
│  └─ Soft deletes where appropriate
│
├─ API Design
│  ├─ RESTful conventions
│  ├─ Proper HTTP status codes
│  ├─ Consistent response format
│  ├─ API versioning
│  └─ Comprehensive documentation
│
└─ Security
   ├─ Input validation
   ├─ Output encoding
   ├─ SQL injection prevention
   ├─ XSS prevention
   ├─ CSRF protection
   └─ Regular security audits
```

### 11.2 Development Workflow

```
Feature Development Workflow
│
├─ Create feature branch
│  └─ git checkout -b feature/feature-name
│
├─ Develop feature
│  ├─ Write tests first (TDD)
│  ├─ Implement feature
│  ├─ Run tests locally
│  ├─ Code formatting (Prettier)
│  └─ Lint check (ESLint)
│
├─ Commit changes
│  ├─ Descriptive commit messages
│  ├─ Small, atomic commits
│  └─ Git hooks for linting/testing
│
├─ Push to remote
│  └─ git push origin feature/feature-name
│
├─ Create Pull Request
│  ├─ Detailed PR description
│  ├─ Screenshots/videos for UI changes
│  ├─ Link related issues
│  └─ Request reviewers
│
├─ Code Review
│  ├─ Automated checks (CI)
│  ├─ Peer review
│  ├─ Approve or request changes
│  └─ Address feedback
│
├─ Merge
│  ├─ Squash commits if needed
│  └─ Delete feature branch
│
└─ Deploy
   ├─ Automatic deployment to staging
   ├─ Manual deployment to production
   └─ Monitor metrics
```

---

## 12. Technology Stack Summary

```
FRONTEND STACK
├─ React 18+ (UI Framework)
├─ React Router v6 (Routing)
├─ Redux Toolkit (State Management)
├─ Axios (HTTP Client)
├─ Socket.io Client (Real-time)
├─ Material-UI or Ant Design (Components)
├─ SCSS (Styling)
├─ Jest (Testing)
├─ React Testing Library (Component Testing)
├─ Formik + Yup (Forms)
├─ React Query (Server State)
├─ Day.js (Date Handling)
├─ Recharts (Charting)
├─ Webpack or Vite (Build Tool)
└─ ESLint + Prettier (Code Quality)

BACKEND STACK
├─ Node.js v18+ (Runtime)
├─ Express.js (Web Framework)
├─ Prisma (ORM)
├─ PostgreSQL (Database)
├─ Redis (Cache)
├─ Socket.io (Real-time)
├─ JWT (Authentication)
├─ bcrypt (Password Hashing)
├─ Joi (Validation)
├─ Multer (File Upload)
├─ PDFKit (PDF Generation)
├─ Nodemailer (Email)
├─ Winston (Logging)
├─ Jest (Testing)
├─ Docker (Containerization)
├─ GitHub Actions (CI/CD)
└─ Sentry (Error Tracking)

INFRASTRUCTURE
├─ Docker (Containerization)
├─ Kubernetes (Optional Orchestration)
├─ AWS S3 (File Storage)
├─ AWS RDS (Managed PostgreSQL)
├─ AWS ElastiCache (Managed Redis)
├─ CloudFront (CDN)
├─ Route53 (DNS)
├─ nginx (Load Balancer)
├─ CloudFlare (DDoS Protection)
├─ GitHub (Version Control)
├─ GitHub Actions (CI/CD)
├─ Prometheus (Metrics)
├─ Grafana (Visualization)
├─ ELK Stack (Logging)
├─ Sentry (Error Tracking)
└─ PagerDuty (Incident Management)
```

---

## Summary

DigiSign menerapkan arsitektur **modern, scalable, dan secure** dengan:

✅ **Frontend**: React JS SPA dengan state management & real-time updates
✅ **Backend**: Node.js/Express dengan layered architecture (Controller → Service → Repository)
✅ **Database**: PostgreSQL + Redis dengan proper indexing & caching
✅ **Security**: Multi-layer security dari transport hingga application level
✅ **Deployment**: Containerized with CI/CD pipeline & blue-green deployment
✅ **Monitoring**: Comprehensive observability dengan metrics, logs, dan alerts
✅ **Performance**: Optimized dengan caching, CDN, & horizontal scaling

Arsitektur ini memastikan **reliability, maintainability, dan scalability** untuk pertumbuhan bisnis jangka panjang.

---

**Dokumen ini diperbarui:** January 2, 2026  
**Versi:** 2.0 (Dengan Frontend React JS)  
**Status:** Complete & Production Ready
