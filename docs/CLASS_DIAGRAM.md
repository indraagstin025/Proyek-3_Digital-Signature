# DigiSign Backend - Class Diagram

Dokumentasi lengkap class diagram sistem DigiSign Backend.

---

## 1. Domain Model Class Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         DOMAIN ENTITIES                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────┐                ┌─────────────────────────┐   │
│  │        User             │                │     Document            │   │
│  ├─────────────────────────┤                ├─────────────────────────┤   │
│  │ - id: UUID              │                │ - id: UUID              │   │
│  │ - email: string         │<───────────────│ - userId: UUID (FK)     │   │
│  │ - name: string          │     owns    1..*│ - title: string         │   │
│  │ - passwordHash: string  │                │ - description: string   │   │
│  │ - tier: enum            │                │ - status: enum          │   │
│  │ - tierUntil: datetime   │                │ - groupId: UUID (FK)    │   │
│  │ - profilePicture: string│                │ - currentVersionId: UUID│   │
│  │ - createdAt: datetime   │                │ - createdAt: datetime   │   │
│  │ - updatedAt: datetime   │                │ - updatedAt: datetime   │   │
│  ├─────────────────────────┤                ├─────────────────────────┤   │
│  │ + register()            │                │ + createVersion()       │   │
│  │ + login()               │                │ + updateStatus()        │   │
│  │ + updateProfile()       │                │ + delete()              │   │
│  │ + updateTier()          │                │ + rollback()            │   │
│  │ + getUsageStats()       │                │ + getVersions()         │   │
│  │ + deleteAccount()       │                │ + getCurrentVersion()   │   │
│  └─────────────────────────┘                └────────┬────────────────┘   │
│           │ 1                                         │ 1                  │
│           │                         ┌────────────────┘                     │
│           │                         │                                     │
│           │                  ┌──────▼──────────────────┐                  │
│           │                  │  DocumentVersion        │                  │
│           │                  ├─────────────────────────┤                  │
│           │                  │ - id: UUID              │                  │
│           │                  │ - documentId: UUID (FK) │                  │
│           │                  │ - versionNumber: int    │                  │
│           │                  │ - fileUrl: string       │                  │
│           │                  │ - fileHash: string      │                  │
│           │                  │ - createdAt: datetime   │                  │
│           │                  ├─────────────────────────┤                  │
│           │                  │ + getFile()             │                  │
│           │                  │ + verify()              │                  │
│           │                  │ + getSignatures()       │                  │
│           │                  └──────────────────────────┘                  │
│           │                                                                 │
│  ┌────────▼─────────────────┐                                             │
│  │       Group              │                                             │
│  ├──────────────────────────┤                                             │
│  │ - id: UUID               │────┐                                        │
│  │ - name: string           │    │ owns 1..*                              │
│  │ - userId: UUID (FK)      │    │  ┌─────────────────────────────────┐  │
│  │ - description: string    │    │  │   GroupMember                   │  │
│  │ - createdAt: datetime    │    │  ├─────────────────────────────────┤  │
│  │ - updatedAt: datetime    │    │  │ - id: UUID                      │  │
│  ├──────────────────────────┤    │  │ - groupId: UUID (FK)            │  │
│  │ + addMember()            │    │  │ - memberId: UUID (FK)           │  │
│  │ + removeMember()         │    │  │ - role: enum                    │  │
│  │ + assignDocument()       │    │  │ - joinedAt: datetime            │  │
│  │ + getMembers()           │    │  │ - status: enum                  │  │
│  │ + updateInfo()           │    │  ├─────────────────────────────────┤  │
│  │ + delete()               │    │  │ + updateRole()                  │  │
│  └──────────────────────────┘    │  │ + deactivate()                  │  │
│           │                       │  │ + reactivate()                  │  │
│           │                       │  └─────────────────────────────────┘  │
│           │                       │           │                           │
│           │                       │           │ belongs to               │
│           │                       │           │                           │
│           │                       └───────────┼─────────────────────────  │
│           │                                   │                           │
│           └───────────────────────────────────┤─────────────────────────  │
│                       manages 1..*            │                           │
│                                               │                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │            Signature                                                │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ - id: UUID                                                          │  │
│  │ - docVersionId: UUID (FK)                                           │  │
│  │ - requesterId: UUID (FK)                                            │  │
│  │ - signerId: UUID (FK)                                               │  │
│  │ - status: enum (PENDING, SIGNED, REJECTED, EXPIRED)               │  │
│  │ - signatureData: string                                             │  │
│  │ - signedAt: datetime                                                │  │
│  │ - expiresAt: datetime                                               │  │
│  │ - ipAddress: string                                                 │  │
│  │ - createdAt: datetime                                               │  │
│  ├─────────────────────────────────────────────────────────────────────┤  │
│  │ + send()                                                            │  │
│  │ + sign()                                                            │  │
│  │ + reject()                                                          │  │
│  │ + verify()                                                          │  │
│  │ + getDocument()                                                     │  │
│  │ + getRequester()                                                    │  │
│  │ + getSigner()                                                       │  │
│  │ + getAuditTrail()                                                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────┐  ┌────────────────────────────────┐ │
│  │  GroupDocumentSigner             │  │  SignatureField                │ │
│  ├──────────────────────────────────┤  ├────────────────────────────────┤ │
│  │ - id: UUID                       │  │ - id: UUID                     │ │
│  │ - documentId: UUID (FK)          │  │ - docVersionId: UUID (FK)      │ │
│  │ - groupId: UUID (FK)             │  │ - fieldName: string            │ │
│  │ - signerIndex: int               │  │ - pageNumber: int              │ │
│  │ - status: enum                   │  │ - position: {x, y}             │ │
│  │ - createdAt: datetime            │  │ - size: {width, height}        │ │
│  ├──────────────────────────────────┤  │ - isRequired: boolean           │ │
│  │ + updateStatus()                 │  │ - fieldType: enum              │ │
│  │ + getGroupMembers()              │  ├────────────────────────────────┤ │
│  │ + notifyMembers()                │  │ + validate()                   │ │
│  │ + trackProgress()                │  │ + isCompleted()                │ │
│  └──────────────────────────────────┘  │ + getSignature()               │ │
│                                         └────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────┐  ┌────────────────────────────────┐ │
│  │  Payment                         │  │  PaymentTransaction            │ │
│  ├──────────────────────────────────┤  ├────────────────────────────────┤ │
│  │ - id: UUID                       │  │ - id: UUID                     │ │
│  │ - userId: UUID (FK)              │  │ - paymentId: UUID (FK)         │ │
│  │ - orderId: string                │  │ - status: enum                 │ │
│  │ - amount: decimal                │  │ - transactionId: string        │ │
│  │ - currency: string               │  │ - amount: decimal              │ │
│  │ - status: enum                   │  │ - paymentMethod: string        │ │
│  │ - plan: enum (MONTHLY/YEARLY)    │  │ - timestamp: datetime          │ │
│  │ - createdAt: datetime            │  │ - responseData: JSON           │ │
│  ├──────────────────────────────────┤  │ - errorMessage: string         │ │
│  │ + createOrder()                  │  ├────────────────────────────────┤ │
│  │ + generateSnapToken()            │  │ + updateStatus()               │ │
│  │ + handleWebhook()                │  │ + verify()                     │ │
│  │ + updateStatus()                 │  │ + retry()                      │ │
│  │ + cancel()                       │  │ + refund()                     │ │
│  │ + refund()                       │  └────────────────────────────────┘ │
│  └──────────────────────────────────┘                                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Layer Class Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         SERVICE CLASSES                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐                                      │
│  │   <<abstract>> BaseService        │                                      │
│  ├──────────────────────────────────┤                                      │
│  │ # logger: Logger                 │                                      │
│  │ # repository: BaseRepository     │                                      │
│  ├──────────────────────────────────┤                                      │
│  │ + validate()                     │                                      │
│  │ + log()                          │                                      │
│  │ + handleError()                  │                                      │
│  │ + recordAudit()                  │                                      │
│  └──────────────────────────────────┘                                      │
│           △                                                                 │
│           │ extends                                                         │
│  ┌────────┴─────────┬──────────────┬──────────────┬──────────────────────┐ │
│  │                  │              │              │                      │ │
│  ▼                  ▼              ▼              ▼                      ▼ │
│  ┌─────────────────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐
│  │  DocumentService        │  │UserService  │  │GroupService │  │PaymentSvc
│  ├─────────────────────────┤  ├─────────────┤  ├─────────────┤  ├─────────┐
│  │- documentRepo           │  │- userRepo   │  │- groupRepo  │  │- payRepo│
│  │- fileStorage            │  │- fileStorage│  │- memberRepo │  │- midtrans
│  │- signatureService       │  │- auditServ  │  │- auditServ  │  │- auditSrv
│  │- auditService           │  │             │  │             │  │        │
│  ├─────────────────────────┤  ├─────────────┤  ├─────────────┤  ├─────────┐
│  │+ createDocument()       │  │+ register() │  │+ create()   │  │+ createOrd
│  │+ uploadFile()           │  │+ login()    │  │+ addMember()│  │+ genToken
│  │+ updateDocument()       │  │+ updateProf │  │+ removeMem()│  │+ handleWbk
│  │+ deleteDocument()       │  │+ deleteAcc. │  │+ assignDoc()│  │+ updateSts
│  │+ createVersion()        │  │+ uploadPic()│  │+ getMembers │  │+ cancel()
│  │+ getVersion()           │  │+ getStats() │  │+ delGroup() │  │+ refund()
│  │+ rollbackVersion()      │  │+ verifyEmail│  │             │  │        │
│  │+ listVersions()         │  │+ updatePass │  │             │  │        │
│  │+ validateDocument()     │  │             │  │             │  │        │
│  └──────────────┬──────────┘  └──────┬──────┘  └──────┬──────┘  └────┬────┐
│                 │                    │               │             │    │
│                 │ uses                │ uses          │ uses        │    │
│                 │                    │               │             │    │
│  ┌──────────────▼────────────────────▼─────────────────────────────────┐ │
│  │              SignatureService                                       │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │ - signatureRepo                                                     │ │
│  │ - documentService                                                   │ │
│  │ - emailService                                                      │ │
│  │ - pdfService                                                        │ │
│  │ - auditService                                                      │ │
│  │ - notificationService                                               │ │
│  ├─────────────────────────────────────────────────────────────────────┤ │
│  │ + createRequest()                                                   │ │
│  │ + sendRequest()                                                     │ │
│  │ + getSigner()                                                       │ │
│  │ + sign()                                                            │ │
│  │ + reject()                                                          │ │
│  │ + verify()                                                          │ │
│  │ + getStatus()                                                       │ │
│  │ + getPendingSignatures()                                            │ │
│  │ + getCompletedSignatures()                                          │ │
│  │ + generateSigningLink()                                             │ │
│  │ + validateSignature()                                               │ │
│  │ + createSignedPDF()                                                 │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│           △                                                                │
│           │ uses                                                          │
│  ┌────────┴──────────┬─────────────────┬──────────────┬────────────────┐ │
│  │                   │                 │              │                │ │
│  ▼                   ▼                 ▼              ▼                ▼ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐
│  │  PDFService  │  │EmailService  │  │DashboardSvc  │  │AuditService  │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├────────────────┤
│  │- pdfKit      │  │- emailClient │  │- docRepo    │  │- auditRepo    │
│  │- pdfLib      │  │- templates   │  │- signRepo   │  │- logger       │
│  │- fileStorage │  │- scheduler   │  │- cache      │  │               │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├────────────────┤
│  │+ generate()  │  │+ send()      │  │+ getSummary()│  │+ log()        │
│  │+ embed()     │  │+ sendBatch() │  │+ getCounts() │  │+ record()     │
│  │+ compress()  │  │+ resend()    │  │+ getActions()│  │+ query()      │
│  │+ validate()  │  │+ template()  │  │+ getActivity│  │+ export()     │
│  │+ sign()      │  │              │  │             │  │               │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────────┘
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Repository Layer Class Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      REPOSITORY CLASSES                                     │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐                                      │
│  │  <<abstract>> BaseRepository      │                                      │
│  ├──────────────────────────────────┤                                      │
│  │ # prisma: PrismaClient           │                                      │
│  ├──────────────────────────────────┤                                      │
│  │ + findById()                     │                                      │
│  │ + findAll()                      │                                      │
│  │ + create()                       │                                      │
│  │ + update()                       │                                      │
│  │ + delete()                       │                                      │
│  │ + query()                        │                                      │
│  │ + paginate()                     │                                      │
│  └──────────────────────────────────┘                                      │
│           △                                                                 │
│           │ extends                                                         │
│  ┌────────┴──────────┬─────────────┬──────────────┬────────────────────┐  │
│  │                   │             │              │                    │  │
│  ▼                   ▼             ▼              ▼                    ▼  │
│  ┌──────────────────┐  ┌────────────────┐  ┌─────────────────┐  ┌────────┐
│  │DocumentRepository │  │UserRepository  │  │GroupRepository  │  │Signature
│  ├──────────────────┤  ├────────────────┤  ├─────────────────┤  ├────────┐
│  │+ findByUser()    │  │+ findByEmail() │  │+ findByUser()   │  │+ findBy
│  │+ findByGroup()   │  │+ findByName()  │  │+ findByName()   │  │  Document
│  │+ countByStatus() │  │+ create()      │  │+ getMembers()   │  │+ findBy
│  │+ findDrafts()    │  │+ update()      │  │+ addMember()    │  │  Signer
│  │+ findPending()   │  │+ delete()      │  │+ removeMember() │  │+ create()
│  │+ findCompleted() │  │+ updateTier()  │  │+ deleteGroup()  │  │+ update()
│  │+ search()        │  │+ getUsageStats │  │+ updateInfo()   │  │+ delete()
│  │+ getVersions()   │  │+ isActive()    │  │+ assignDocument │  │+ sign()
│  │+ createVersion() │  │+ updateLastSn. │  │+ getDocuments() │  │+ reject()
│  │+ getRoles()      │  │+ verifyEmail() │  │+ getMemberStats │  │+ getPending
│  │+ createVersion() │  │+ resetPassword │  │                 │  │+ getStatus
│  │+ getByVersion()  │  │                │  │                 │  │+ verify()
│  └──────────────────┘  └────────────────┘  └─────────────────┘  └────────┐
│                                                                              │
│  ┌──────────────────────────┐  ┌──────────────────────┐                   │
│  │ PaymentRepository         │  │HistoryRepository     │                   │
│  ├──────────────────────────┤  ├──────────────────────┤                   │
│  │+ findByUser()            │  │+ findByDocument()    │                   │
│  │+ findByOrder()           │  │+ findByUser()        │                   │
│  │+ findByStatus()          │  │+ findByAction()      │                   │
│  │+ create()                │  │+ create()            │                   │
│  │+ updateStatus()          │  │+ query()             │                   │
│  │+ recordTransaction()      │  │+ export()            │                   │
│  │+ getStats()              │  │+ getTimelineStats()  │                   │
│  │+ getPending()            │  │+ searchActivity()    │                   │
│  └──────────────────────────┘  └──────────────────────┘                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ GroupDocumentSignerRepository                                         │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │+ findByGroup()                                                        │  │
│  │+ findByDocument()                                                     │  │
│  │+ findPending()                                                        │  │
│  │+ create()                                                             │  │
│  │+ updateStatus()                                                       │  │
│  │+ trackProgress()                                                      │  │
│  │+ getCompletionStats()                                                 │  │
│  │+ notifyMembers()                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Controller Layer Class Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       CONTROLLER CLASSES                                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐                                      │
│  │  <<abstract>> BaseController      │                                      │
│  ├──────────────────────────────────┤                                      │
│  │ # service: BaseService           │                                      │
│  │ # logger: Logger                 │                                      │
│  ├──────────────────────────────────┤                                      │
│  │ + sendSuccess()                  │                                      │
│  │ + sendError()                    │                                      │
│  │ + validateRequest()              │                                      │
│  │ + extractUser()                  │                                      │
│  └──────────────────────────────────┘                                      │
│           △                                                                 │
│           │ extends                                                         │
│  ┌────────┴──────────┬──────────┬────────────┬──────────────────────────┐ │
│  │                   │          │            │                          │ │
│  ▼                   ▼          ▼            ▼                          ▼ │
│  ┌──────────────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────┐
│  │ DocumentCtrller  │  │UserCtrller │  │GroupCtrller  │  │SignatureCtrll
│  ├──────────────────┤  ├────────────┤  ├──────────────┤  ├──────────────┐
│  │- docService      │  │- userServ  │  │- groupServ   │  │- signServ    │
│  ├──────────────────┤  ├────────────┤  ├──────────────┤  ├──────────────┤
│  │+ uploadDocument()│  │+ register()│  │+ createGroup │  │+ createReq() │
│  │+ listDocuments()│  │+ login()   │  │+ addMember() │  │+ sendRequest │
│  │+ getDocument()  │  │+ getProfile│  │+ getGroup()  │  │+ sign()      │
│  │+ updateDocument │  │+ updateProf│  │+ updateGroup │  │+ reject()    │
│  │+ deleteDocument │  │+ deleteAcc.│  │+ deleteGroup │  │+ getStatus() │
│  │+ listVersions() │  │+ uploadPic │  │+ getMembers()│  │+ verify()    │
│  │+ getVersion()   │  │+ changePass│  │+ assignDoc() │  │+ getDocument │
│  │+ rollback()     │  │+ getStats()│  │+ removeDoc() │  │+ download()  │
│  │+ getActionItems │  │+ deletePic │  │             │  │             │
│  │+ shareDocument()│  │             │  │             │  │             │
│  └──────────────────┘  └────────────┘  └──────────────┘  └──────────────┘
│                                                                              │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │PaymentCtrller  │  │DashboardCtrller  │  │HistoryController           │ │
│  ├────────────────┤  ├──────────────────┤  ├─────────────────────────────┤ │
│  │- payService    │  │- dashService     │  │ - historyService           │ │
│  ├────────────────┤  ├──────────────────┤  ├─────────────────────────────┤ │
│  │+ subscribe()   │  │+ getDashboard()  │  │ + getDocumentHistory()    │ │
│  │+ webhook()     │  │+ getCounts()     │  │ + getActionHistory()      │ │
│  │+ getStatus()   │  │+ getActions()    │  │ + getUserActivity()       │ │
│  │+ cancel()      │  │+ getActivity()   │  │ + getAuditTrail()         │ │
│  │+ refund()      │  │                  │  │ + export()                │ │
│  └────────────────┘  └──────────────────┘  └─────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────┐  ┌───────────────────────────────────────────┐   │
│  │AuthController        │  │AdminController                            │   │
│  ├──────────────────────┤  ├───────────────────────────────────────────┤   │
│  │- authService         │  │- adminService                             │   │
│  ├──────────────────────┤  ├───────────────────────────────────────────┤   │
│  │+ register()          │  │+ getUsers()                               │   │
│  │+ login()             │  │+ getUserDetail()                          │   │
│  │+ logout()            │  │+ activateUser()                           │   │
│  │+ refreshToken()      │  │+ deactivateUser()                         │   │
│  │+ verifyEmail()       │  │+ getSystemStats()                         │   │
│  │+ resetPassword()     │  │+ getAuditLogs()                           │   │
│  └──────────────────────┘  │+ exportLogs()                             │   │
│                             │+ deleteUser()                             │   │
│                             └───────────────────────────────────────────┘   │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Error & Exception Class Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    ERROR & EXCEPTION CLASSES                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐                                      │
│  │  <<abstract>> CustomError        │                                      │
│  │  extends Error                   │                                      │
│  ├──────────────────────────────────┤                                      │
│  │ # statusCode: number             │                                      │
│  │ # message: string                │                                      │
│  │ # details: object                │                                      │
│  │ # timestamp: datetime            │                                      │
│  ├──────────────────────────────────┤                                      │
│  │ + getStatusCode()                │                                      │
│  │ + toJSON()                       │                                      │
│  │ + log()                          │                                      │
│  └──────────────────────────────────┘                                      │
│           △                                                                 │
│           │ extends                                                         │
│  ┌────────┴────────┬────────────┬────────────┬──────────────────────────┐ │
│  │                 │            │            │                          │ │
│  ▼                 ▼            ▼            ▼                          ▼ │
│  ┌──────────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐
│  │CommonError   │  │UserError   │  │DocumentError │  │SignatureError  │
│  ├──────────────┤  ├────────────┤  ├──────────────┤  ├──────────────────┤
│  │- 400: Req    │  │- 401: Auth │  │- 404: Not    │  │- PENDING: Wait   │
│  │- 401: Auth   │  │- 403: Forbid       Found    │  │- SIGNED: Done    │
│  │- 403: Forbid │  │- 409: Conflict    │  │- 409: Conflict  │  │- REJECTED: No   │
│  │- 500: Server │  │                   │  │- 413: Large     │  │- EXPIRED: Time  │
│  │  Error       │  │                   │  │                 │  │                 │
│  └──────────────┘  └────────────────┘  └──────────────┘  └──────────────────┘
│                                                                              │
│  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │PaymentError      │  │ValidationError  │  │NotFoundError             │  │
│  ├──────────────────┤  ├─────────────────┤  ├──────────────────────────┤  │
│  │- Charge Failed   │  │- Invalid Email  │  │- Resource Not Found      │  │
│  │- Invalid Token   │  │- Invalid Format │  │- Endpoint Not Found      │  │
│  │- Duplicate Order │  │- Missing Field  │  │- Document Not Found      │  │
│  │- Refund Failed   │  │- Invalid Value  │  │- User Not Found          │  │
│  └──────────────────┘  └─────────────────┘  └──────────────────────────┘  │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Utility & Helper Class Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   UTILITY & HELPER CLASSES                                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │  JWTHelper                       │  │  EncryptionHelper               │ │
│  ├──────────────────────────────────┤  ├─────────────────────────────────┤ │
│  │+ generateToken()                 │  │+ hashPassword()                 │ │
│  │+ verifyToken()                   │  │+ comparePassword()              │ │
│  │+ decodeToken()                   │  │+ encryptData()                  │ │
│  │+ refreshToken()                  │  │+ decryptData()                  │ │
│  │+ getTokenExpiry()                │  │+ generateHash()                 │ │
│  │+ extractUserIdFromToken()        │  │+ verifyHash()                   │ │
│  └──────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │  ValidationHelper                │  │  DateTimeHelper                 │ │
│  ├──────────────────────────────────┤  ├─────────────────────────────────┤ │
│  │+ isValidEmail()                  │  │+ getCurrentDateTime()           │ │
│  │+ isValidPhone()                  │  │+ addDays()                      │ │
│  │+ isValidUUID()                   │  │+ addMonths()                    │ │
│  │+ isValidPassword()               │  │+ getTimeDifference()            │ │
│  │+ isValidFileType()               │  │+ formatDateTime()               │ │
│  │+ isValidFileSize()               │  │+ parseDateTime()                │ │
│  │+ sanitizeInput()                 │  │+ isExpired()                    │ │
│  │+ validatePagination()            │  │+ getExpiryDateTime()            │ │
│  └──────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │  FileHelper                      │  │  PaginationHelper               │ │
│  ├──────────────────────────────────┤  ├─────────────────────────────────┤ │
│  │+ generateFileName()              │  │+ calculateOffset()              │ │
│  │+ getFileExtension()              │  │+ getPaginationParams()          │ │
│  │+ validateFileType()              │  │+ buildPaginationResponse()      │ │
│  │+ compressFile()                  │  │+ validatePageNumber()           │ │
│  │+ uploadToStorage()               │  │+ getPageCount()                 │ │
│  │+ deleteFromStorage()             │  │+ createLinks()                  │ │
│  │+ generatePublicURL()             │  │+ applySort()                    │ │
│  │+ getFileSize()                   │  │+ applyFilter()                  │ │
│  └──────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │  EmailHelper                     │  │  PaymentHelper                  │ │
│  ├──────────────────────────────────┤  ├─────────────────────────────────┤ │
│  │+ formatEmailBody()               │  │+ generateOrderId()              │ │
│  │+ buildEmailTemplate()            │  │+ generateSignatureKey()         │ │
│  │+ sendEmail()                     │  │+ verifySignature()              │ │
│  │+ sendBulkEmails()                │  │+ calculateAmount()              │ │
│  │+ scheduleEmail()                 │  │+ formatCurrency()               │ │
│  │+ getEmailTemplate()              │  │+ getPlanPrice()                 │ │
│  │+ attachFile()                    │  │+ calculateTierUntil()           │ │
│  └──────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  LoggerHelper                                                        │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │+ info()                                                              │  │
│  │+ warn()                                                              │  │
│  │+ error()                                                             │  │
│  │+ debug()                                                             │  │
│  │+ trace()                                                             │  │
│  │+ maskedLog() (Sanitize sensitive data)                              │  │
│  │+ formatLog()                                                         │  │
│  │+ getLogLevel()                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Middleware Class Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        MIDDLEWARE CLASSES                                   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐                                      │
│  │  <<abstract>> BaseMiddleware      │                                      │
│  ├──────────────────────────────────┤                                      │
│  │ + handle()                       │                                      │
│  │ + next()                         │                                      │
│  └──────────────────────────────────┘                                      │
│           △                                                                 │
│           │ implements                                                      │
│  ┌────────┴──────────┬──────────────┬────────────┬────────────────────────┐
│  │                   │              │            │                        │
│  ▼                   ▼              ▼            ▼                        ▼
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────────┐  ┌────────────┐
│  │AuthMiddleware    │  │ErrorHandler    │  │RateLimiter     │  │CORSHandler │
│  ├──────────────────┤  ├────────────────┤  ├────────────────┤  ├────────────┤
│  │- jwtHelper       │  │- logger        │  │- redisClient   │  │- origins   │
│  ├──────────────────┤  ├────────────────┤  ├────────────────┤  ├────────────┤
│  │+ verifyToken()   │  │+ catch()       │  │+ check()       │  │+ configure │
│  │+ extractUser()   │  │+ format()      │  │+ validateLimit │  │+ handler() │
│  │+ checkExpiry()   │  │+ log()         │  │+ trackUsage()  │  │+ preflight │
│  │+ requireAuth()   │  │+ sendResponse()│  │+ blockIP()     │  │            │
│  └──────────────────┘  └────────────────┘  └────────────────┘  └────────────┘
│                                                                              │
│  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────────────────┐ │
│  │RequestValidator  │  │LoggingMiddleware│  │SecurityHeaders             │ │
│  ├──────────────────┤  ├─────────────────┤  ├────────────────────────────┤ │
│  │+ validateBody()  │  │- logger         │  │+ setCSP()                  │ │
│  │+ validateParams()│  │+ logRequest()   │  │+ setXFrame()               │ │
│  │+ validateQuery() │  │+ logResponse()  │  │+ setXContent()             │ │
│  │+ customRules()   │  │+ trackDuration()│  │+ setHSTS()                 │ │
│  │+ sanitize()      │  │+ recordMetrics()│  │+ setReferrerPolicy()       │ │
│  └──────────────────┘  └─────────────────┘  └────────────────────────────┘ │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Dependency Injection & Configuration Class Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│              DEPENDENCY INJECTION & CONFIGURATION                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Container (Service Locator / IoC)                                     │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ - services: Map<string, any>                                           │ │
│  │ - singletons: Map<string, any>                                         │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ + register()                                                           │ │
│  │ + singleton()                                                          │ │
│  │ + get()                                                                │ │
│  │ + resolve()                                                            │ │
│  │ + make()                                                               │ │
│  │ + bindController()                                                     │ │
│  │ + bindService()                                                        │ │
│  │ + bindRepository()                                                     │ │
│  │ + bindMiddleware()                                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│           │ uses                                                            │
│           │                                                                 │
│  ┌────────▼─────────────────────────────────────────────────────────────┐  │
│  │  Configuration Manager                                                │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ - env: string                                                         │  │
│  │ - config: Map<string, any>                                           │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ + loadEnv()                                                           │  │
│  │ + get()                                                               │  │
│  │ + set()                                                               │  │
│  │ + getDatabaseConfig()                                                 │  │
│  │ + getRedisConfig()                                                    │  │
│  │ + getEmailConfig()                                                    │  │
│  │ + getPaymentConfig()                                                  │  │
│  │ + getStorageConfig()                                                  │  │
│  │ + validate()                                                          │  │
│  │ + isProduction()                                                      │  │
│  │ + isDevelopment()                                                     │  │
│  │ + isTest()                                                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  DatabaseFactory                                                       │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ - prisma: PrismaClient                                                │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ + connect()                                                            │ │
│  │ + disconnect()                                                         │ │
│  │ + getInstance()                                                        │ │
│  │ + runMigrations()                                                      │ │
│  │ + seed()                                                               │ │
│  │ + backup()                                                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  CacheFactory                                                          │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ - redis: RedisClient                                                  │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │ + connect()                                                            │ │
│  │ + disconnect()                                                         │ │
│  │ + getInstance()                                                        │ │
│  │ + flush()                                                              │ │
│  │ + setupPubSub()                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Request/Response Classes Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   REQUEST & RESPONSE CLASSES                                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │  APIResponse<T>                  │  │  APIError                       │ │
│  ├──────────────────────────────────┤  ├─────────────────────────────────┤ │
│  │ - success: boolean               │  │ - statusCode: number            │ │
│  │ - data: T                        │  │ - message: string               │ │
│  │ - message: string                │  │ - errors: array                 │ │
│  │ - timestamp: datetime            │  │ - timestamp: datetime           │ │
│  │ - metadata: object               │  │ - path: string                  │ │
│  ├──────────────────────────────────┤  ├─────────────────────────────────┤ │
│  │ + ok()                           │  │ + toJSON()                      │ │
│  │ + created()                      │  │ + withDetails()                 │ │
│  │ + withMeta()                     │  │ + addError()                    │ │
│  │ + withPagination()               │  │ + addValidationError()          │ │
│  │ + toJSON()                       │  │ + log()                         │ │
│  └──────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │  PaginationRequest               │  │  PaginationResponse<T>          │ │
│  ├──────────────────────────────────┤  ├─────────────────────────────────┤ │
│  │ - page: number                   │  │ - data: T[]                     │ │
│  │ - limit: number                  │  │ - page: number                  │ │
│  │ - sortBy: string                 │  │ - limit: number                 │ │
│  │ - sortOrder: string              │  │ - total: number                 │ │
│  │ - filter: object                 │  │ - pages: number                 │ │
│  ├──────────────────────────────────┤  │ - hasMore: boolean              │ │
│  │ + validate()                     │  ├─────────────────────────────────┤ │
│  │ + getOffset()                    │  │ + toJSON()                      │ │
│  │ + getSortQuery()                 │  │ + getLinks()                    │ │
│  │ + getFilterQuery()               │  │ + getMetadata()                 │ │
│  └──────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  AuthRequest / AuthResponse                                          │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  AuthRequest                                                         │  │
│  │  - email: string                                                    │  │
│  │  - password: string                                                 │  │
│  │                                                                      │  │
│  │  AuthResponse                                                        │  │
│  │  - user: {id, email, name, tier}                                   │  │
│  │  - token: string                                                    │  │
│  │  - refreshToken: string (optional)                                 │  │
│  │  - expiresIn: number                                                │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  DocumentRequest / DocumentResponse                                  │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │  DocumentRequest                                                     │  │
│  │  - title: string                                                    │  │
│  │  - description: string                                              │  │
│  │  - file: Buffer                                                     │  │
│  │  - groupId: UUID (optional)                                         │  │
│  │                                                                      │  │
│  │  DocumentResponse                                                    │  │
│  │  - id: UUID                                                         │  │
│  │  - title: string                                                    │  │
│  │  - status: enum                                                     │  │
│  │  - version: number                                                  │  │
│  │  - owner: {id, name}                                                │  │
│  │  - createdAt: datetime                                              │  │
│  │  - signatureProgress: {total, completed, pending}                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Event & Observer Pattern Class Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    EVENT & OBSERVER PATTERN                                 │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐                                      │
│  │  <<interface>> EventListener      │                                      │
│  ├──────────────────────────────────┤                                      │
│  │ + on(eventName, callback)        │                                      │
│  │ + off(eventName, callback)       │                                      │
│  │ + emit(eventName, data)          │                                      │
│  │ + once(eventName, callback)      │                                      │
│  └──────────────────────────────────┘                                      │
│           △                                                                 │
│           │ implements                                                      │
│  ┌────────┴──────────────────────────────────────────────────────────────┐ │
│  │                          EventBus                                      │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │ - listeners: Map<string, Listener[]>                                 │ │
│  │ - eventQueue: Queue<Event>                                           │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │ + register()                                                          │ │
│  │ + unregister()                                                        │ │
│  │ + emit()                                                              │ │
│  │ + publish()                                                           │ │
│  │ + subscribe()                                                         │ │
│  │ + unsubscribe()                                                       │ │
│  │ + getListeners()                                                      │ │
│  │ + clearAll()                                                          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│           │ publishes                                                       │
│           │                                                                 │
│  ┌────────▼───────────────────────────────────────────────────────────────┐ │
│  │                      Domain Events                                     │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │  • DocumentCreatedEvent      • DocumentDeletedEvent                    │ │
│  │  • DocumentVersionCreatedEvent                                        │ │
│  │  • SignatureRequestedEvent   • SignatureCompletedEvent                │ │
│  │  • DocumentSignedEvent       • PaymentProcessedEvent                  │ │
│  │  • UserRegisteredEvent       • UserUpgradedEvent                      │ │
│  │  • GroupCreatedEvent         • MemberAddedEvent                       │ │
│  │  • WebhookReceivedEvent      • AuditLogCreatedEvent                   │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│           │ listened by                                                      │
│  ┌────────▼───────────────────────────────────────────────────────────────┐ │
│  │                      Event Listeners                                   │ │
│  ├─────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                         │ │
│  │  • EmailNotificationListener                                          │ │
│  │  • AuditLogListener                                                   │ │
│  │  • NotificationListener                                               │ │
│  │  • CacheInvalidationListener                                          │ │
│  │  • AnalyticsListener                                                  │ │
│  │  • WebSocketListener                                                  │ │
│  │  • SyncListener                                                       │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary Class Relationships

### **Inheritance Hierarchy:**

```
CustomError
  ├── CommonError
  ├── UserError
  ├── DocumentError
  ├── SignatureError
  ├── PaymentError
  ├── ValidationError
  └── NotFoundError

BaseService
  ├── DocumentService
  ├── SignatureService
  ├── PaymentService
  ├── UserService
  ├── GroupService
  ├── DashboardService
  ├── PDFService
  ├── EmailService
  ├── AuditService
  └── HistoryService

BaseRepository
  ├── DocumentRepository
  ├── UserRepository
  ├── SignatureRepository
  ├── PaymentRepository
  ├── GroupRepository
  ├── HistoryRepository
  └── GroupDocumentSignerRepository

BaseController
  ├── DocumentController
  ├── SignatureController
  ├── PaymentController
  ├── UserController
  ├── GroupController
  ├── DashboardController
  ├── HistoryController
  ├── AuthController
  └── AdminController

BaseMiddleware
  ├── AuthMiddleware
  ├── ErrorHandler
  ├── RateLimiter
  └── CORSHandler
```

### **Composition & Association:**

```
User owns * Document
User owns * Group
Group has * GroupMember
Document has * DocumentVersion
DocumentVersion has * Signature
DocumentVersion has * SignatureField
Group manages * GroupDocumentSigner
User has * Payment
Payment has * PaymentTransaction
Document has * AuditLog
User has * AuthLog
```

### **Key Patterns:**

- **Service Layer Pattern** - Business logic encapsulation
- **Repository Pattern** - Data access abstraction
- **Dependency Injection** - Loose coupling
- **Observer Pattern** - Event-driven architecture
- **Error Handling** - Custom exception hierarchy
- **Middleware Pattern** - Cross-cutting concerns

---

**Generated:** January 2, 2026  
**System:** DigiSign Digital Signature Backend
