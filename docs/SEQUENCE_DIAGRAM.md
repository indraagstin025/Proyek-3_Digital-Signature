# DigiSign Backend - Sequence Diagram

Sequence diagram menunjukkan interaksi antara berbagai komponen sistem dalam urutan waktu.

---

## 1. Sequence Diagram: User Registration & Login

```
User          Frontend      AuthController     AuthService      Database        JWT Generator
│               │                  │               │                │                 │
│ Register      │                  │               │                │                 │
├──────────────>│                  │               │                │                 │
│               │ POST /register   │               │                │                 │
│               │ {email, pass}    │               │                │                 │
│               ├─────────────────>│               │                │                 │
│               │                  │               │                │                 │
│               │                  │ validate()    │                │                 │
│               │                  ├──────────────>│                │                 │
│               │                  │<──────────────┤                │                 │
│               │                  │               │                │                 │
│               │                  │ hashPassword()│                │                 │
│               │                  ├──────────────>│                │                 │
│               │                  │<──────────────┤                │                 │
│               │                  │               │                │                 │
│               │                  │ createUser()  │                │                 │
│               │                  ├───────────────────────────────>│                 │
│               │                  │               │      SAVE      │                 │
│               │                  │<───────────────────────────────┤                 │
│               │                  │               │                │                 │
│               │<─────────────────┤               │                │                 │
│               │ 201 Created      │               │                │                 │
│               │ {id, email}      │               │                │                 │
│<──────────────┤                  │               │                │                 │
│ Registration  │                  │               │                │                 │
│ Success       │                  │               │                │                 │
│               │                  │               │                │                 │
│ Login         │                  │               │                │                 │
├──────────────>│                  │               │                │                 │
│               │ POST /login      │               │                │                 │
│               │ {email, pass}    │               │                │                 │
│               ├─────────────────>│               │                │                 │
│               │                  │               │                │                 │
│               │                  │ findByEmail() │                │                 │
│               │                  ├───────────────────────────────>│                 │
│               │                  │               │    QUERY      │                 │
│               │                  │<───────────────────────────────┤                 │
│               │                  │               │                │                 │
│               │                  │ comparePass() │                │                 │
│               │                  ├──────────────>│                │                 │
│               │                  │<──────────────┤                │                 │
│               │                  │               │                │                 │
│               │                  │ generateToken(userId)          │                 │
│               │                  ├────────────────────────────────────────────────>│
│               │                  │               │                │                 │ SIGN
│               │                  │<────────────────────────────────────────────────┤
│               │                  │               │                │       JWT Token │
│               │                  │               │                │                 │
│               │<─────────────────┤               │                │                 │
│               │ 200 OK           │               │                │                 │
│               │ {token, user}    │               │                │                 │
│<──────────────┤                  │               │                │                 │
│ Store JWT     │                  │               │                │                 │
│ in localStorage                  │               │                │                 │
│               │                  │               │                │                 │
```

---

## 2. Sequence Diagram: Upload Document

```
User      Frontend      DocumentController    DocumentService     FileStorage       Database
│            │                   │                   │                 │               │
│ Click      │                   │                   │                 │               │
│ Upload     │                   │                   │                 │               │
├───────────>│                   │                   │                 │               │
│            │ Drag & Drop       │                   │                 │               │
│            │ or Browse File    │                   │                 │               │
│            │                   │                   │                 │               │
│            │ POST /document    │                   │                 │               │
│            │ {file, title}     │                   │                 │               │
│            ├──────────────────>│                   │                 │               │
│            │                   │                   │                 │               │
│            │                   │ validateFile()    │                 │               │
│            │                   ├──────────────────>│                 │               │
│            │                   │<──────────────────┤                 │               │
│            │                   │                   │                 │               │
│            │                   │                   │ validateSize()  │               │
│            │                   │                   ├────────────────>│               │
│            │                   │                   │<────────────────┤               │
│            │                   │                   │                 │               │
│            │                   │                   │ scanVirus()     │               │
│            │                   │                   ├────────────────>│               │
│            │                   │                   │<────────────────┤               │
│            │                   │                   │                 │               │
│            │                   │                   │ uploadToStorage()              │
│            │                   │                   ├───────────────────────────────>│
│            │                   │                   │                 │   S3 Upload  │
│            │                   │                   │<───────────────────────────────┤
│            │                   │                   │                 │   File URL   │
│            │                   │                   │                 │               │
│            │                   │ createDocument()  │                 │               │
│            │                   ├──────────────────>│                 │               │
│            │                   │                   │                 │               │
│            │                   │                   │ createVersion() │               │
│            │                   │                   ├───────────────────────────────>│
│            │                   │                   │                 │    INSERT    │
│            │                   │                   │<───────────────────────────────┤
│            │                   │<──────────────────┤                 │               │
│            │                   │                   │                 │               │
│            │<──────────────────┤                   │                 │               │
│            │ 201 Created       │                   │                 │               │
│            │ {docId, docUrl}   │                   │                 │               │
│<───────────┤                   │                   │                 │               │
│ Show Upload│                   │                   │                 │               │
│ Success    │                   │                   │                 │               │
│            │                   │                   │                 │               │
```

---

## 3. Sequence Diagram: Create Signature Request (Personal)

```
User      Frontend      DocumentController    SignatureService     Database        EmailService
│            │                  │                    │                 │               │
│ Click      │                  │                    │                 │               │
│ "Send for  │                  │                    │                 │               │
│ Signature" │                  │                    │                 │               │
├───────────>│                  │                    │                 │               │
│            │ POST /signature  │                    │                 │               │
│            │ {docId, signers[]│                    │                 │               │
│            ├─────────────────>│                    │                 │               │
│            │                  │                    │                 │               │
│            │                  │ validateSigners()  │                 │               │
│            │                  ├───────────────────>│                 │               │
│            │                  │<───────────────────┤                 │               │
│            │                  │                    │                 │               │
│            │                  │ For each signer:   │                 │               │
│            │                  ├───────────────────>│                 │               │
│            │                  │                    │ createSignature()               │
│            │                  │                    ├────────────────>│               │
│            │                  │                    │                 │   INSERT      │
│            │                  │                    │<────────────────┤               │
│            │                  │                    │                 │               │
│            │                  │                    │ generateToken() │               │
│            │                  │                    │ (Unique link)   │               │
│            │                  │                    │                 │               │
│            │                  │                    │ sendEmail()     │               │
│            │                  │                    ├───────────────────────────────>│
│            │                  │                    │                 │   SEND EMAIL │
│            │                  │                    │<───────────────────────────────┤
│            │                  │                    │                 │               │
│            │                  │ updateDocument     │                 │               │
│            │                  │ Status="PENDING"   │                 │               │
│            │                  ├────────────────────────────────────>│               │
│            │                  │                    │                 │    UPDATE    │
│            │                  │                    │<────────────────────────────────┤
│            │                  │                    │                 │               │
│            │<─────────────────┤                    │                 │               │
│            │ 200 OK           │                    │                 │               │
│            │ {status, signers}│                    │                 │               │
│<───────────┤                  │                    │                 │               │
│ Confirmation                  │                    │                 │               │
│            │                  │                    │                 │               │
│        [Meanwhile...]         │                    │                 │               │
│            │                  │                    │                 │               │
│            │              Signer ────────────────────────────────────────────────────── Receives
│            │              Email                                                        Email
│            │                  │                    │                 │               │
```

---

## 4. Sequence Diagram: Signer Signs Document

```
Signer    Frontend      SignatureController    SignatureService     PDFService      Database
│           │                   │                    │                 │               │
│ Click     │                   │                    │                 │               │
│ Link in   │                   │                    │                 │               │
│ Email     │                   │                    │                 │               │
├──────────>│                   │                    │                 │               │
│           │ GET /sign/:token  │                    │                 │               │
│           ├──────────────────>│                    │                 │               │
│           │                   │                    │                 │               │
│           │                   │ validateToken()    │                 │               │
│           │                   ├───────────────────>│                 │               │
│           │                   │<───────────────────┤                 │               │
│           │                   │                    │                 │               │
│           │                   │ getDocument()      │                 │               │
│           │                   ├────────────────────────────────────>│               │
│           │                   │                    │                 │    QUERY      │
│           │                   │<────────────────────────────────────┤               │
│           │                   │                    │                 │               │
│           │<──────────────────┤                    │                 │               │
│           │ Document + Fields │                    │                 │               │
│           │ (PDF View)        │                    │                 │               │
│<──────────┤                   │                    │                 │               │
│ Review    │                   │                    │                 │               │
│ Document  │                   │                    │                 │               │
│           │                   │                    │                 │               │
│ Draw      │                   │                    │                 │               │
│ Signature │                   │                    │                 │               │
│           │                   │                    │                 │               │
├──────────>│                   │                    │                 │               │
│ Click     │                   │                    │                 │               │
│ "Confirm" │ POST /sign/:token │                    │                 │               │
│           │ {signatureData}   │                    │                 │               │
│           ├──────────────────>│                    │                 │               │
│           │                   │                    │                 │               │
│           │                   │ validateSignature()│                 │               │
│           │                   ├───────────────────>│                 │               │
│           │                   │<───────────────────┤                 │               │
│           │                   │                    │                 │               │
│           │                   │ getDocumentFile()  │                 │               │
│           │                   ├─────────────────────────────────────────────────────>│
│           │                   │                    │                 │    FETCH     │
│           │                   │<─────────────────────────────────────────────────────┤
│           │                   │                    │                 │   PDF Buffer │
│           │                   │                    │                 │               │
│           │                   │                    │ generateSignedPDF()             │
│           │                   │                    ├──────────────────────────────>│
│           │                   │                    │                 │  ADD STAMP   │
│           │                   │                    │<──────────────────────────────┤
│           │                   │                    │                 │  Signed PDF  │
│           │                   │                    │                 │               │
│           │                   │ savePDF()          │                 │               │
│           │                   ├────────────────────────────────────>│               │
│           │                   │                    │                 │   UPLOAD     │
│           │                   │                    │<────────────────────────────────┤
│           │                   │                    │                 │   PDF URL    │
│           │                   │                    │                 │               │
│           │                   │ updateSignature()  │                 │               │
│           │                   │ status="SIGNED"    │                 │               │
│           │                   ├──────────────────────────────────────────────────────>│
│           │                   │                    │                 │    UPDATE    │
│           │                   │<──────────────────────────────────────────────────────┤
│           │                   │                    │                 │               │
│           │                   │ recordAudit()      │                 │               │
│           │                   ├──────────────────────────────────────────────────────>│
│           │                   │                    │                 │   INSERT     │
│           │                   │                    │                 │    LOG       │
│           │                   │                    │                 │               │
│           │<──────────────────┤                    │                 │               │
│           │ 200 OK            │                    │                 │               │
│           │ {status:SIGNED}   │                    │                 │               │
│<──────────┤                   │                    │                 │               │
│ Success   │                   │                    │                 │               │
│ Message   │                   │                    │                 │               │
│           │                   │                    │                 │               │
```

---

## 5. Sequence Diagram: Payment Subscription Processing

```
User      Frontend      PaymentController    PaymentService      MidtransAPI      Database
│           │                  │                   │                 │               │
│ Click     │                  │                   │                 │               │
│ Subscribe │                  │                   │                 │               │
├──────────>│                  │                   │                 │               │
│           │ POST /payment    │                   │                 │               │
│           │ /subscribe       │                   │                 │               │
│           │ {plan}           │                   │                 │               │
│           ├─────────────────>│                   │                 │               │
│           │                  │                   │                 │               │
│           │                  │ validatePlan()    │                 │               │
│           │                  ├──────────────────>│                 │               │
│           │                  │<──────────────────┤                 │               │
│           │                  │                   │                 │               │
│           │                  │ createOrder()     │                 │               │
│           │                  ├──────────────────────────────────>│
│           │                  │                   │       INSERT    │               │
│           │                  │                   │<──────────────┤
│           │                  │                   │   ORDER_ID    │               │
│           │                  │                   │               │               │
│           │                  │ generateSnapToken()               │               │
│           │                  ├──────────────────>│               │               │
│           │                  │                   │ POST /charge  │               │
│           │                  │                   ├──────────────>│               │
│           │                  │                   │ {amount,orderId               │
│           │                  │                   │<──────────────┤               │
│           │                  │                   │  snap_token   │               │
│           │                  │<──────────────────┤               │               │
│           │                  │ snap_token        │               │               │
│           │<─────────────────┤                   │               │               │
│           │ 200 OK           │                   │               │               │
│           │ {snap_token}     │                   │               │               │
│<──────────┤                   │                   │               │               │
│ Redirect  │                   │                   │               │               │
│ to        │                   │                   │               │               │
│ Payment   │                   │                   │               │               │
│ UI        │                   │                   │               │               │
├──────────>│                   │                   │               │               │
│ (Snap)    │ Load Snap UI      │                   │               │               │
│           │ [User enters      │                   │               │               │
│           │  payment details] │                   │               │               │
│           │                   │                   │               │               │
│           │ Payment Processed │                   │               │               │
│           │ by Midtrans       │                   │               │               │
│           │                   │                   │               │               │
│           │[Webhook received]                     │               │               │
│           │                   │                   │               │               │
│           │               [Meanwhile...]          │               │               │
│           │                                       │ POST /webhook │               │
│           │                                       │ {transaction, │               │
│           │                                       │  status}      │               │
│           │                   │ ◄─ Async ────────┤               │               │
│           │                   │ handleWebhook()   │               │               │
│           │                   ├──────────────────>│               │               │
│           │                   │                   │ verifySignature()             │
│           │                   │                   │               │               │
│           │                   │                   │ updateOrder() │               │
│           │                   │                   ├───────────────────────────────>│
│           │                   │                   │               │    UPDATE     │
│           │                   │                   │<───────────────────────────────┤
│           │                   │                   │               │               │
│           │                   │ updateUserTier()  │               │               │
│           │                   ├───────────────────────────────────────────────────>│
│           │                   │                   │               │    UPDATE     │
│           │                   │                   │<───────────────────────────────┤
│           │                   │                   │               │               │
│           │ 200 OK            │                   │               │               │
│           │ (Webhook Response)│                   │               │               │
│           │                   │<──────────────────┤               │               │
│           │                   │ (Return 200 OK)   │               │               │
│           │                   ├──────────────────>│               │               │
│           │                   │                   │               │               │
│           │ [Polling/WebSocket│                   │               │               │
│           │  for result]      │                   │               │               │
│           │ GET /payment/     │                   │               │               │
│           │ status/:orderId   │                   │               │               │
│           ├─────────────────>│                    │               │               │
│           │                   │ getOrderStatus()  │               │               │
│           │                   ├──────────────────>│               │               │
│           │                   │<──────────────────┤               │               │
│           │<─────────────────┤                   │               │               │
│           │ 200 OK           │                   │               │               │
│           │ {status:PAID}    │                   │               │               │
│<──────────┤                   │                   │               │               │
│ Show      │                   │                   │               │               │
│ Success   │                   │                   │               │               │
│           │                   │                   │               │               │
```

---

## 6. Sequence Diagram: Group Document Assignment

```
User      Frontend      GroupController      GroupService         Database         EmailService
│           │                  │                   │                 │                  │
│ Select    │                  │                   │                 │                  │
│ Document  │                  │                   │                 │                  │
│ & Group   │                  │                   │                 │                  │
├──────────>│                  │                   │                 │                  │
│           │ POST /group/     │                   │                 │                  │
│           │ assign-document  │                   │                 │                  │
│           │ {docId, groupId}│                    │                 │                  │
│           ├─────────────────>│                   │                 │                  │
│           │                  │                   │                 │                  │
│           │                  │ validateAccess()  │                 │                  │
│           │                  ├──────────────────>│                 │                  │
│           │                  │<──────────────────┤                 │                  │
│           │                  │                   │                 │                  │
│           │                  │ getGroupMembers() │                 │                  │
│           │                  ├──────────────────────────────────>│
│           │                  │                   │    QUERY        │                  │
│           │                  │<──────────────────────────────────┤
│           │                  │                   │   members[]     │                  │
│           │                  │                   │                 │                  │
│           │                  │ For each member:  │                 │                  │
│           │                  ├──────────────────>│                 │                  │
│           │                  │                   │                 │                  │
│           │                  │ createGroupDoc    │                 │                  │
│           │                  │ Signer()          │                 │                  │
│           │                  │                   ├───────────────────────────────────>│
│           │                  │                   │      INSERT     │                  │
│           │                  │                   │<───────────────────────────────────┤
│           │                  │                   │                 │                  │
│           │                  │                   │ sendNotification()                 │
│           │                  │                   ├──────────────────────────────────>│
│           │                  │                   │                 │    SEND EMAIL    │
│           │                  │                   │<──────────────────────────────────┤
│           │                  │                   │                 │                  │
│           │                  │ updateDocument    │                 │                  │
│           │                  │ Status=           │                 │                  │
│           │                  │ "IN_PROCESS"      │                 │                  │
│           │                  ├──────────────────────────────────>│
│           │                  │                   │    UPDATE       │                  │
│           │                  │<──────────────────────────────────┤
│           │                  │                   │                 │                  │
│           │<─────────────────┤                   │                 │                  │
│           │ 200 OK           │                   │                 │                  │
│           │ {status:SENT}    │                   │                 │                  │
│<──────────┤                   │                   │                 │                  │
│ Confirm   │                   │                   │                 │                  │
│ Message   │                   │                   │                 │                  │
│           │                   │                   │                 │                  │
│      [Members Receive Emails and Sign Documents]  │                 │                  │
│           │                   │                   │                 │                  │
```

---

## 7. Sequence Diagram: Dashboard Data Load

```
User      Frontend      DashboardController   DashboardService    Database        CacheService
│           │                   │                    │                 │               │
│ Navigate  │                   │                    │                 │               │
│ to        │                   │                    │                 │               │
│ Dashboard │                   │                    │                 │               │
├──────────>│                   │                    │                 │               │
│           │ GET /dashboard    │                    │                 │               │
│           ├──────────────────>│                    │                 │               │
│           │                   │                    │                 │               │
│           │                   │ validateToken()    │                 │               │
│           │                   ├───────────────────>│                 │               │
│           │                   │<───────────────────┤                 │               │
│           │                   │                    │                 │               │
│           │                   │ getDashboard()     │                 │               │
│           │                   ├───────────────────>│                 │               │
│           │                   │                    │ checkCache()    │               │
│           │                   │                    ├──────────────────────────────>│
│           │                   │                    │                 │   Check       │
│           │                   │                    │<──────────────────────────────┤
│           │                   │                    │   Cache Hit/Miss              │
│           │                   │                    │                 │               │
│           │                   │                    │ [If Cache Hit]  │               │
│           │                   │                    ├──────────────────────────────>│
│           │                   │                    │                 │   RETRIEVE    │
│           │                   │                    │<──────────────────────────────┤
│           │                   │                    │      data       │               │
│           │                   │                    │                 │               │
│           │                   │ [If Cache Miss]    │                 │               │
│           │                   │                    │ executeQueries()│               │
│           │                   │                    │ (Parallel)      │               │
│           │                   │                    │                 │               │
│           │                   │                    ├─ Promise.all([  │               │
│           │                   │                    │   counts(),     │               │
│           │                   │                    │   actions(),    │               │
│           │                   │                    │   activities()  │               │
│           │                   │                    │ ])              │               │
│           │                   │                    │                 │               │
│           │    ┌──────────────────────────────────┬─────────────────┐               │
│           │    │                                  │                 │               │
│           │    ▼                                  ▼                 ▼               │
│           │ countDocuments()              getActionItems()  getRecentActivities()  │
│           │ (draft, pending,              (signatures,      (docs, sigs,          │
│           │  completed)                   drafts, groups)    edits)                │
│           │    │                                  │                 │               │
│           │    ├──────────────────────────────────┴─────────────────┤               │
│           │    │                                                    │               │
│           │    ▼                                                    ▼               │
│           │ (All queries complete)                                  │               │
│           │                    │                                    │               │
│           │                    ▼                                    │               │
│           │                formatResponse() ◄────────────────────────┘               │
│           │                {counts, actions,                                       │
│           │                 activities}                                            │
│           │                    │                                    │               │
│           │                    │ setCache()                         │               │
│           │                    ├────────────────────────────────────────────────────>│
│           │                    │                                    │    SET        │
│           │                    │<────────────────────────────────────────────────────┤
│           │                    │                                    │   (TTL: 5min) │
│           │                    │                                    │               │
│           │<──────────────────>│                                    │               │
│           │ 200 OK             │                                    │               │
│           │ {counts, actions,  │                                    │               │
│           │  activities}       │                                    │               │
│<──────────┤                    │                                    │               │
│ Render    │                    │                                    │               │
│ Dashboard │                    │                                    │               │
│ UI        │                    │                                    │               │
│           │                    │                                    │               │
```

---

## 8. Sequence Diagram: Document Version Rollback

```
User      Frontend      DocumentController    DocumentService      PDFService      Database
│           │                   │                    │                 │               │
│ View      │                   │                    │                 │               │
│ Versions  │                   │                    │                 │               │
├──────────>│                   │                    │                 │               │
│           │ GET /document/    │                    │                 │               │
│           │ :docId/versions   │                    │                 │               │
│           ├──────────────────>│                    │                 │               │
│           │                   │                    │                 │               │
│           │                   │ getVersions()      │                 │               │
│           │                   ├───────────────────>│                 │               │
│           │                   │                    │                 │               │
│           │                   │<───────────────────┤                 │               │
│           │                   │    versions[]      │                 │               │
│           │<──────────────────┤                    │                 │               │
│           │ Display Versions  │                    │                 │               │
│<──────────┤                   │                    │                 │               │
│ Select    │                   │                    │                 │               │
│ Old       │                   │                    │                 │               │
│ Version   │                   │                    │                 │               │
├──────────>│                   │                    │                 │               │
│           │ POST /document/   │                    │                 │               │
│           │ rollback          │                    │                 │               │
│           │ {versionId}       │                    │                 │               │
│           ├──────────────────>│                    │                 │               │
│           │                   │                    │                 │               │
│           │                   │ validateAccess()   │                 │               │
│           │                   ├───────────────────>│                 │               │
│           │                   │<───────────────────┤                 │               │
│           │                   │                    │                 │               │
│           │                   │ beginTransaction() │                 │               │
│           │                   ├─────────────────────────────────────────────────────>│
│           │                   │                    │                 │   BEGIN TX    │
│           │                   │<─────────────────────────────────────────────────────┤
│           │                   │                    │                 │               │
│           │                   │ deleteOldSignatures│                 │               │
│           │                   ├───────────────────────────────────────────────────────>│
│           │                   │                    │                 │    DELETE     │
│           │                   │<───────────────────────────────────────────────────────┤
│           │                   │                    │                 │               │
│           │                   │ getVersionFile()   │                 │               │
│           │                   ├─────────────────────────────────────────────────────────────────>│
│           │                   │                    │                 │               │           │
│           │                   │                    │                 │               │   (S3)    │
│           │                   │<─────────────────────────────────────────────────────────────────┤
│           │                   │                    │    PDF Buffer   │               │           │
│           │                   │                    │                 │               │           │
│           │                   │ createNewVersion() │                 │               │           │
│           │                   ├───────────────────────────────────────────────────────────────────>│
│           │                   │                    │                 │               │           │
│           │                   │                    │ uploadFile()    │               │           │
│           │                   │                    ├──────────────────────────────────────────────>│
│           │                   │                    │                 │               │   UPLOAD  │
│           │                   │                    │<──────────────────────────────────────────────┤
│           │                   │                    │                 │               │           │
│           │                   │ updateDocVersion() │                 │               │           │
│           │                   ├──────────────────────────────────────────────────────────────────>│
│           │                   │                    │                 │    UPDATE     │           │
│           │                   │                    │                 │    (current   │           │
│           │                   │                    │                 │     version) │           │
│           │                   │                    │                 │               │           │
│           │                   │ updateDocStatus()  │                 │               │           │
│           │                   ├──────────────────────────────────────────────────────────────────>│
│           │                   │                    │                 │    UPDATE     │           │
│           │                   │                    │                 │    (status:   │           │
│           │                   │                    │                 │     DRAFT)    │           │
│           │                   │                    │                 │               │           │
│           │                   │ commitTransaction()│                 │               │           │
│           │                   ├─────────────────────────────────────────────────────────────────>│
│           │                   │                    │                 │    COMMIT     │           │
│           │                   │<─────────────────────────────────────────────────────────────────┤
│           │                   │                    │                 │               │           │
│           │                   │ recordAudit()      │                 │               │           │
│           │                   ├──────────────────────────────────────────────────────────────────>│
│           │                   │                    │                 │     INSERT    │           │
│           │                   │                    │                 │      LOG      │           │
│           │                   │                    │                 │               │           │
│           │<──────────────────┤                    │                 │               │           │
│           │ 200 OK            │                    │                 │               │           │
│           │ {status:SUCCESS}  │                    │                 │               │           │
│<──────────┤                   │                    │                 │               │           │
│ Show      │                   │                    │                 │               │           │
│ Success   │                   │                    │                 │               │           │
│           │                   │                    │                 │               │           │
```

---

## 9. Sequence Diagram: Webhook Payment Verification

```
MidtransAPI    Backend         Crypto          Database            NotificationService
│              │                │                 │                        │
│ Payment      │                │                 │                        │
│ Completed    │                │                 │                        │
├─────────────>│ POST /webhook  │                 │                        │
│ (Webhook)    │ {transaction,  │                 │                        │
│              │  status}       │                 │                        │
│              │                │                 │                        │
│              │ parsePayload() │                 │                        │
│              │                │                 │                        │
│              │ verifySignature()                │                        │
│              ├───────────────>│                 │                        │
│              │                │ HMAC-SHA256     │                        │
│              │                │ {payload,key}   │                        │
│              │<───────────────┤                 │                        │
│              │    isValid     │                 │                        │
│              │                │                 │                        │
│         ┌────┴───┐                              │                        │
│    VALID│         │ INVALID                     │                        │
│         ▼         ▼                              │                        │
│    ┌──────┐  ┌──────────┐                       │                        │
│    │Process│  │Log Error │                       │                        │
│    │Webhook│  │Return 200│                       │                        │
│    └──┬───┘  └──────────┘                       │                        │
│       │                                         │                        │
│       ▼                                         │                        │
│   getOrderById(orderId)                         │                        │
│       │                                         │                        │
│       └────────────────────────────────────────>│                        │
│                                                 │    QUERY               │
│                                                 │                        │
│   updateOrder()                                 │                        │
│       │                                         │                        │
│       ├────────────────────────────────────────>│                        │
│       │                                         │    UPDATE              │
│       │                                         │    (status: PAID)      │
│       │                                         │                        │
│       │ [If payment successful]                 │                        │
│       │                                         │                        │
│       ├──────────────────────────────────────────────────────────────┐   │
│       │                                         │                    │   │
│       │ updateUserTier()                        │                    ▼   │
│       │       │                                 │              sendEmail()
│       │       └────────────────────────────────>│                    │
│       │                                         │    UPDATE           │
│       │                                         │    (tier: PREMIUM)  │
│       │                                         │                    │
│       │ sendNotification()                      │                    │
│       │       │                                 │                    │
│       │       └──────────────────────────────────────────────────────>│
│       │                                         │                    │
│       │ recordAudit()                           │                    │
│       │       │                                 │                    │
│       │       └────────────────────────────────>│                    │
│       │                                         │    INSERT LOG      │
│       │                                         │                    │
│  ┌────┴──────────────────────────────────┐      │                    │
│  │                                       │      │                    │
│  ▼                                       ▼      │                    │
│ Return 200 OK                   [Async Operations Complete]          │
│ (Webhook acknowledged)                  │      │                    │
│              ◄─────────────────────────────────┘                    │
│                                                                      │
```

---

## 10. Sequence Diagram: Notification System

```
Trigger Event    NotificationService    TemplateEngine    EmailProvider    Database
│                     │                       │                │              │
│ User Signs          │                       │                │              │
│ Document            │                       │                │              │
├────────────────────>│                       │                │              │
│                     │                       │                │              │
│                     │ getTemplate('SIGNED') │                │              │
│                     ├──────────────────────>│                │              │
│                     │   template_html       │                │              │
│                     │<──────────────────────┤                │              │
│                     │                       │                │              │
│                     │ populateTemplate()    │                │              │
│                     │ {signer, document,    │                │              │
│                     │  link, date}          │                │              │
│                     │                       │                │              │
│                     │ formatEmailContent()  │                │              │
│                     │ {html, subject,       │                │              │
│                     │  to, from}            │                │              │
│                     │                       │                │              │
│                     │ sendEmail()           │                │              │
│                     ├───────────────────────────────────────>│              │
│                     │                       │     SEND       │              │
│                     │                       │<───────────────┤              │
│                     │                       │   messageId    │              │
│                     │                       │                │              │
│                     │ recordNotification()  │                │              │
│                     ├────────────────────────────────────────────────────────>│
│                     │                       │                │    INSERT    │
│                     │<────────────────────────────────────────────────────────┤
│                     │                       │                │              │
│<────────────────────┤                       │                │              │
│ Notification Sent   │                       │                │              │
│ (Success)          │                       │                │              │
│                     │                       │                │              │
```

---

## Summary Sequence Diagram

Diagram sekuen di atas menunjukkan:

1. **Authentication**: User registration dan login dengan JWT token
2. **Document Upload**: Upload file dengan validasi dan storage
3. **Signature Request**: Create signature request ke satu/multiple signers
4. **Signer Flow**: Signer review dan sign document dengan digital signature
5. **Payment Processing**: Subscription dengan Midtrans integration
6. **Group Assignment**: Assign document ke group untuk batch signing
7. **Dashboard Load**: Load dashboard dengan parallel queries dan caching
8. **Version Rollback**: Rollback dokumen ke versi sebelumnya dengan transaction
9. **Webhook Verification**: Verify dan process payment webhook dari Midtrans
10. **Notification**: Send email notifications untuk berbagai events

**Elemen Kunci:**

- 🔐 Validasi token dan authorization
- 💾 Database operations (QUERY, INSERT, UPDATE, DELETE)
- 📧 Email notifications
- 🔗 External API calls (Midtrans)
- 🔄 Parallel operations
- ⚠️ Error handling
- 📝 Audit logging
- 💰 Transaction management

---

**Generated:** January 2, 2026  
**System:** DigiSign Digital Signature Backend
