# Lancer ERP — System Architecture

## 1. High-Level Module Breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│                        LANCER ERP SYSTEM                        │
├─────────────┬──────────┬──────────┬────────────┬───────────────┤
│  MASTER     │ PURCHASE │  SALES   │ PRODUCTION │  INVENTORY    │
│  DATA       │ MODULE   │  MODULE  │ MODULE     │  & LOGISTICS  │
├─────────────┼──────────┼──────────┼────────────┼───────────────┤
│ Company     │ PR       │ Cust PO  │ BOM Request│ Stock Ledger  │
│ Warehouse   │ RFQ      │ SO       │ Material   │ Stock Transfer│
│ Godown      │ Quote    │ DC       │ Work Order │ Wh Shifting   │
│ Product     │ Eval     │ Invoice  │ Yield Log  │ Job Work      │
│ Vendor      │ PO       │ Freight  │ Wage Vouch │ Sales Return  │
│ Customer    │ Receipt  │ Receiv.  │            │ Stk Adjust    │
│ Transporter │ Freight  │          │            │               │
│ Price List  │ Payment  │          │            │               │
│ Tax Master  │          │          │            │               │
│ Template Lib│          │          │            │               │
├─────────────┼──────────┴──────────┴────────────┴───────────────┤
│  QUALITY    │  FINANCE MODULE                                   │
│  CONTROL    ├───────────────────────────────────────────────────┤
├─────────────┤ Vendor Ledger │ Customer Ledger │ Freight Ledger │
│ QC Params   │ Wage Ledger   │ Petty Cash      │ Bank Statement │
│ QC Request  │ Payment Adv   │ Credit/Debit    │ GST Recon      │
│ QC Lab Job  ├───────────────┴─────────────────┴────────────────┤
│ QC Report   │  HR & ATTENDANCE MODULE                           │
│ Counter Smp │  Shift Def │ Attendance │ Leave │ OT │ Payroll    │
├─────────────┼──────────────────────────────────────────────────┤
│  CONFIG &   │  CROSS-CUTTING CONCERNS                           │
│  AUDIT      │  Auth (RBAC) │ Workflow Engine │ AI Parser       │
│  Sys Params │  Audit Trail │ Notifications   │ File Storage    │
│  Decision   │  Redis Cache │ Celery Tasks    │ OCR/LLM         │
└─────────────┴──────────────────────────────────────────────────┘
```

## 2. Django Apps Structure

```
backend/
├── manage.py
├── config/                    # Project settings
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   ├── celery.py
│   └── wsgi.py
├── apps/
│   ├── core/                  # Company, Warehouse, Godown, Roles, Users
│   ├── master/                # Product, Vendor, Customer, Transporter, PriceList, Tax, Template
│   ├── purchase/              # PR, RFQ, Quote, Evaluation, PO, Receipt, Freight(In), Payment
│   ├── sales/                 # CustomerPO, SO, DC, InvoiceCheck, Freight(Out), Receivable
│   ├── production/            # BOM, MaterialIssue, WorkOrder, WageVoucher, YieldLog
│   ├── quality/               # QCParam, QCRequest, QCLabJob, QCReport, CounterSample
│   ├── inventory/             # InventoryLedger, StockTransfer, WhShifting, JobWork, SalesReturn, StockAdjust
│   ├── finance/               # VendorLedger, CustomerLedger, FreightLedger, WageLedger, PaymentAdvice, BankStmt, CreditDebitNote, GST, PettyCash
│   ├── hr/                    # Staff, Shift, Attendance, Leave, Overtime, Payroll
│   ├── workflow/              # Generic workflow engine, approval chains
│   ├── audit/                 # AuditTrail, DecisionLog, SystemParameters
│   └── ai_parser/             # OCR pipeline, LLM parsing, PO parser
├── common/                    # Shared utilities
│   ├── models.py              # BaseModel, TimeStampedModel
│   ├── permissions.py         # RBAC permissions
│   ├── pagination.py
│   ├── exceptions.py
│   └── utils.py
└── requirements/
    ├── base.txt
    ├── development.txt
    └── production.txt
```

## 3. Frontend Structure (Next.js + React + Redux)

```
frontend/
├── package.json
├── next.config.js
├── tailwind.config.js
├── public/
├── src/
│   ├── pages/
│   │   ├── _app.js
│   │   ├── index.js
│   │   ├── login.js
│   │   ├── dashboard/
│   │   ├── masters/
│   │   ├── purchase/
│   │   ├── sales/
│   │   ├── production/
│   │   ├── quality/
│   │   ├── inventory/
│   │   ├── finance/
│   │   ├── hr/
│   │   └── admin/
│   ├── components/
│   │   ├── layout/
│   │   ├── common/            # DataTable, FormBuilder, ApprovalWidget, FileUpload
│   │   ├── masters/
│   │   ├── purchase/
│   │   ├── sales/
│   │   ├── production/
│   │   ├── quality/
│   │   ├── inventory/
│   │   ├── finance/
│   │   └── hr/
│   ├── store/
│   │   ├── index.js
│   │   ├── slices/
│   │   │   ├── authSlice.js
│   │   │   ├── masterSlice.js
│   │   │   ├── purchaseSlice.js
│   │   │   ├── salesSlice.js
│   │   │   ├── productionSlice.js
│   │   │   ├── qualitySlice.js
│   │   │   ├── inventorySlice.js
│   │   │   ├── financeSlice.js
│   │   │   └── hrSlice.js
│   │   └── api/
│   │       └── apiSlice.js    # RTK Query base
│   ├── hooks/
│   ├── utils/
│   └── styles/
```

## 4. Data Flow Diagrams

### Purchase Flow
```
PR (Warehouse) → Approval → RFQ → Quotes → Evaluation → PO → ETA Updates
    → Receipt Advice → QC → Payment Advice → Finance Approval → Payment
    → Freight Advice → Freight Payment
```

### Sales Flow
```
Customer PO Upload (AI Parse) → Sales Order → Approval → DC → Invoice Check
    → Stock Deduction → Receivable Entry → Freight Advice → Payment Collection
```

### Production Flow
```
BOM Request → Approval → Material Issue → Work Order (Stage tracking)
    → Output → QC Request → QC Lab Jobs → QC Report → Yield Log
    → Wage Voucher → Finance Approval
```

### Inventory Flow
```
Receipt/Production → Stock Ledger (append-only)
Stock Transfer: DC → In Transit → Receipt
Job Work: Order → DC → Receipt
Sales Return: Advice → QC → Stock Add/Scrap
Adjustment: Request → Approval → Ledger Entry
```

## 5. Technology Stack

| Layer           | Technology                                    |
|-----------------|-----------------------------------------------|
| Backend         | Django 5.x + DRF 3.15                        |
| Frontend        | Next.js 14 + React 18 + Redux Toolkit         |
| Database        | PostgreSQL 16                                  |
| Cache/Queue     | Redis 7                                        |
| Task Queue      | Celery 5.x                                    |
| OCR             | Tesseract 5                                    |
| LLM             | Ollama (Llama 3) / Google Gemini Free Tier     |
| File Storage    | Local (dev) / AWS S3 (prod)                    |
| Auth            | Django Auth + JWT (SimpleJWT)                  |
| CSS             | Tailwind CSS 3                                 |
| Face Match      | External API integration point                 |

## 6. Key Architecture Decisions

1. **Stock Ledger is append-only** — never update/delete entries; stock is always derived
2. **No hard deletes** — all models use `is_active` soft delete
3. **Service layer pattern** — business logic in services.py, reads in selectors.py
4. **Multi-company isolation** — all transactional data scoped to Company
5. **Warehouse-level RBAC** — users see only their assigned warehouse data
6. **Generic workflow engine** — reusable approval chains across all modules
7. **FIFO valuation** — cost layers tracked in inventory ledger
8. **Audit everything** — every create/update triggers audit log entry
