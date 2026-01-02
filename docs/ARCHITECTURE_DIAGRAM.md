# DigiSign Backend - Architecture Diagram

Dokumentasi lengkap arsitektur sistem backend DigiSign.

---

## 1. High-Level System Architecture (Frontend + Backend)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │              WEB APPLICATION (React JS)                              │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  SPA (Single Page Application)                                │ │   │
│  │  │  • Responsive UI                                             │ │   │
│  │  │  • Real-time Updates (WebSocket)                             │ │   │
│  │  │  • State Management (Redux/Context)                          │ │   │
│  │  │  • Form Handling & Validation                                │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Key Pages:                                                   │ │   │
│  │  │  • Dashboard              • Document Management               │ │   │
│  │  │  • Signature Requests     • Payment/Subscription              │ │   │
│  │  │  • User Profile           • Group Management                  │ │   │
│  │  │  • Document Sharing       • History/Audit Logs               │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐      │
│  │  Web Browser     │    │  Mobile App      │    │  Desktop App     │      │
│  │  (React SPA)     │    │  (React Native)  │    │  (Electron)      │      │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘      │
│           │                       │                       │                  │
└───────────┼───────────────────────┼───────────────────────┼─────────────────┘
            │                       │                       │
            │      REST API / WebSocket                     │
            │                       │                       │
            └───────────┬───────────┴───────────┬───────────┘
                        │                       │
                        ▼                       ▼
        ┌─────────────────────────────────────────────────────┐
        │          API GATEWAY / LOAD BALANCER                │
        │  (nginx / Express Middleware / Rate Limiting)       │
        └──────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
   ┌────────────┐             ┌──────────────┐
   │ HTTP/REST  │             │  WebSocket   │
   │  Routes    │             │  Real-time   │
   └────┬───────┘             └──────┬───────┘
        │                            │
        └──────────────┬─────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────────────────┐
│                      APPLICATION LAYER (Node.js/Express)                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    AUTHENTICATION & MIDDLEWARE                       │   │
│  │  • JWT Verification    • CORS    • Rate Limiting    • Logging       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        CONTROLLERS LAYER                             │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Document │  │Signature │  │ Payment  │  │ Dashboard│            │   │
│  │  │Controller│  │Controller│  │Controller│  │Controller│            │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│  │       │             │             │             │                   │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │   User   │  │  Group   │  │ History  │  │  Admin   │            │   │
│  │  │Controller│  │Controller│  │Controller│  │Controller│            │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │   │
│  └───────┼─────────────┼─────────────┼─────────────┼────────────────────┘   │
│          │             │             │             │                       │
│          └─────────────┼─────────────┼─────────────┘                       │
│                        │             │                                     │
│  ┌─────────────────────▼─────────────▼─────────────────────────────────┐   │
│  │                       SERVICES LAYER                                │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │  Core Services:                                              │  │   │
│  │  │  • DocumentService      • SignatureService                  │  │   │
│  │  │  • UserService          • GroupService                      │  │   │
│  │  │  • PaymentService       • DashboardService                  │  │   │
│  │  │  • GroupSignatureService • HistoryService                   │  │   │
│  │  │  • AuditService         • AdminService                      │  │   │
│  │  │  • PDFService           • AIService                         │  │   │
│  │  │  • AuthService                                              │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    REPOSITORY LAYER (Data Access)                    │   │
│  │  • DocumentRepository        • SignatureRepository                   │   │
│  │  • UserRepository            • GroupRepository                       │   │
│  │  • PaymentRepository         • AuditRepository                       │   │
│  │  • HistoryRepository         • GroupDocumentSignerRepository         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
└───────────────────────────┬──────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
   ┌─────────┐        ┌──────────┐       ┌──────────┐
   │ Database │       │   Cache  │       │  Storage │
   │ (Prisma) │       │ (Redis)  │       │   (S3)   │
   └─────────┘        └──────────┘       └──────────┘
        │                   │                   │
        ▼                   ▼                   ▼
   ┌─────────┐        ┌──────────┐       ┌──────────┐
   │PostgreSQL       │ Redis    │       │AWS S3 or │
   │ Database│       │ Server   │       │Local FS  │
   └─────────┘        └──────────┘       └──────────┘
        │                                     │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
   ┌────────────────┐            ┌──────────────────┐
   │ External APIs  │            │  Integrations    │
   │ & Services     │            │                  │
   └────┬───────────┘            └────┬─────────────┘
        │                             │
   ┌────┴─────────────────────────────┴─────┐
   │                                         │
   ▼                                         ▼
┌────────────────────┐          ┌─────────────────────┐
│  Midtrans Payment  │          │  Email Service      │
│  Gateway API       │          │  (SendGrid/SMTP)    │
└────────────────────┘          └─────────────────────┘
   │
   ├─ Payment Processing
   ├─ Webhook Handling
   └─ Transaction Verification
```

---

## 2. Layered Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                            │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  REST API Endpoints                                             │  │
│  │  • GET/POST/PUT/DELETE /document                                │  │
│  │  • GET/POST /signature                                          │  │
│  │  • POST /payment/subscribe                                     │ │
│  │  • GET /dashboard                                              │ │
│  │  • WebSocket /notifications                                    │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
              │                                  │
              ▼                                  ▼
┌───────────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  CONTROLLERS (HTTP Request Handlers)                             │ │
│  │  • Validate input                                               │ │
│  │  • Call services                                                │ │
│  │  • Format response                                              │ │
│  │  • Handle errors                                                │ │
│  └────────────┬─────────────────────────────────────────────────────┘ │
│               │                                                        │
│  ┌────────────▼─────────────────────────────────────────────────────┐ │
│  │  SERVICES (Business Logic)                                       │ │
│  │  • Document Management Logic                                    │ │
│  │  • Signature Workflow Logic                                     │ │
│  │  • Payment Processing Logic                                     │ │
│  │  • Group Management Logic                                       │ │
│  │  • Dashboard Aggregation Logic                                  │ │
│  │  • Validation & Authorization                                   │ │
│  └────────────┬─────────────────────────────────────────────────────┘ │
│               │                                                        │
│  ┌────────────▼─────────────────────────────────────────────────────┐ │
│  │  REPOSITORIES (Data Access Objects)                             │ │
│  │  • Query building                                               │ │
│  │  • Database operations                                          │ │
│  │  • Transaction management                                       │ │
│  │  • Query optimization                                           │ │
│  └────────────┬─────────────────────────────────────────────────────┘ │
│               │                                                        │
└───────────────┼────────────────────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────────────────────┐
│                      PERSISTENCE LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │  ORM (Prisma)                                                   │ │
│  │  • Schema definition                                            │ │
│  │  • Query generation                                             │ │
│  │  • Relationship mapping                                         │ │
│  └──────────────┬───────────────────────────────────────────────────┘ │
│                 │                                                      │
│  ┌──────────────▼───────────────────────────────────────────────────┐ │
│  │  DATABASE SYSTEMS                                               │ │
│  │  ┌─────────────────┐    ┌──────────────┐    ┌──────────────┐   │ │
│  │  │  PostgreSQL     │    │  Redis Cache │    │  File Storage│   │ │
│  │  │  Primary DB     │    │  Session/    │    │  (S3/Local)  │   │ │
│  │  │                 │    │  Dashboard   │    │              │   │ │
│  │  └─────────────────┘    └──────────────┘    └──────────────┘   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICES ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        CORE API SERVICES                               │ │
│  │                                                                         │ │
│  │  ┌──────────────────┐      ┌──────────────────┐                      │ │
│  │  │   DOCUMENT       │      │   SIGNATURE      │                      │ │
│  │  │   SERVICE        │      │   SERVICE        │                      │ │
│  │  │                  │      │                  │                      │ │
│  │  │ • Upload         │      │ • Create Request │                      │ │
│  │  │ • Create Version │      │ • Generate Link  │                      │ │
│  │  │ • Delete         │      │ • Apply Sig      │                      │ │
│  │  │ • Rollback       │      │ • Verify         │                      │ │
│  │  │ • Manage Status  │      │ • Track Status   │                      │ │
│  │  └────────┬─────────┘      └────────┬─────────┘                      │ │
│  │           │                         │                                 │ │
│  │  ┌────────▼──────────┐      ┌───────▼──────────┐                     │ │
│  │  │   GROUP          │      │   PAYMENT        │                     │ │
│  │  │   SERVICE        │      │   SERVICE        │                     │ │
│  │  │                  │      │                  │                     │ │
│  │  │ • Create Group   │      │ • Create Order   │                     │ │
│  │  │ • Add Members    │      │ • Generate Token │                     │ │
│  │  │ • Assign Docs    │      │ • Handle Webhook │                     │ │
│  │  │ • Remove Member  │      │ • Update Tier    │                     │ │
│  │  │ • Notify Signers │      │ • Cancel Subsc   │                     │ │
│  │  └────────┬─────────┘      └────────┬─────────┘                     │ │
│  │           │                         │                               │ │
│  │  ┌────────▼──────────┐      ┌───────▼──────────┐                    │ │
│  │  │   DASHBOARD       │      │   USER           │                    │ │
│  │  │   SERVICE         │      │   SERVICE        │                    │ │
│  │  │                   │      │                  │                     │ │
│  │  │ • Count Docs      │      │ • Register       │                     │ │
│  │  │ • Action Items    │      │ • Update Profile │                     │ │
│  │  │ • Recent Activity │      │ • Profile Pic    │                     │ │
│  │  │ • Cache Data      │      │ • Stats          │                     │ │
│  │  └────────────────── ┘      └──────────────────┘                     │ │
│  │                                                                     │ │
│  │  ┌──────────────────┐      ┌──────────────────┐                     │ │
│  │  │   AUDIT          │      │   HISTORY        │                      │ │
│  │  │   SERVICE        │      │   SERVICE        │                      │ │
│  │  │                  │      │                  │                      │ │
│  │  │ • Log Actions    │      │ • Track Changes  │                      │ │
│  │  │ • Record Events  │      │ • Version Info   │                      │ │
│  │  │ • Security Logs  │      │ • Activity Trail │                      │ │
│  │  │ • Compliance     │      │ • Statistics     │                      │ │
│  │  └──────────────────┘      └──────────────────┘                      │ │
│  │                                                                         │ │
│  │  ┌──────────────────┐      ┌──────────────────┐                      │ │
│  │  │   PDF            │      │   AI             │                      │ │
│  │  │   SERVICE        │      │   SERVICE        │                      │ │
│  │  │                  │      │                  │                      │ │
│  │  │ • Generate PDF   │      │ • Analyze Docs   │                      │ │
│  │  │ • Embed Signature│      │ • Extract Info   │                      │ │
│  │  │ • Compress       │      │ • Classification │                      │ │
│  │  │ • Validate       │      │ • Suggestions    │                      │ │
│  │  └──────────────────┘      └──────────────────┘                      │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     SUPPORTING SERVICES                                │ │
│  │                                                                         │ │
│  │  ┌──────────────────┐      ┌──────────────────────────────────────┐   │ │
│  │  │   EMAIL          │      │   NOTIFICATION                       │   │ │
│  │  │   SERVICE        │      │   SERVICE                            │   │ │
│  │  │                  │      │                                      │   │ │
│  │  │ • Send Email     │      │ • Queue Management                   │   │ │
│  │  │ • Templates      │      │ • Real-time Notifications (Socket)  │   │ │
│  │  │ • Scheduling     │      │ • In-app Notifications              │   │ │
│  │  │ • Retries        │      │ • Event Dispatching                 │   │ │
│  │  └──────────────────┘      └──────────────────────────────────────┘   │ │
│  │                                                                         │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
        ┌────────────┐  ┌─────────────┐  ┌──────────┐
        │ PostgreSQL │  │  Redis      │  │ S3 File  │
        │ Database   │  │  Cache      │  │ Storage  │
        └────────────┘  └─────────────┘  └──────────┘
```

---

## 4. Data Flow Architecture

```
USER REQUEST
     │
     ▼
┌─────────────────────────────┐
│  HTTP Request Handler       │
│  • Parse Headers            │
│  • Extract Body             │
│  • Validate Content Type    │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Authentication Middleware  │
│  • Verify JWT Token         │
│  • Extract User ID          │
│  • Check Expiration         │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Authorization Middleware   │
│  • Check User Permissions   │
│  • Validate Resource Access │
│  • Rate Limiting            │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Route Handler (Controller) │
│  • Parse Request Params     │
│  • Input Validation         │
│  • Call Service Layer       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Service Business Logic     │
│  • Validate Business Rules  │
│  • Coordinate Operations    │
│  • Call Repository Layer    │
└──────────────┬──────────────┘
               │
      ┌────────┴────────┐
      │                 │
      ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Repository 1 │  │ Repository 2 │
│ (Database)   │  │ (Cache)      │
└──────┬───────┘  └──────┬───────┘
       │                  │
       ▼                  ▼
┌──────────────┐  ┌──────────────┐
│ PostgreSQL   │  │ Redis        │
│ Query        │  │ Get/Set      │
└──────┬───────┘  └──────┬───────┘
       │                  │
       └────────┬─────────┘
                │
                ▼
        ┌──────────────┐
        │ Data Fetched │
        │ from DB/Cache│
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │  Transform   │
        │  Data Format │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │ Check Cache  │
        │ (Redis)      │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │ Format JSON  │
        │ Response     │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │ Send HTTP    │
        │ Response     │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │ Log Request  │
        │ (Audit Trail)│
        └──────┬───────┘
               │
               ▼
        USER RESPONSE
```

---

## 5. Database Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                                   │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────┐         ┌─────────────────────┐                 │
│  │  USERS              │         │  DOCUMENTS          │                 │
│  ├─────────────────────┤         ├─────────────────────┤                 │
│  │ id (PK)             │────────>│ id (PK)             │                 │
│  │ email               │         │ userId (FK)         │                 │
│  │ password_hash       │         │ title               │                 │
│  │ name                │         │ status              │                 │
│  │ profile_picture     │         │ createdAt           │                 │
│  │ tier                │         │ updatedAt           │                 │
│  │ tier_until          │         │ groupId (FK)        │                 │
│  │ createdAt           │         │ currentVersionId    │                 │
│  └─────────────────────┘         └────────┬────────────┘                 │
│          │ 1                              │ 1                             │
│          │                                │                             │
│  ┌───────▼─────────────────┐   ┌──────────▼────────────────┐            │
│  │  SUBSCRIPTIONS          │   │  DOCUMENT_VERSIONS       │            │
│  ├─────────────────────────┤   ├──────────────────────────┤            │
│  │ id (PK)                 │   │ id (PK)                  │            │
│  │ userId (FK)             │   │ documentId (FK)          │            │
│  │ plan                    │   │ versionNumber            │            │
│  │ status                  │   │ fileUrl                  │            │
│  │ startDate               │   │ fileHash                 │            │
│  │ endDate                 │   │ createdAt                │            │
│  │ nextBillingDate         │   └──────────────────────────┘            │
│  └─────────────────────────┘                                            │
│                                                                            │
│  ┌─────────────────────┐         ┌─────────────────────┐                 │
│  │  GROUPS             │         │ SIGNATURES          │                 │
│  ├─────────────────────┤         ├─────────────────────┤                 │
│  │ id (PK)             │────────>│ id (PK)             │                 │
│  │ name                │         │ docVersionId (FK)   │                 │
│  │ userId (FK)         │         │ requesterId (FK)    │                 │
│  │ createdAt           │         │ signerId (FK)       │                 │
│  └─────────────────────┘         │ status              │                 │
│          │ 1                      │ signedAt            │                 │
│          │                        │ signatureData       │                 │
│  ┌───────▼──────────────┐        │ signatureFieldId    │                 │
│  │  GROUP_MEMBERS       │        │ createdAt           │                 │
│  ├──────────────────────┤        └─────────────────────┘                 │
│  │ id (PK)              │                  │ 1                            │
│  │ groupId (FK)         │                  │                             │
│  │ memberId (FK)        │        ┌─────────▼──────────────┐              │
│  │ role                 │        │  SIGNATURE_FIELDS     │              │
│  │ joinedAt             │        ├───────────────────────┤              │
│  │ status               │        │ id (PK)               │              │
│  └──────────────────────┘        │ docVersionId (FK)     │              │
│                                   │ pageNumber            │              │
│  ┌─────────────────────┐         │ position              │              │
│  │  PAYMENTS           │         │ width, height         │              │
│  ├─────────────────────┤         │ isRequired            │              │
│  │ id (PK)             │         └───────────────────────┘              │
│  │ userId (FK)         │                                                 │
│  │ orderId             │         ┌─────────────────────┐                 │
│  │ amount              │         │ AUDIT_LOGS          │                 │
│  │ currency            │         ├─────────────────────┤                 │
│  │ status              │         │ id (PK)             │                 │
│  │ transactionId       │         │ userId (FK)         │                 │
│  │ method              │         │ action              │                 │
│  │ paymentProof        │         │ resourceType        │                 │
│  │ createdAt           │         │ resourceId          │                 │
│  │ updatedAt           │         │ timestamp           │                 │
│  └─────────────────────┘         │ ipAddress           │                 │
│                                   │ userAgent           │                 │
│                                   │ details             │                 │
│                                   └─────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Service Communication Pattern

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SERVICE INTERACTION PATTERN                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  DocumentService                                                         │
│       │                                                                   │
│       ├──> PDFService ─────────> FileStorage (S3)                        │
│       │                                                                   │
│       ├──> SignatureService ──-> AuditService                            │
│       │                                                                   │
│       └──> DocumentRepository ──> Database (Prisma)                      │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  SignatureService                                                       │ │
│       │                                                                 │ │
│       ├──> PDFService                                                  │ │
│       ├──> EmailService ──────────> Email Provider (SendGrid/SMTP)    │ │
│       ├──> NotificationService ──> WebSocket / Redis Pub/Sub          │ │
│       ├──> AuditService                                               │ │
│       └──> SignatureRepository ──> Database (Prisma)                  │ │
│                                                                       │ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  PaymentService                                                        │ │
│       │                                                                 │ │
│       ├──> MidtransAPI ──────────> Snap Token / Payment Status        │ │
│       ├──> UserService ───────────> Update User Tier                  │ │
│       ├──> EmailService ──────────> Payment Confirmation              │ │
│       ├──> AuditService ──────────> Audit Logging                     │ │
│       └──> PaymentRepository ─────> Database (Prisma)                 │ │
│                                                                       │ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  DashboardService                                                      │ │
│       │                                                                 │ │
│       ├──> DocumentRepository (countAllStatuses)                      │ │
│       ├──> SignatureRepository (findPendingSignatures)                 │ │
│       ├──> GroupDocumentSignerRepository                              │ │
│       ├──> Cache Service (Redis) ─> Parallel Query Execution          │ │
│       └──> Database (Prisma)                                          │ │
│                                                                       │ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  GroupService                                                          │ │
│       │                                                                 │ │
│       ├──> GroupMemberRepository ──> Database (Prisma)                │ │
│       ├──> EmailService ───────────> Batch Notifications              │ │
│       ├──> SignatureService                                           │ │
│       └──> AuditService ───────────> Audit Logging                    │ │
│                                                                       │ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. External Integration Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    PAYMENT GATEWAY                               │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  Midtrans Integration                                     │  │  │
│  │  │  • Snap Token Generation                                  │  │  │
│  │  │  • Payment Processing                                     │  │  │
│  │  │  • Webhook Verification (HMAC-SHA256)                     │  │  │
│  │  │  • Transaction Status Query                               │  │  │
│  │  │  • Refund Processing                                      │  │  │
│  │  │  • Settlement Callback                                    │  │  │
│  │  └────────────┬───────────────────────────────────────────────┘  │  │
│  │               │                                                    │  │
│  │               ▼                                                    │  │
│  │         ┌──────────────┐                                          │  │
│  │         │ Midtrans API │                                          │  │
│  │         │ (Production) │                                          │  │
│  │         └──────────────┘                                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    EMAIL SERVICE                                 │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  Email Provider (SendGrid / SMTP)                         │  │  │
│  │  │  • Send Signature Requests                                │  │  │
│  │  │  • Send Payment Confirmations                             │  │  │
│  │  │  • Send Document Notifications                            │  │  │
│  │  │  • Template Rendering                                     │  │  │
│  │  │  • Attachment Handling                                    │  │  │
│  │  │  • Bounce Handling                                        │  │  │
│  │  │  • Delivery Tracking                                      │  │  │
│  │  └────────────┬───────────────────────────────────────────────┘  │  │
│  │               │                                                    │  │
│  │               ▼                                                    │  │
│  │      ┌─────────────────┐                                          │  │
│  │      │ Email Providers │                                          │  │
│  │      │ (SendGrid/SMTP) │                                          │  │
│  │      └─────────────────┘                                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    FILE STORAGE                                  │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  Cloud Storage (AWS S3 / Local FS)                        │  │  │
│  │  │  • Document Upload                                        │  │  │
│  │  │  • PDF Storage                                            │  │  │
│  │  │  • Signed PDF Storage                                     │  │  │
│  │  │  • Profile Picture Storage                                │  │  │
│  │  │  • Public URL Generation                                  │  │  │
│  │  │  • File Deletion                                          │  │  │
│  │  │  • Versioning                                             │  │  │
│  │  └────────────┬───────────────────────────────────────────────┘  │  │
│  │               │                                                    │  │
│  │               ▼                                                    │  │
│  │      ┌─────────────────┐                                          │  │
│  │      │  S3 / Local FS  │                                          │  │
│  │      └─────────────────┘                                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    OPTIONAL INTEGRATIONS                         │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  AI/ML Services                                           │  │  │
│  │  │  • Document Classification                                │  │  │
│  │  │  • Content Extraction                                     │  │  │
│  │  │  • Smart Recommendations                                  │  │  │
│  │  │  • Anomaly Detection                                      │  │  │
│  │  │  • OCR Processing                                         │  │  │
│  │  └────────────┬───────────────────────────────────────────────┘  │  │
│  │               │                                                    │  │
│  │               ▼                                                    │  │
│  │      ┌─────────────────┐                                          │  │
│  │      │  AI Service API │                                          │  │
│  │      │  (OpenAI, etc)  │                                          │  │
│  │      └─────────────────┘                                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT TOPOLOGY                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         CDN / CLOUDFLARE                          │   │
│  │               (DDoS Protection, Caching)                          │   │
│  └────────────────────────┬─────────────────────────────────────────┘   │
│                           │                                             │
│  ┌────────────────────────▼─────────────────────────────────────────┐   │
│  │                    LOAD BALANCER / NGINX                          │   │
│  │           (SSL/TLS, Request Distribution)                         │   │
│  └────────────────────────┬─────────────────────────────────────────┘   │
│                           │                                             │
│        ┌──────────────────┼──────────────────┐                          │
│        │                  │                  │                          │
│        ▼                  ▼                  ▼                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Server 1   │  │   Server 2   │  │   Server 3   │               │
│  │ (Node.js)    │  │ (Node.js)    │  │ (Node.js)    │               │
│  │ Port 3000    │  │ Port 3000    │  │ Port 3000    │               │
│  └────────┬─────┘  └────────┬─────┘  └────────┬─────┘               │
│           │                 │                 │                       │
│           └─────────────────┼─────────────────┘                       │
│                             │                                         │
│  ┌──────────────────────────▼──────────────────────────────────────┐ │
│  │                    SESSION / CACHE LAYER                        │ │
│  │  ┌────────────────────────────────────────────────────────────┐ │ │
│  │  │  Redis Cluster                                             │ │ │
│  │  │  • Session Storage                                         │ │ │
│  │  │  • Dashboard Cache                                         │ │ │
│  │  │  • Rate Limiting                                           │ │ │
│  │  │  • Pub/Sub for Real-time Notifications                     │ │ │
│  │  └────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                   DATABASE LAYER                                 │ │
│  │  ┌────────────────────────────────────────────────────────────┐ │ │
│  │  │  PostgreSQL Cluster (Primary-Replica)                      │ │ │
│  │  │  • Primary Database (Write)                                │ │ │
│  │  │  • Replica 1 (Read)                                        │ │ │
│  │  │  • Replica 2 (Read)                                        │ │ │
│  │  │  • Backup / PITR (Point-in-Time Recovery)                 │ │ │
│  │  └────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                   FILE STORAGE                                   │ │
│  │  ┌────────────────────────────────────────────────────────────┐ │ │
│  │  │  AWS S3 (or MinIO for On-Premise)                          │ │ │
│  │  │  • Document Storage (Versioned)                            │ │ │
│  │  │  • PDF Storage                                             │ │ │
│  │  │  • Backup / Replication                                    │ │ │
│  │  │  • CloudFront CDN Integration                              │ │ │
│  │  └────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                   MONITORING & LOGGING                           │ │
│  │  ┌────────────────────────────────────────────────────────────┐ │ │
│  │  │  ELK Stack / CloudWatch / DataDog                          │ │ │
│  │  │  • Application Logs                                        │ │ │
│  │  │  • Error Tracking                                          │ │ │
│  │  │  • Performance Monitoring                                  │ │ │
│  │  │  • Metrics Collection                                      │ │ │
│  │  │  • Alert Management                                        │ │ │
│  │  └────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Security Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  TRANSPORT LAYER SECURITY                                          │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  • HTTPS / TLS 1.2+                                          │  │  │
│  │  │  • Certificate Management                                    │  │  │
│  │  │  • HSTS (HTTP Strict Transport Security)                     │  │  │
│  │  │  • Perfect Forward Secrecy                                   │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  APPLICATION LAYER SECURITY                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  Authentication:                                             │  │  │
│  │  │  • JWT Token (HS256 / RS256)                                │  │  │
│  │  │  • Token Expiration                                         │  │  │
│  │  │  • Refresh Token Rotation                                   │  │  │
│  │  │  • Secure Storage (HttpOnly Cookies)                        │  │  │
│  │  │                                                              │  │  │
│  │  │  Authorization:                                             │  │  │
│  │  │  • Role-Based Access Control (RBAC)                         │  │  │
│  │  │  • Resource-Level Authorization                             │  │  │
│  │  │  • Permission Validation                                    │  │  │
│  │  │                                                              │  │  │
│  │  │  Input Validation:                                          │  │  │
│  │  │  • Request Body Validation                                  │  │  │
│  │  │  • Parameter Sanitization                                   │  │  │
│  │  │  • File Type Validation                                     │  │  │
│  │  │  • File Size Limits                                         │  │  │
│  │  │  • SQL Injection Prevention (Parameterized Queries)        │  │  │
│  │  │  • XSS Prevention                                           │  │  │
│  │  │                                                              │  │  │
│  │  │  CORS & CSRF:                                               │  │  │
│  │  │  • CORS Headers                                             │  │  │
│  │  │  • CSRF Token Validation                                    │  │  │
│  │  │  • SameSite Cookie Policy                                   │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  DATA SECURITY                                                     │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  Encryption:                                                │  │  │
│  │  │  • Password Hashing (bcrypt)                               │  │  │
│  │  │  • Data Encryption at Rest (AES-256)                       │  │  │
│  │  │  • Data Encryption in Transit (TLS)                        │  │  │
│  │  │  • Sensitive Data Masking in Logs                          │  │  │
│  │  │                                                              │  │  │
│  │  │  Database Security:                                         │  │  │
│  │  │  • Connection Pooling                                      │  │  │
│  │  │  • Parameterized Queries                                   │  │  │
│  │  │  • Database Backups (Encrypted)                            │  │  │
│  │  │  • Access Control Lists                                    │  │  │
│  │  │  • Audit Logging                                           │  │  │
│  │  │                                                              │  │  │
│  │  │  File Storage Security:                                     │  │  │
│  │  │  • S3 Encryption                                           │  │  │
│  │  │  • Access Control (Presigned URLs)                         │  │  │
│  │  │  • Virus Scanning                                          │  │  │
│  │  │  • File Integrity Verification (Hash)                      │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  DIGITAL SIGNATURE SECURITY                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  • PKI (Public Key Infrastructure)                          │  │  │
│  │  │  • Digital Certificate Management                           │  │  │
│  │  │  • SHA-256 Hash for Document Integrity                      │  │  │
│  │  │  • PKCS#7 Format for Signatures                             │  │  │
│  │  │  • Timestamp Authority (TSA) Integration                    │  │  │
│  │  │  • Non-Repudiation                                          │  │  │
│  │  │  • Signature Verification                                   │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  API SECURITY                                                      │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  • Rate Limiting (IP-based, User-based)                     │  │  │
│  │  │  • API Key Management (if applicable)                       │  │  │
│  │  │  • Request Signing (HMAC for Webhooks)                      │  │  │
│  │  │  • API Versioning & Deprecation                             │  │  │
│  │  │  • Input/Output Validation                                  │  │  │
│  │  │  • Error Message Masking                                    │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  AUDIT & MONITORING                                               │  │
│  │  ┌──────────────────────────────────────────────────────────────┐  │  │
│  │  │  • Comprehensive Audit Logging                              │  │  │
│  │  │  • Security Event Monitoring                                │  │  │
│  │  │  • Anomaly Detection                                        │  │  │
│  │  │  • Access Logging                                           │  │  │
│  │  │  • Failed Login Attempt Tracking                            │  │  │
│  │  │  • Suspicious Activity Alerts                               │  │  │
│  │  └──────────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Technology Stack

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      TECHNOLOGY STACK                                     │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  RUNTIME & FRAMEWORK                                                     │
│  ├─ Node.js (v18+)                                                       │
│  ├─ Express.js (Web Framework)                                           │
│  ├─ Socket.io (Real-time Communication)                                  │
│  └─ TypeScript (Optional)                                                │
│                                                                            │
│  DATABASE & ORM                                                          │
│  ├─ PostgreSQL (Primary Database)                                        │
│  ├─ Prisma (ORM)                                                         │
│  ├─ Redis (Caching & Session Store)                                      │
│  └─ Migration Tool (Prisma Migrate)                                      │
│                                                                            │
│  FILE STORAGE & CDN                                                      │
│  ├─ AWS S3 (Production)                                                  │
│  ├─ Local File System (Development)                                      │
│  ├─ CloudFront (CDN)                                                     │
│  └─ MinIO (On-Premise Alternative)                                       │
│                                                                            │
│  AUTHENTICATION & SECURITY                                               │
│  ├─ JWT (JSON Web Tokens)                                                │
│  ├─ bcrypt (Password Hashing)                                            │
│  ├─ Express-Rate-Limit (Rate Limiting)                                   │
│  └─ Helmet.js (Security Headers)                                         │
│                                                                            │
│  PDF & DOCUMENT PROCESSING                                               │
│  ├─ PDFKit (PDF Generation)                                              │
│  ├─ PDF-lib (PDF Manipulation)                                           │
│  ├─ Sharp (Image Processing)                                             │
│  └─ Node-PDFBox (Advanced PDF Operations)                                │
│                                                                            │
│  DIGITAL SIGNATURES & CRYPTOGRAPHY                                       │
│  ├─ OpenSSL (Cryptographic Operations)                                   │
│  ├─ PKCS#7 (Signature Format)                                            │
│  ├─ Node Crypto (Hash Functions)                                         │
│  └─ EJBCA / OpenCA (Certificate Management)                              │
│                                                                            │
│  PAYMENT INTEGRATION                                                     │
│  ├─ Midtrans SDK (Payment Gateway)                                       │
│  ├─ Axios (HTTP Client)                                                  │
│  └─ Webhook Validation (HMAC)                                            │
│                                                                            │
│  EMAIL SERVICE                                                           │
│  ├─ SendGrid / Nodemailer (Email Sending)                                │
│  ├─ Handlebars (Email Templates)                                         │
│  └─ Bull/BullMQ (Job Queue for Async Emails)                             │
│                                                                            │
│  LOGGING & MONITORING                                                    │
│  ├─ Winston (Logging)                                                    │
│  ├─ Morgan (HTTP Request Logging)                                        │
│  ├─ Sentry (Error Tracking)                                              │
│  ├─ DataDog / New Relic (APM)                                            │
│  └─ ELK Stack (Log Aggregation)                                          │
│                                                                            │
│  TESTING & QUALITY                                                       │
│  ├─ Jest (Unit Testing)                                                  │
│  ├─ Supertest (API Testing)                                              │
│  ├─ ESLint (Code Linting)                                                │
│  ├─ Prettier (Code Formatting)                                           │
│  └─ Stryker (Mutation Testing)                                           │
│                                                                            │
│  DEVOPS & DEPLOYMENT                                                     │
│  ├─ Docker (Containerization)                                            │
│  ├─ Docker Compose (Local Development)                                   │
│  ├─ Kubernetes (Orchestration, Optional)                                 │
│  ├─ GitHub Actions (CI/CD)                                               │
│  ├─ Nginx (Load Balancer)                                                │
│  └─ Let's Encrypt (SSL Certificates)                                     │
│                                                                            │
│  MONITORING & ALERTS                                                     │
│  ├─ Prometheus (Metrics)                                                 │
│  ├─ Grafana (Visualization)                                              │
│  ├─ Alertmanager (Alerts)                                                │
│  └─ PagerDuty (Incident Management)                                      │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

Architecture diagram untuk DigiSign Backend menunjukkan:

### **Tier Architecture:**

1. **Presentation Layer** - REST API endpoints
2. **Application Layer** - Controllers, Services, Repositories
3. **Persistence Layer** - Database, Cache, File Storage

### **Key Components:**

- 🎮 **13 Services** untuk berbagai domain bisnis
- 🗄️ **PostgreSQL** untuk persistent data
- 💾 **Redis** untuk caching & session
- 📁 **S3/Local FS** untuk file storage
- 💳 **Midtrans** untuk payment processing
- 📧 **Email Service** untuk notifications

### **Security Layers:**

- 🔐 HTTPS/TLS encryption
- 🛡️ JWT authentication & RBAC
- 🔒 Password hashing (bcrypt)
- ✍️ Digital signature & PKI
- 📝 Comprehensive audit logging

### **Deployment:**

- 📦 Docker containerization
- 🔄 Multi-instance with load balancer
- 💾 Database replication
- 📊 Comprehensive monitoring & logging

---

**Generated:** January 2, 2026  
**System:** DigiSign Digital Signature Backend
