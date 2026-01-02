# DigiSign Backend - Activity Diagram

Diagram aktivitas menunjukkan alur proses dan keputusan yang terjadi dalam sistem DigiSign.

---

## 1. Activity Diagram: User Upload & Create Signature Request

```
                                    START
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  User Login to      │
                            │  System             │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Navigate to        │
                            │  Upload Page        │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Select Document    │
                            │  File (PDF/DOC)     │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Upload to Server   │
                            │  (File Storage)     │
                            └─────────┬───────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │  ◇ File Valid & Size OK?        │
                    │  ◇ Virus Scan Passed?           │
                    └─┬─────────────────────────────┬─┘
                      │                             │
                  YES │                             │ NO
                      ▼                             ▼
            ┌─────────────────────┐     ┌─────────────────────┐
            │ Create Document     │     │ Show Error Message  │
            │ Record in Database  │     │ (Invalid/Too Large) │
            └─────────┬───────────┘     └────────────┬────────┘
                      │                              │
                      ▼                              ▼
            ┌─────────────────────┐     ┌─────────────────────┐
            │ Generate Document   │     │ Delete Temporary    │
            │ Version 1           │     │ File                │
            └─────────┬───────────┘     └────────────┬────────┘
                      │                              │
                      ▼                              ▼
            ┌─────────────────────┐     ┌─────────────────────┐
            │ Show Success        │     │ Return to Upload    │
            │ Message             │     │ Page                │
            └─────────┬───────────┘     └────────────┬────────┘
                      │                              │
                      └──────────┬───────────────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │ Create Signature    │
                      │ Request Form        │
                      └──────────┬──────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │ Enter Signer Email  │
                      │ (or Select Group)   │
                      └──────────┬──────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │ Set Signature Fields│
                      │ (Position & Size)   │
                      └──────────┬──────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │ Add Message         │
                      │ (Optional)          │
                      └──────────┬──────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │ ◇ Multiple Signers? │
                      └──────────┬──────────┘
                                 │
                    ┌────────────┴────────────┐
                YES │                        │ NO
                    ▼                        ▼
        ┌──────────────────────┐  ┌──────────────────────┐
        │ Add More Signers     │  │ Review Request       │
        │ (Click Add Button)   │  │ Details              │
        └──────────┬───────────┘  └──────────┬───────────┘
                   │                         │
                   └────────────┬────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │ Save Signature Request  │
                    │ to Database             │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Send Notification Email │
                    │ to Each Signer          │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Update Document Status  │
                    │ to "PENDING"            │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Display Confirmation    │
                    │ Message to User         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                                END
```

---

## 2. Activity Diagram: Signer Review & Sign Document

```
                                    START
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Signer Receives    │
                            │  Email Notification │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Click Link to      │
                            │  Sign in Email      │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Redirected to      │
                            │  Document Detail    │
                            │  Page               │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Review Document    │
                            │  • Title            │
                            │  • Content Preview  │
                            │  • Signature Fields │
                            └─────────┬───────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │  ◇ Ready to Sign?               │
                    └─┬───────────────────────────┬───┘
                      │                           │
                  YES │                           │ NO
                      ▼                           ▼
            ┌─────────────────────┐     ┌──────────────────┐
            │ Click "Sign Now"    │     │ Decline Document │
            │ Button              │     │ Signing          │
            └─────────┬───────────┘     └────────┬─────────┘
                      │                          │
                      ▼                          ▼
            ┌─────────────────────┐     ┌──────────────────┐
            │ Load Digital        │     │ Send Notification│
            │ Signature Tool      │     │ to Document Owner│
            └─────────┬───────────┘     │ (Declined)       │
                      │                 └────────┬─────────┘
                      ▼                          │
            ┌─────────────────────┐              │
            │ Display PDF with    │              │
            │ Signature Fields    │              │
            │ Highlighted         │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ Signer Selects      │              │
            │ Signature Field to  │              │
            │ Place Signature     │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ Draw or Upload      │              │
            │ Digital Signature   │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ ◇ Repeat for all    │              │
            │  signature fields?  │              │
            └─┬───────────────────┘              │
              │                                  │
          YES │                                  │
              ▼                                  │
            ┌─────────────────────┐              │
            │ Go to next field    │              │
            │ (Back to field      │              │
            │  selection)         │              │
            └─────────┬───────────┘              │
                      │                          │
                  NO  │                          │
              ────────┘                          │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ Review All Placed   │              │
            │ Signatures          │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ Click "Confirm &    │              │
            │ Sign" Button        │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ System Validates    │              │
            │ Signature Data      │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ Apply Digital       │              │
            │ Certificate to      │              │
            │ Signature           │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ Create New PDF with │              │
            │ Embedded Signature  │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ Save Signed Version │              │
            │ to File Storage     │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ Update Signature    │              │
            │ Record in Database  │              │
            │ (Status: SIGNED)    │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ Record Audit Log    │              │
            │ (Signer, Time,      │              │
            │  IP, etc.)          │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ Send Confirmation   │              │
            │ Email to Signer     │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ Send Notification   │              │
            │ to Document Owner   │              │
            │ (Signed Status)     │              │
            └─────────┬───────────┘              │
                      │                          │
                      ▼                          │
            ┌─────────────────────┐              │
            │ ◇ All Signers       │              │
            │  have Signed?       │              │
            └─┬───────────────────┘              │
              │                                  │
          NO  │                                  │
              │                                  │
          YES │                                  │
              ▼                                  │
            ┌─────────────────────┐              │
            │ Update Document     │              │
            │ Status to "SIGNED"  │              │
            └─────────┬───────────┘              │
                      │                          │
                      └──────────┬───────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Display Success Message │
                    │ & Download Link         │
                    └────────────┬────────────┘
                                 │
                                 ▼
                                END
```

---

## 3. Activity Diagram: Payment Subscription Flow

```
                                    START
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  User Clicks        │
                            │  "Subscribe Premium"│
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Display Plan       │
                            │  Options:           │
                            │  • Monthly          │
                            │  • Yearly           │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  User Selects Plan  │
                            │  & Clicks "Pay"     │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Backend Creates    │
                            │  Order in Database  │
                            │  (Status: PENDING)  │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Call Midtrans API  │
                            │  Create Snap Token  │
                            └─────────┬───────────┘
                                      │
                    ┌─────────────────┴────────────────┐
                    │                                  │
                    ▼                                  ▼
        ┌─────────────────────────┐      ┌──────────────────────┐
        │ Snap Token Created ✓    │      │ Snap Token Error ✗   │
        └────────────┬────────────┘      └──────────────┬───────┘
                     │                                  │
                     ▼                                  ▼
        ┌─────────────────────────┐      ┌──────────────────────┐
        │ Display Payment Page    │      │ Log Error & Notify   │
        │ (Midtrans Snap UI)      │      │ User                 │
        └────────────┬────────────┘      └──────────────┬───────┘
                     │                                  │
                     ▼                                  ▼
        ┌─────────────────────────┐      ┌──────────────────────┐
        │ User Enters Payment     │      │ Return to Payment    │
        │ Details (Card/eWallet)  │      │ Page                 │
        └────────────┬────────────┘      └──────────────┬───────┘
                     │                                  │
                     ▼                                  │
        ┌─────────────────────────┐                     │
        │ Midtrans Processes      │                     │
        │ Payment                 │                     │
        └────────────┬────────────┘                     │
                     │                                  │
          ┌──────────┴──────────┐                       │
          │                     │                       │
      ✓ PAID              ✗ FAILED/CANCELLED           │
          │                     │                       │
          ▼                     ▼                       │
    ┌─────────────┐      ┌──────────────┐              │
    │Midtrans Send│      │Midtrans Send │              │
    │ Webhook     │      │ Webhook      │              │
    │(settlement) │      │(failed/deny) │              │
    └────────┬────┘      └──────┬───────┘              │
             │                  │                      │
             ▼                  ▼                      │
    ┌──────────────────────────────┐                  │
    │ Backend Receive Webhook from │                  │
    │ Midtrans                     │                  │
    └────────────┬─────────────────┘                  │
                 │                                    │
                 ▼                                    │
    ┌──────────────────────────────┐                  │
    │ Verify Webhook Signature     │                  │
    └────────────┬─────────────────┘                  │
                 │                                    │
          ┌──────┴──────┐                             │
      VALID│        │INVALID                          │
          ▼        ▼                                   │
    ┌──────────┐┌──────────┐                          │
    │ Process  ││ Log Error│                          │
    │ Payment  ││ Return   │                          │
    │ Status   ││ 200 OK   │                          │
    └────┬─────┘└──────────┘                          │
         │                                            │
         ▼                                            │
    ┌──────────────────────────┐                      │
    │ Update Order Status in   │                      │
    │ Database                 │                      │
    │ (PAID/FAILED/CANCELLED)  │                      │
    └────────────┬─────────────┘                      │
                 │                                    │
    ┌────────────┴────────────┐                       │
    │                         │                       │
PAID│                    NOT PAID                     │
    ▼                         ▼                       │
┌────────────┐         ┌──────────────┐              │
│ Upgrade    │         │ Keep Free    │              │
│ User Tier  │         │ Tier         │              │
│ to Premium │         │              │              │
│ until      │         └──────┬───────┘              │
│ [Date]     │                │                      │
└────┬───────┘                │                      │
     │                        │                      │
     ▼                        ▼                      │
┌──────────────┐        ┌──────────────┐             │
│ Send Success │        │ Send Failed  │             │
│ Email to User│        │ Email to User│             │
└────┬─────────┘        └──────┬───────┘             │
     │                         │                     │
     └────────────┬────────────┘                     │
                  │                                  │
                  ▼                                  │
         ┌─────────────────┐                         │
         │ Record in Audit │                         │
         │ Log             │                         │
         └────────┬────────┘                         │
                  │                                  │
                  └──────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Display Result Page     │
                    │ to User                 │
                    └────────────┬────────────┘
                                 │
                                 ▼
                                END
```

---

## 4. Activity Diagram: Group Document Assignment & Signing

```
                                    START
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  User Creates/      │
                            │  Uploads Document   │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  User Navigates to  │
                            │  "Assign to Group"  │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Display List of    │
                            │  User's Groups      │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  User Selects Group │
                            │  (or Multiple)      │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Set Signing Order  │
                            │  (Sequential/       │
                            │   Parallel)         │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Add Custom Message │
                            │  (Optional)         │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Click "Confirm &   │
                            │  Send to Group"     │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Create Group       │
                            │  Document Record    │
                            │  in Database        │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  For Each Group     │
                            │  Member:            │
                            └─────────┬───────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
            ▼                         ▼                         ▼
    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
    │ Create Group │         │ Create Draft │         │ Determine    │
    │Document      │         │ Signature    │         │ Notification │
    │Signer Record │         │ Record       │         │ Order        │
    └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
           │                        │                        │
           ▼                        ▼                        ▼
    ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
    │ Set Status   │         │ Set Status   │         │ Get Member   │
    │ to PENDING   │         │ to PENDING   │         │ Email        │
    └──────┬───────┘         └──────┬───────┘         └──────┬───────┘
           │                        │                        │
           └────────────┬───────────┴────────────┬───────────┘
                        │                        │
                        ▼                        ▼
                    ┌──────────────────────────────┐
                    │ Check if Member Active &     │
                    │ Has Email                    │
                    └──────┬───────────────────────┘
                           │
                    ┌──────┴──────┐
                YES │             │ NO
                    ▼             ▼
            ┌──────────────┐ ┌────────────┐
            │ Send Email   │ │ Log Warning│
            │ Notification │ │ Member    │
            │ to Member    │ │ Inactive  │
            └──────┬───────┘ └────────────┘
                   │
                   ▼
            ┌──────────────┐
            │ All Members  │
            │ Processed?   │
            └──────┬───────┘
                   │
            ┌──────┴──────┐
        YES │             │ NO
            ▼             ▼
    ┌──────────────┐     (Loop back)
    │ Update Group │
    │ Document     │
    │ Status to    │
    │ "SENT"       │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Update       │
    │ Document     │
    │ Status to    │
    │ "IN_PROCESS" │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Send         │
    │ Confirmation │
    │ to Document  │
    │ Owner        │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Log Audit    │
    │ Trail        │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ Display      │
    │ Success      │
    │ Message      │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Signer Receives Email &  │
    │ Signs Document (See Flow │
    │ #2: Signer Review & Sign)│
    └──────┬───────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ ◇ All Signers Done?      │
    └──┬──────────────────────┬─┘
    NO │                      │ YES
       ▼                      ▼
    (Wait)            ┌──────────────┐
                      │ Update Group │
                      │ Document     │
                      │ Status to    │
                      │ "COMPLETED"  │
                      └──────┬───────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ Notify Owner │
                      │ All Signed   │
                      └──────┬───────┘
                             │
                             ▼
                           END
```

---

## 5. Activity Diagram: Dashboard Data Aggregation

```
                                    START
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  User Requests      │
                            │  Dashboard Page     │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Validate JWT Token │
                            │  & User Session     │
                            └─────────┬───────────┘
                                      │
                            ┌─────────┴──────────┐
                        VALID│                   │INVALID
                            ▼                    ▼
                ┌──────────────────┐    ┌─────────────────┐
                │ Extract User ID  │    │ Return 401      │
                │ from Token       │    │ Unauthorized    │
                └────────┬─────────┘    └─────────────────┘
                         │
                         ▼
                ┌──────────────────────────────┐
                │ Execute Parallel Queries:    │
                │ 1. Count Documents by Status │
                │ 2. Get Action Items          │
                │ 3. Get Recent Activities     │
                └────────────┬─────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Count Query: │    │Action Items: │    │ Activities:  │
│ Draft,       │    │• Personal    │    │• Recent Docs │
│ Pending,     │    │  Signatures  │    │• Signatures  │
│ Completed    │    │• Group Sig   │    │• Edits       │
└──────┬───────┘    │• Drafts      │    └──────┬───────┘
       │            └──────┬───────┘           │
       ▼                   ▼                   ▼
┌──────────────────────────────────────────────────┐
│ Check Query Results for Errors                   │
│ (Use Promise.allSettled for resilience)         │
└──────────┬──────────────────────────────────────┘
           │
        ┌──┴──┬──────┬─────────┐
    OK  │  │OK│Fail  │  Error  │
        ▼  ▼  ▼      ▼         ▼
    ┌──────┐┌────┐┌─────┐┌──────┐
    │Use   ││Use ││ Use ││ Use  │
    │Data  ││Data││Default││Default│
    └──┬───┘└─┬──┘└──┬──┘└───┬──┘
       │      │      │       │
       └──────┼──────┼───────┘
              │      │
              ▼      ▼
        ┌─────────────────────┐
        │ Format Response Data │
        │ {                   │
        │   counts: {...},    │
        │   actions: [...],   │
        │   activities: [...]  │
        │ }                   │
        └────────┬────────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Apply Authorization │
        │ Filters (Optional)   │
        └────────┬────────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Cache Result        │
        │ (Optional - Redis)   │
        └────────┬────────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Log API Request     │
        │ to Audit Trail      │
        └────────┬────────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Return JSON         │
        │ Response (200 OK)   │
        │ to Frontend         │
        └────────┬────────────┘
                 │
                 ▼
        ┌─────────────────────┐
        │ Frontend Renders    │
        │ Dashboard UI        │
        │ with Data           │
        └────────┬────────────┘
                 │
                 ▼
               END
```

---

## 6. Activity Diagram: Document Version Rollback

```
                                    START
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  User Views        │
                            │  Document Versions │
                            │  History           │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  User Selects      │
                            │  Previous Version  │
                            │  to Restore        │
                            └─────────┬───────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  Confirm Rollback  │
                            │  (Warning Dialog)  │
                            └─────────┬───────────┘
                                      │
                            ┌─────────┴──────────┐
                        OK  │                    │ CANCEL
                            ▼                    ▼
                ┌──────────────────┐    ┌──────────────┐
                │ Proceed with     │    │ Stay on      │
                │ Rollback         │    │ Current      │
                │                  │    │ Version      │
                └────────┬─────────┘    └──────────────┘
                         │
                         ▼
                ┌──────────────────────┐
                │ Lock Document for    │
                │ Editing              │
                └────────┬─────────────┘
                         │
                         ▼
                ┌──────────────────────┐
                │ Get Previous Version │
                │ File from Storage    │
                └────────┬─────────────┘
                         │
                         ▼
                ┌──────────────────────┐
                │ Fetch All Signatures │
                │ from Current Version │
                └────────┬─────────────┘
                         │
                         ▼
                ┌──────────────────────┐
                │ Start Transaction    │
                │ (Database)           │
                └────────┬─────────────┘
                         │
                         ▼
                ┌──────────────────────┐
                │ Delete Signature     │
                │ Records              │
                │ (Clean Old Sigs)     │
                └────────┬─────────────┘
                         │
                         ▼
                ┌──────────────────────┐
                │ Copy Previous File   │
                │ to New Version       │
                │ (Create Version N+1) │
                └────────┬─────────────┘
                         │
                         ▼
                ┌──────────────────────┐
                │ Update Document      │
                │ Current Version ID   │
                │ to New Version       │
                └────────┬─────────────┘
                         │
                         ▼
                ┌──────────────────────┐
                │ Update Document      │
                │ Status to DRAFT      │
                └────────┬─────────────┘
                         │
                         ▼
                ┌──────────────────────┐
                │ Commit Transaction   │
                │ (Database)           │
                └────────┬─────────────┘
                         │
                    ┌────┴─────┐
                SUCC │          │ FAIL
                    ▼          ▼
            ┌──────────────┐┌────────────┐
            │ Rollback Old ││ Rollback   │
            │ Signatures   ││ Entire     │
            │ Sent Email   ││Transaction │
            │ to Signers   ││ Show Error │
            └────┬─────────┘└────┬───────┘
                 │                │
                 ▼                ▼
            ┌──────────────┐┌────────────┐
            │ Record Audit ││ Unlock Doc │
            │ Log          ││ Return to  │
            │ (Rollback)   ││ Detail Page│
            └────┬─────────┘└────────────┘
                 │
                 ▼
            ┌──────────────┐
            │ Unlock Doc   │
            │ for Editing  │
            └────┬─────────┘
                 │
                 ▼
            ┌──────────────┐
            │ Show Success │
            │ Message      │
            └────┬─────────┘
                 │
                 ▼
            ┌──────────────┐
            │ Display New  │
            │ Version in   │
            │ History List │
            └────┬─────────┘
                 │
                 ▼
               END
```

---

## 7. Activity Diagram: Audit Logging

```
                                    START
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │  User/System Action │
                            │  Occurs             │
                            └─────────┬───────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
        ┌──────────────────────┐         ┌──────────────────────┐
        │ Action Type:         │         │ Collect Metadata:    │
        │ • Login              │         │ • User ID            │
        │ • Upload Document    │         │ • IP Address         │
        │ • Create Signature   │         │ • Timestamp          │
        │ • Sign Document      │         │ • Action Type        │
        │ • Payment            │         │ • Resource ID        │
        │ • etc.               │         │ • Status (SUCCESS/   │
        └──────┬───────────────┘         │   FAILED)            │
               │                         │ • Additional Data    │
               │                         └──────┬───────────────┘
               │                                │
               └────────────┬───────────────────┘
                            │
                            ▼
                ┌──────────────────────────┐
                │ Determine Log Level:     │
                │ • INFO (Normal actions)  │
                │ • WARNING (Failed action)│
                │ • ERROR (System errors)  │
                │ • CRITICAL (Security)    │
                └────────┬─────────────────┘
                         │
                         ▼
                ┌──────────────────────────┐
                │ Create Audit Log Record: │
                │ {                        │
                │   id, userId, action,    │
                │   resource, timestamp,   │
                │   ip, status, details    │
                │ }                        │
                └────────┬─────────────────┘
                         │
                         ▼
                ┌──────────────────────────┐
                │ Save to Database         │
                │ (Audit Log Table)        │
                └────────┬─────────────────┘
                         │
                    ┌────┴────┐
                SUCC │         │ FAIL
                    ▼         ▼
            ┌──────────────┐┌──────────────┐
            │ Update Log   ││ Retry Logic? │
            │ Status:      ││ (Optional)   │
            │ RECORDED     ││              │
            └──────┬───────┘└──────┬───────┘
                   │               │
                   ▼               ▼
            ┌──────────────┐┌──────────────┐
            │ ◇ Sensitive? ││ Queue for    │
            │ (Payment,    ││ Retry        │
            │  Security)   ││              │
            └──────┬───────┘└──────────────┘
                   │
        ┌──────────┴──────────┐
    YES │                     │ NO
        ▼                     ▼
    ┌─────────────┐       ┌─────────────┐
    │ Send Alert  │       │ Continue    │
    │ to Admins   │       │ Normal Flow │
    │ (Email)     │       │             │
    └──────┬──────┘       └──────┬──────┘
           │                     │
           └──────────┬──────────┘
                      │
                      ▼
            ┌──────────────────────┐
            │ Log Analytics/Metrics │
            │ (Optional)            │
            │ - Action Frequency    │
            │ - User Activity       │
            │ - Performance         │
            └────────┬─────────────┘
                     │
                     ▼
               END
```

---

## Summary

Diagram aktivitas di atas menunjukkan:

1. **User Upload & Request** - Alur upload dokumen dan membuat permintaan tanda tangan
2. **Signer Review & Sign** - Proses review dan penandatanganan dokumen
3. **Payment Processing** - Alur subscription dan pembayaran via Midtrans
4. **Group Assignment** - Proses mengirim dokumen ke grup untuk ditandatangani
5. **Dashboard Aggregation** - Pengambilan dan agregasi data dashboard
6. **Version Rollback** - Proses rollback ke versi dokumen sebelumnya
7. **Audit Logging** - Proses pencatatan setiap aktivitas di sistem

Setiap diagram menunjukkan:

- 🔄 **Alur normal** (happy path)
- ❌ **Alur error** (error handling)
- ⚙️ **Proses sistem** (database operations)
- 📧 **Notifikasi** (email notifications)
- 🔐 **Validasi** (security checks)

---

**Generated:** January 2, 2026  
**System:** DigiSign Digital Signature Backend
