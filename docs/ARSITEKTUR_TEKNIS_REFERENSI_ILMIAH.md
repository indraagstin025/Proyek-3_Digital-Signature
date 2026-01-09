# DOKUMENTASI TEKNIS ARSITEKTUR SISTEM DIGISIGN

## Referensi untuk Artikel Ilmiah

---

## DAFTAR ISI

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Pengantar & Latar Belakang](#2-pengantar--latar-belakang)
3. [Arsitektur Sistem Keseluruhan](#3-arsitektur-sistem-keseluruhan)
4. [Komponen-Komponen Utama](#4-komponen-komponen-utama)
5. [Alur Data & Interaksi Sistem](#5-alur-data--interaksi-sistem)
6. [Stack Teknologi & Justifikasi](#6-stack-teknologi--justifikasi)
7. [Pola Desain Arsitektur](#7-pola-desain-arsitektur)
8. [Database Schema & Model Data](#8-database-schema--model-data)
9. [Keamanan & Integritas Data](#9-keamanan--integritas-data)
10. [Skalabilitas & Performa](#10-skalabilitas--performa)
11. [Integrasi Eksternal](#11-integrasi-eksternal)
12. [Deployment & Infrastructure](#12-deployment--infrastructure)

---

## 1. RINGKASAN EKSEKUTIF

**DigiSign** adalah platform tanda tangan digital enterprise yang dirancang dengan arsitektur berlapis (layered architecture) untuk memastikan skalabilitas, keamanan, dan maintainability. Sistem ini mengintegrasikan:

- **Frontend**: Single Page Application (SPA) berbasis React.js
- **Backend**: Node.js/Express dengan Prisma ORM
- **Database**: PostgreSQL untuk data relasional
- **Cache**: Redis untuk optimasi performa
- **File Storage**: Supabase/AWS S3 untuk penyimpanan dokumen
- **Authentication**: Supabase Auth & JWT token
- **Payment Gateway**: Midtrans API

**Tujuan Sistem**: Menyediakan solusi penandatanganan dokumen digital yang aman, scalable, dan compliant dengan standar keamanan data.

---

## 2. PENGANTAR & LATAR BELAKANG

### 2.1 Definisi Masalah

Proses penandatanganan dokumen tradisional memiliki beberapa keterbatasan:

- Memerlukan cetak, tanda tangan fisik, dan scan
- Waktu pemrosesan lama
- Tidak dapat dilacak secara real-time
- Risiko keamanan data tinggi
- Tidak scalable untuk volume dokumen besar

### 2.2 Solusi Sistem

DigiSign mengatasi masalah dengan:

- Proses penandatanganan 100% digital
- Verifikasi integritas dokumen menggunakan hashing
- Real-time tracking dan audit trail
- Enkripsi end-to-end
- Scalable untuk ribuan transaksi simultan

### 2.3 Persyaratan Fungsional Utama

1. **Autentikasi & Otorisasi**: User authentication dengan Supabase
2. **Manajemen Dokumen**: Upload, versioning, status tracking
3. **Tanda Tangan Digital**: Canvas/QR code signing dengan hashing
4. **Kolaborasi**: Workspace & group untuk kerja tim
5. **Pembayaran**: Integrasi Midtrans untuk premium subscription
6. **Audit Trail**: Logging semua aktivitas user
7. **Real-time Updates**: WebSocket untuk live collaboration

---

## 3. ARSITEKTUR SISTEM KESELURUHAN

### 3.1 Arsitektur Berlapis (Layered Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                        │
│                    (Frontend - React.js SPA)                    │
│  • User Interface (Pages, Components)                           │
│  • State Management (Redux/Context API)                         │
│  • HTTP Client (Axios)                                          │
│  • WebSocket Connection (Socket.io)                             │
└─────────────────────────────────────────────────────────────────┘
                            │
                ┌───────────▼───────────┐
                │  HTTP REST API        │
                │  + WebSocket          │
                └───────────┬───────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY & MIDDLEWARE                     │
│  • CORS Handling                                                │
│  • Authentication (JWT Verification)                            │
│  • Authorization (Role-Based Access)                            │
│  • Rate Limiting                                                │
│  • Request Logging & Monitoring                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                             │
│                  (Business Logic - Node.js)                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │            CONTROLLERS LAYER                            │    │
│  │  • Request handling & response management               │    │
│  │  • Input validation                                     │    │
│  │  • Error handling                                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                            │                                    │
│  ┌─────────────────────────▼─────────────────────────────┐      │
│  │            SERVICES LAYER                             │      │
│  │  • Business logic implementation                      │      │
│  │  • PDF processing & signing                           │      │
│  │  • Hashing & verification                             │      │
│  │  • Email notifications                                │      │
│  │  • Payment processing                                 │      │
│  │  • Audit logging                                      │      │
│  └───────────────────────────────────────────────────────┘      │
│                            │                                    │
│  ┌─────────────────────────▼─────────────────────────────┐      │
│  │        REPOSITORIES/DATA ACCESS LAYER                 │      │
│  │  • Database queries (Prisma ORM)                      │      │
│  │  • File storage operations (Supabase)                 │      │
│  │  • Cache operations (Redis)                           │      │
│  │  • Authentication (Supabase Auth)                     │      │
│  └───────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                  PERSISTENCE LAYER                              │
│  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ PostgreSQL   │  │   Redis     │  │ Supabase    │             │
│  │ Database     │  │   Cache     │  │ Storage     │             │
│  └──────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│               EXTERNAL SERVICES & INTEGRATIONS                  │
│  • Supabase Auth                                                │
│  • Midtrans Payment Gateway                                     │
│  • Email Service (SendGrid/SMTP)                                │
│  • AI Service (Optional)                                        │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Prinsip Arsitektur

1. **Separation of Concerns**: Setiap layer memiliki tanggung jawab spesifik
2. **Dependency Injection**: Services dan repositories di-inject ke controllers
3. **Repository Pattern**: Abstraksi akses data dari business logic
4. **Error Handling**: Centralized error handling dan logging
5. **Modularity**: Fitur diatur dalam modul yang terpisah
6. **Testability**: Setiap layer dapat ditest secara independen

---

## 4. KOMPONEN-KOMPONEN UTAMA

### 4.1 FRONTEND COMPONENTS

#### 4.1.1 Presentation Components

- **Dashboard**: Overview user & statistics
- **Document Management**: Upload, view, manage documents
- **Signature Interface**: Canvas/QR code signing
- **Group Management**: Create & manage workspace groups
- **Payment**: Premium subscription management

#### 4.1.2 State Management

- Redux atau Context API untuk global state
- Local state untuk component-specific data

#### 4.1.3 HTTP Client

- Axios untuk API requests dengan interceptors
- Automatic JWT token attachment
- Error handling centralization

#### 4.1.4 Real-time Communication

- Socket.io client untuk WebSocket connection
- Real-time notification & live updates

---

### 4.2 BACKEND COMPONENTS

#### 4.2.1 Controllers Layer

| Controller                   | Fungsi                              | Endpoint Examples                     |
| ---------------------------- | ----------------------------------- | ------------------------------------- |
| **authController**           | Login, register, refresh token      | POST /auth/login, POST /auth/register |
| **userController**           | Profile management, password change | GET /users/:id, PUT /users/:id        |
| **documentController**       | Upload, list, delete documents      | POST /documents, GET /documents       |
| **signatureController**      | Sign documents, verify signatures   | POST /signatures/sign                 |
| **groupController**          | Create, manage groups               | POST /groups, GET /groups             |
| **groupSignatureController** | Group signing workflow              | POST /group-signatures/sign           |
| **paymentController**        | Payment processing                  | POST /payments/process                |
| **dashboardController**      | Statistics & analytics              | GET /dashboard/stats                  |
| **adminController**          | Admin functions                     | GET /admin/users                      |
| **packageController**        | Signing packages                    | POST /packages                        |
| **historyController**        | User activity history               | GET /history                          |

#### 4.2.2 Services Layer

**Kategori Services:**

**Authentication & Security**

- `authService`: JWT token management, authentication logic
- `userService`: User profile, preferences, settings

**Document Management**

- `documentService`: CRUD operations, version control
- `pdfService`: PDF manipulation, signing, verification
- `signatureService`: Personal signature logic

**Collaboration**

- `groupService`: Group management
- `groupSignatureService`: Group signing workflow

**Payment & Subscription**

- `paymentService`: Midtrans integration
- `packageService`: Signing package management

**Analytics & Monitoring**

- `dashboardService`: Statistics & metrics
- `auditService`: Audit trail logging
- `adminService`: Admin operations

**Additional Services**

- `aiService`: AI-powered features
- `historyService`: User activity tracking

#### 4.2.3 Repositories Layer

**Interface Abstraction**

```
FileStorage (interface)
├── SupabaseFileStorage
└── S3FileStorage (optional)
```

**Prisma Repositories**

- `PrismaUserRepository`: User CRUD operations
- `PrismaDocumentRepository`: Document management
- `PrismaSignatureRepository`: Signature records
- `PrismaGroupRepository`: Group management
- `PrismaGroupMemberRepository`: Group membership
- `PrismaGroupInvitationRepository`: Invitations
- `PrismaGroupDocumentSignerRepository`: Group signers
- `PrismaPackageRepository`: Signing packages
- `PrismaHistoryRepository`: Activity history
- `PrismaAuditLogRepository`: Audit logs
- `PrismaGroupSignatureRepository`: Group signatures
- `PrismaDashboardRepository`: Dashboard queries
- `PrismaAdminRepository`: Admin queries
- `PrismaVersionRepository`: Document versions

**Authentication & File Storage**

- `SupabaseAuthRepository`: User authentication
- `SupabaseFileStorage`: File upload/download

---

## 5. ALUR DATA & INTERAKSI SISTEM

### 5.1 User Registration Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ 1. POST /auth/register
     │ {email, password, name}
     ▼
┌─────────────────────────────────┐
│   authController.register       │
└────┬────────────────────────────┘
     │ 2. Validate input
     ▼
┌─────────────────────────────────┐
│   authService.registerUser      │
└────┬────────────────────────────┘
     │ 3. Create in Supabase Auth
     ▼
┌──────────────────────────────┐
│ SupabaseAuthRepository       │
│ .createUser()                │
└────┬───────────────────────┘
     │ 4. Get userId from Supabase
     ▼
┌────────────────────────────────┐
│ PrismaUserRepository           │
│ .create({userId, email, ...})  │
└────┬───────────────────────────┘
     │ 5. Store in PostgreSQL
     ▼
┌──────────────────────────────────┐
│ Response: JWT Token              │
│ {token, user}                    │
└──────────────────────────────────┘
```

### 5.2 Document Signing Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ 1. POST /signatures/sign
     │ {documentId, signatureData, method}
     ▼
┌────────────────────────────────┐
│ signatureController.sign       │
└────┬───────────────────────────┘
     │ 2. Verify user & document
     ▼
┌────────────────────────────────┐
│ signatureService.sign()        │
└────┬───────────────────────────┘
     │ 3a. Fetch document from Supabase
     ├──▶ SupabaseFileStorage
     │
     │ 3b. Process signing based on method
     ├──▶ If Canvas: apply signature image
     ├──▶ If QRCode: generate QR code
     │
     │ 4. Generate document hash
     ├──▶ pdfService.generateHash()
     │
     │ 5. Store signature record
     ├──▶ PrismaSignatureRepository.create()
     │
     │ 6. Update document status
     ├──▶ PrismaDocumentRepository.updateStatus()
     │
     │ 7. Create audit log
     ├──▶ PrismaAuditLogRepository.log()
     │
     ▼
┌──────────────────────────────┐
│ Response: Signed document    │
│ with signature & hash        │
└──────────────────────────────┘
```

### 5.3 Group Signing Workflow

```
User A (Initiator) creates group signing task
    │
    ▼
Send invitations to User B, C, D
    │
    ▼
User B receives notification (WebSocket)
    │
    ├── Accepts/Rejects → Update status
    │
    ▼
User C signs
    │
    ├── Signature recorded
    ├── Audit log created
    │
    ▼
User D signs
    │
    ├── All signatures collected
    ├── Document marked as COMPLETED
    ├── Send notifications to all participants
    │
    ▼
Dashboard shows completion status
```

### 5.4 Payment Processing Flow

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ 1. Choose premium plan
     │ POST /payments/process
     ▼
┌────────────────────────────────┐
│ paymentController.process      │
└────┬───────────────────────────┘
     │ 2. Call Midtrans API
     ▼
┌────────────────────────────────┐
│ paymentService.processPayment()│
└────┬───────────────────────────┘
     │ 3. Get payment token from Midtrans
     ▼
┌──────────────────────────────────────┐
│ Midtrans API (External)              │
│ Returns: snapToken, redirectUrl      │
└────┬───────────────────────────────────┘
     │ 4. Return token to client
     ▼
┌──────────────────────────────────────┐
│ Client redirect ke Midtrans Snap      │
│ (User completes payment)              │
└────┬───────────────────────────────────┘
     │ 5. Webhook notification
     │ POST /webhooks/payment
     ▼
┌────────────────────────────────┐
│ paymentService.handleWebhook() │
└────┬───────────────────────────┘
     │ 6. Update user premium status
     ▼
┌────────────────────────────────┐
│ PrismaUserRepository           │
│ .update({premiumUntil: date})  │
└────┬───────────────────────────┘
     │ 7. Send confirmation email
     ▼
✓ Premium activated
```

---

## 6. STACK TEKNOLOGI & JUSTIFIKASI

### 6.1 Backend

| Teknologi      | Versi  | Justifikasi                                                      |
| -------------- | ------ | ---------------------------------------------------------------- |
| **Node.js**    | LTS    | Runtime JavaScript async-first, cocok untuk I/O-heavy operations |
| **Express.js** | 5.1.0  | Lightweight framework dengan middleware ecosystem kaya           |
| **Prisma ORM** | 6.15.0 | Type-safe ORM dengan query builder intuitif                      |
| **PostgreSQL** | 14+    | Database relasional robust dengan ACID compliance                |
| **Redis**      | 5.10.0 | In-memory cache untuk session & caching                          |
| **Socket.io**  | 4.8.1  | Real-time bidirectional communication                            |
| **Supabase**   | 2.54.0 | Backend-as-a-service untuk Auth & Storage                        |
| **Multer**     | 2.0.2  | Middleware upload file                                           |
| **bcrypt**     | 6.0.0  | Password hashing dengan salt                                     |
| **JWT**        | -      | Token-based authentication stateless                             |
| **Midtrans**   | 1.4.3  | Payment gateway integration                                      |
| **pdf-lib**    | 1.17.1 | PDF manipulation library                                         |
| **QRCode**     | 1.5.4  | QR code generation                                               |
| **node-cron**  | 4.2.1  | Scheduled tasks (cron jobs)                                      |
| **Winston**    | 3.17.0 | Logging system                                                   |

### 6.2 Frontend

| Teknologi             | Justifikasi                                |
| --------------------- | ------------------------------------------ |
| **React.js**          | Component-based SPA dengan large ecosystem |
| **React Router**      | Client-side routing                        |
| **Axios**             | HTTP client dengan interceptors            |
| **Tailwind CSS**      | Utility-first CSS framework                |
| **Redux/Context API** | State management                           |
| **Socket.io Client**  | Real-time communication                    |

### 6.3 Development Tools

| Tools             | Fungsi                               |
| ----------------- | ------------------------------------ |
| **Nodemon**       | Auto-restart server pada development |
| **Jest**          | Unit testing framework               |
| **Dotenv**        | Environment variable management      |
| **Git**           | Version control                      |
| **Prisma Studio** | Visual database browser              |

---

## 7. POLA DESAIN ARSITEKTUR

### 7.1 Repository Pattern

**Tujuan**: Abstraksi akses data dari business logic

```javascript
// Interface
interface IUserRepository {
  findById(id: string): Promise<User>;
  create(data: UserCreateInput): Promise<User>;
  update(id: string, data: UserUpdateInput): Promise<User>;
  delete(id: string): Promise<void>;
}

// Implementation
class PrismaUserRepository implements IUserRepository {
  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
  // ... other methods
}

// Usage in Service
class UserService {
  constructor(private userRepository: IUserRepository) {}

  async getUserProfile(userId: string) {
    return this.userRepository.findById(userId);
  }
}
```

**Keuntungan**:

- Easy to test (mock repository)
- Flexible untuk switch database
- Clean separation of concerns

### 7.2 Service Layer Pattern

**Tujuan**: Centralize business logic

```javascript
class SignatureService {
  async signDocument(documentId: string, signatureData: any) {
    // 1. Validate
    // 2. Fetch document
    // 3. Process signing
    // 4. Generate hash
    // 5. Store signature
    // 6. Log audit
    // 7. Return result
  }
}
```

### 7.3 Dependency Injection Pattern

**Tujuan**: Loose coupling & easy testing

```javascript
// In app.js
const userRepository = new PrismaUserRepository();
const userService = new UserService(userRepository);
const userController = new UserController(userService);

// In controller
class UserController {
  constructor(private userService: UserService) {}

  async getProfile(req, res) {
    const user = await this.userService.getUserProfile(req.user.id);
    res.json(user);
  }
}
```

### 7.4 Factory Pattern (untuk repository)

**Tujuan**: Flexible creation of repository instances

```javascript
class RepositoryFactory {
  static createUserRepository(): IUserRepository {
    if (process.env.DB_TYPE === "prisma") {
      return new PrismaUserRepository();
    }
    // bisa extend untuk repository lain
  }
}
```

---

## 8. DATABASE SCHEMA & MODEL DATA

### 8.1 Entitas Utama

**Users**

```
id: UUID (PK)
email: String (UNIQUE)
name: String
phone_number: String
title: String
company: String
address: String
profile_picture_url: String
is_super_admin: Boolean
user_status: String (FREE, PREMIUM)
premium_until: DateTime
created_at: DateTime
updated_at: DateTime
tour_progress: JSON

Relations:
- administeredGroups: Group[] (One-to-Many)
- documents: Document[] (One-to-Many)
- signaturesPersonal: SignaturePersonal[] (One-to-Many)
- signaturesGroup: SignatureGroup[] (One-to-Many)
- groupMemberships: GroupMember[] (One-to-Many)
- sentInvitations: GroupInvitation[] (One-to-Many)
```

**Documents**

```
id: UUID (PK)
user_id: UUID (FK)
filename: String
file_path: String
file_size: Int
status: DocumentStatus (draft, pending, completed, archived)
document_hash: String (untuk integritas)
created_at: DateTime
updated_at: DateTime

Relations:
- owner: User (Many-to-One)
- versions: DocumentVersion[] (One-to-Many)
- signatures: SignaturePersonal[] (One-to-Many)
- groupSignatures: GroupSignature[] (One-to-Many)
- groupDocuments: GroupDocument[] (One-to-Many)
```

**SignaturePersonal**

```
id: UUID (PK)
document_id: UUID (FK)
user_id: UUID (FK)
signature_data: String (base64 atau path)
signature_hash: String (untuk verifikasi)
signing_method: SigningMethod (canvas, qrcode)
signed_at: DateTime
created_at: DateTime

Relations:
- document: Document (Many-to-One)
- signer: User (Many-to-One)
```

**SignatureGroup**

```
id: UUID (PK)
group_document_id: UUID (FK)
user_id: UUID (FK)
status: SignatureStatus (PENDING, SIGNED, REJECTED)
signature_data: String
signed_at: DateTime
created_at: DateTime

Relations:
- groupDocument: GroupDocument (Many-to-One)
- signer: User (Many-to-One)
```

**Groups**

```
id: UUID (PK)
name: String
description: String
admin_id: UUID (FK)
created_at: DateTime
updated_at: DateTime

Relations:
- admin: User (Many-to-One)
- members: GroupMember[] (One-to-Many)
- documents: GroupDocument[] (One-to-Many)
- invitations: GroupInvitation[] (One-to-Many)
```

**GroupMembers**

```
id: UUID (PK)
group_id: UUID (FK)
user_id: UUID (FK)
role: GroupMemberRole (admin_group, signer, viewer)
joined_at: DateTime

Relations:
- group: Group (Many-to-One)
- user: User (Many-to-One)

Constraint: UNIQUE(group_id, user_id)
```

**GroupDocuments**

```
id: UUID (PK)
group_id: UUID (FK)
document_id: UUID (FK)
initiator_id: UUID (FK)
status: DocumentStatus
created_at: DateTime
completed_at: DateTime

Relations:
- group: Group (Many-to-One)
- document: Document (Many-to-One)
- initiator: User (Many-to-One)
- signers: GroupDocumentSigner[] (One-to-Many)
- signatures: GroupSignature[] (One-to-Many)
```

**GroupDocumentSigners**

```
id: UUID (PK)
group_document_id: UUID (FK)
user_id: UUID (FK)
order: Int (urutan penandatangan)
status: SignatureStatus
invited_at: DateTime
signed_at: DateTime

Relations:
- groupDocument: GroupDocument (Many-to-One)
- user: User (Many-to-One)
```

**DocumentVersions**

```
id: UUID (PK)
document_id: UUID (FK)
version_number: Int
file_path: String
uploaded_by_id: UUID (FK)
created_at: DateTime

Relations:
- document: Document (Many-to-One)
- uploadedBy: User (Many-to-One)
```

**GroupInvitations**

```
id: UUID (PK)
group_id: UUID (FK)
inviter_id: UUID (FK)
email: String
status: InvitationStatus (active, used, expired)
token: String (UNIQUE)
expires_at: DateTime
created_at: DateTime

Relations:
- group: Group (Many-to-One)
- inviter: User (Many-to-One)
```

**AuditLogs**

```
id: UUID (PK)
actor_id: UUID (FK)
action: AuditAction
resource_type: String
resource_id: UUID
details: JSON
ip_address: String
user_agent: String
created_at: DateTime

Relations:
- actor: User (Many-to-One)
```

**Transactions (Payment)**

```
id: UUID (PK)
user_id: UUID (FK)
package_id: UUID (FK)
amount: Decimal
status: String (pending, success, failed)
payment_method: String
transaction_id: String (dari Midtrans)
created_at: DateTime
updated_at: DateTime

Relations:
- user: User (Many-to-One)
- package: SigningPackage (Many-to-One)
```

### 8.2 Diagram Relasi (Simplified)

```
┌─────────┐
│  Users  │
└────┬────┘
     ├── administers ──→ Groups
     ├── owns ──→ Documents
     ├── owns ──→ SignaturePersonal
     ├── joins ──→ GroupMembers ──→ Groups
     ├── invites ──→ GroupInvitation
     ├── signs ──→ SignatureGroup
     └── logs ──→ AuditLogs

     Documents
     ├── has ──→ DocumentVersions
     ├── has ──→ SignaturePersonal
     └── in ──→ GroupDocuments

     GroupDocuments
     ├── in ──→ Groups
     ├── has ──→ GroupDocumentSigners
     └── has ──→ GroupSignature

     GroupMembers
     ├── in ──→ Groups
     └── user ──→ Users
```

---

## 9. KEAMANAN & INTEGRITAS DATA

### 9.1 Authentication & Authorization

**Authentication Flow**

```
┌─────────────────────────────────────────┐
│ 1. User login dengan email & password   │
└──────────────┬──────────────────────────┘
               │
               ▼
    ┌─────────────────────────────┐
    │ Supabase Auth verification  │
    │ - Email verification        │
    │ - Password hash checking    │
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────┐
    │ Generate JWT Token                   │
    │ - Header: {alg, typ}                 │
    │ - Payload: {userId, email, role}     │
    │ - Signature: HMAC SHA-256             │
    └──────────────┬───────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────┐
    │ Return JWT to client                 │
    │ - Stored in localStorage/cookies     │
    └──────────────────────────────────────┘
```

**Authorization Flow**

```
┌──────────────────────────────────────────┐
│ Client requests dengan JWT token         │
│ Headers: {Authorization: Bearer <token>} │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ Middleware: JWT Verification             │
│ - Verify signature                       │
│ - Check token expiration                 │
│ - Extract user info                      │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│ Middleware: Authorization Check          │
│ - Check user role/permissions            │
│ - Verify resource ownership              │
│ - Role-based access control (RBAC)       │
└──────────────┬───────────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
   ✓ OK         ✗ Unauthorized
      │                 │
      ▼                 ▼
   Continue      Send 403 Forbidden
```

### 9.2 Data Integrity & Hashing

**Document Signing Process**

```
Original Document
    │
    ▼
Hash generation (SHA-256):
hash = SHA256(document_content + user_id + timestamp)
    │
    ▼
Signature creation:
- signature_hash = SHA256(signature_data)
- Store both hashes dalam database
    │
    ▼
Verification:
- Recalculate document hash
- Recalculate signature hash
- Compare dengan stored values
    │
    ├── Cocok: ✓ Document unmodified
    └── Berbeda: ✗ Document tampered
```

### 9.3 Password Security

```
┌──────────────────────────────────┐
│ User password (plain text)       │
└──────────────┬───────────────────┘
               │
               ▼
    ┌─────────────────────────────┐
    │ Generate random salt        │
    │ (bcrypt automatic)          │
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌─────────────────────────────┐
    │ Hash password + salt        │
    │ Using bcrypt:               │
    │ hash = bcrypt(password, 12) │
    └──────────────┬──────────────┘
                   │
                   ▼
    ┌──────────────────────────────┐
    │ Store hashed password        │
    │ dalam PostgreSQL             │
    └──────────────────────────────┘
```

### 9.4 Environment Variables & Secrets

```
.env file (NOT committed to git):
- DATABASE_URL=postgresql://...
- JWT_SECRET=<secret-key>
- SUPABASE_URL=<url>
- SUPABASE_KEY=<api-key>
- MIDTRANS_SERVER_KEY=<server-key>
- EMAIL_PASSWORD=<password>
```

### 9.5 CORS & Security Headers

```
CORS Configuration:
origin: ['http://localhost:3000', 'https://digisign.com']
credentials: true
methods: ['GET', 'POST', 'PUT', 'DELETE']
allowedHeaders: ['Content-Type', 'Authorization']

Security Headers:
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

### 9.6 Audit Trail

```
┌────────────────────────────────────┐
│ User Action (Sign, Upload, Delete) │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│ Log Creation (auditService)        │
│ - User ID (actor)                  │
│ - Action type                      │
│ - Resource type & ID               │
│ - Timestamp                        │
│ - IP address                       │
│ - User agent                       │
│ - Details (JSON)                   │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│ Store in AuditLog table            │
│ (PostgreSQL)                       │
└────────────────────────────────────┘
```

---

## 10. SKALABILITAS & PERFORMA

### 10.1 Horizontal Scaling

```
┌─────────────────────────────────────────────┐
│         Load Balancer (nginx)               │
│  • Round-robin distribution                 │
│  • Session persistence (sticky sessions)    │
└──────────┬──────────────────┬──────────────┘
           │                  │
    ┌──────▼────────┐   ┌─────▼───────────┐
    │ Node.js App 1 │   │ Node.js App 2   │
    │ :3001         │   │ :3002           │
    └──────┬────────┘   └─────┬───────────┘
           │                  │
           └──────────┬───────┘
                      │
         ┌────────────▼────────────┐
         │    PostgreSQL DB        │
         │  (Single or Replicated) │
         └────────────────────────┘
```

### 10.2 Caching Strategy

**Redis Cache untuk:**

1. **Session caching**: Store JWT tokens dan user sessions
2. **Query result caching**: Cache frequently accessed queries
3. **Rate limiting**: Track request counts per user/IP
4. **Real-time data**: WebSocket connection state

```javascript
// Example: Cache user profile
const cacheKey = `user:${userId}`;
const cachedUser = await redis.get(cacheKey);

if (cachedUser) {
  return JSON.parse(cachedUser);
}

const user = await database.findUser(userId);
await redis.setex(cacheKey, 3600, JSON.stringify(user)); // Expire dalam 1 jam

return user;
```

### 10.3 Database Optimization

**Indexing Strategy**

```sql
-- Frequently queried fields
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_signatures_document_id ON signatures(document_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);

-- Composite indexes
CREATE INDEX idx_group_members_composite
ON group_members(group_id, user_id);
```

**Query Optimization**

```javascript
// Avoid N+1 queries: Use Prisma relations
// ✗ BAD: Multiple queries
const documents = await prisma.document.findMany();
for (const doc of documents) {
  doc.owner = await prisma.user.findUnique({ where: { id: doc.userId } });
}

// ✓ GOOD: Single query with relations
const documents = await prisma.document.findMany({
  include: { owner: true },
});
```

### 10.4 API Rate Limiting

```javascript
// Rate limit config
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP",
});

// Apply to routes
app.post("/signatures/sign", limiter, signatureController.sign);
```

### 10.5 Monitoring & Metrics

**Metrics to track:**

- Request response time
- Database query performance
- Cache hit rate
- Error rate
- Active WebSocket connections
- Server resource utilization (CPU, Memory)

---

## 11. INTEGRASI EKSTERNAL

### 11.1 Supabase Integration

**Authentication:**

```javascript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: "user@example.com",
  password: "password",
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password",
});
```

**File Storage:**

```javascript
// Upload document
const { data, error } = await supabase.storage.from("documents").upload(`users/${userId}/documents/${filename}`, file);

// Download document
const { data, error } = await supabase.storage.from("documents").download(`users/${userId}/documents/${filename}`);
```

### 11.2 Midtrans Payment Gateway

**Payment Flow:**

```javascript
// Create transaction
const transaction = await midtrans.charge({
  payment_type: "credit_card",
  transaction_details: {
    gross_amount: 100000,
    order_id: "order-123",
  },
  customer_details: {
    email: "customer@example.com",
  },
});

// Get Snap token untuk UI
const snapToken = transaction.token;
```

**Webhook Handling:**

```javascript
// Midtrans sends notification
app.post('/webhooks/payment', (req, res) => {
  const notification = req.body;

  if (notification.transaction_status === 'settlement') {
    // Payment successful
    await updateUserPremium(notification.order_id);
  } else if (notification.transaction_status === 'deny') {
    // Payment failed
  }
});
```

### 11.3 Email Service Integration

**Using SendGrid atau SMTP:**

```javascript
// Send signing invitation
await emailService.sendSigningInvitation({
  to: "signer@example.com",
  documentName: "Contract.pdf",
  signingLink: "https://digisign.com/sign/abc123",
  expiresAt: new Date(),
});
```

### 11.4 WebSocket Integration

**Real-time Updates:**

```javascript
// Server-side
io.on("connection", (socket) => {
  socket.on("document-signed", (data) => {
    // Broadcast ke group members
    socket.to(`group-${data.groupId}`).emit("signature-received", {
      signer: data.userId,
      documentId: data.documentId,
      timestamp: new Date(),
    });
  });
});

// Client-side
socket.emit("document-signed", { groupId, documentId, userId });
socket.on("signature-received", (data) => {
  updateUIWithNewSignature(data);
});
```

---

## 12. DEPLOYMENT & INFRASTRUCTURE

### 12.1 Development Environment

```
Local Setup:
├── Node.js (LTS)
├── PostgreSQL (via Docker)
├── Redis (via Docker)
├── Supabase local development
└── Environment variables (.env.development)
```

**Docker Compose Example:**

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"

  redis:
    image: redis:latest
    ports:
      - "6379:6379"
```

### 12.2 Production Environment

```
Production Architecture:

┌─────────────────────────────────────────────┐
│         CDN (for static files)              │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼─────────────────────────┐
│    Load Balancer (AWS ALB / nginx)           │
│  • SSL/TLS termination                       │
│  • Health checks                             │
│  • Auto scaling                              │
└────────┬──────────────────────────┬──────────┘
         │                          │
    ┌────▼─────┐              ┌────▼─────┐
    │ App Server 1 (EC2)      │ App Server N (EC2)
    │ :3001     │              │ :3001     │
    └────┬──────┘              └────┬──────┘
         │                          │
         └──────────────┬───────────┘
                        │
        ┌───────────────▼────────────────┐
        │   RDS PostgreSQL (Multi-AZ)    │
        │   • Automated backups          │
        │   • Read replicas              │
        │   • Point-in-time recovery     │
        └────────────────────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │   ElastiCache Redis            │
        │   • Cluster mode               │
        │   • Automatic failover         │
        └────────────────────────────────┘
                        │
        ┌───────────────▼────────────────┐
        │  S3 / Supabase Storage         │
        │  • Version control             │
        │  • Encryption at rest          │
        └────────────────────────────────┘
```

### 12.3 Deployment Process

**CI/CD Pipeline:**

```
Git Commit/Push
    │
    ▼
GitHub Actions / GitLab CI
    ├─→ Run tests (npm test)
    ├─→ Run linter (eslint)
    ├─→ Build Docker image
    │
    ▼ (if all pass)
Push to Docker Registry
    │
    ▼
Deploy to Staging
    ├─→ Run integration tests
    ├─→ Performance tests
    │
    ▼ (if tests pass)
Deploy to Production
    ├─→ Blue-green deployment
    ├─→ Health checks
    ├─→ Rollback if needed
```

### 12.4 Backup & Disaster Recovery

**Database Backups:**

- Automated daily snapshots (AWS RDS)
- 7-day retention
- Cross-region replication
- Point-in-time recovery

**File Backups:**

- S3 versioning enabled
- Cross-region replication
- Lifecycle policies (archive old files)

**Disaster Recovery RTO/RPO:**

- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 1 hour

### 12.5 Monitoring & Logging

**Monitoring Tools:**

- CloudWatch (AWS) untuk metrics & logs
- Datadog atau New Relic untuk APM
- PagerDuty untuk alerting

**Key Metrics:**

- API response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Database connection pool utilization
- Cache hit rate
- CPU & Memory utilization
- Disk I/O

**Logging:**

- Centralized logging (ELK Stack / CloudWatch)
- Structured logging (JSON format)
- Log retention: 30 days production, 7 days staging

---

## KESIMPULAN

**DigiSign** adalah platform tanda tangan digital enterprise yang dibangun dengan:

1. **Arsitektur Berlapis**: Pemisahan concern yang jelas antara presentation, application, dan persistence layer
2. **Teknologi Modern**: Node.js/Express, Prisma, PostgreSQL, Redis, Socket.io
3. **Security-First**: JWT authentication, bcrypt hashing, audit trail
4. **Scalability**: Horizontal scaling dengan load balancer, caching strategy
5. **Integration**: Supabase, Midtrans, email services
6. **Monitoring**: Comprehensive logging dan metrics collection

Arsitektur ini memastikan sistem dapat scale untuk menangani ribuan user, maintain code quality, dan provide secure digital signature solution.

---

## REFERENSI DIAGRAM

### ERD (Entity Relationship Diagram)

Lihat: `prisma/dbml/schema.dbml` atau jalankan `prisma db pull && prisma dbml`

### Sequence Diagram

Lihat: `docs/SEQUENCE_DIAGRAM.md`

### Use Case Diagram

Lihat: `docs/USE_CASE_DIAGRAM.md`

### Class Diagram

Lihat: `docs/CLASS_DIAGRAM.md`

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Author**: DigiSign Development Team  
**Status**: Final for Academic Reference
