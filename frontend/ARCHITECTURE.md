# ERP Frontend Architecture Documentation

## Overview

This is a production-grade frontend for a comprehensive Enterprise Resource Planning (ERP) system built with Next.js 14, React 18, Redux Toolkit, and Tailwind CSS. The architecture is designed to be scalable, maintainable, and performant.

## Technology Stack

### Core Framework
- **Next.js 14**: React framework with built-in routing, API routes, and optimization
- **React 18**: UI library with concurrent features and automatic batching

### State Management
- **Redux Toolkit**: Modern Redux setup with reduced boilerplate
- **RTK Query**: Data fetching and caching layer built into Redux Toolkit
- **Axios**: HTTP client with interceptors for JWT management

### Styling & UI
- **Tailwind CSS**: Utility-first CSS framework with custom ERP theme
- **Headless UI**: Unstyled, accessible components
- **Heroicons**: Beautiful SVG icons

### Forms & Validation
- **React Hook Form**: Performant, flexible form handling
- **Custom Validators**: GSTIN, PAN, IFSC, Email, Phone validators

### Utilities
- **date-fns**: Modern date utility library
- **Chart.js + react-chartjs-2**: Data visualization
- **xlsx**: Excel file generation
- **react-dropzone**: File upload handling
- **react-hot-toast**: Notification system

## Project Structure

```
frontend/
├── src/
│   ├── pages/                    # Next.js page routes
│   │   ├── _app.js              # App wrapper with Redux Provider
│   │   ├── index.js             # Home/redirect page
│   │   ├── login.js             # Authentication page
│   │   ├── dashboard/           # Dashboard pages
│   │   ├── purchase/            # Purchase module pages
│   │   ├── sales/               # Sales module pages
│   │   ├── production/          # Production module pages
│   │   ├── quality/             # Quality module pages
│   │   ├── inventory/           # Inventory module pages
│   │   ├── finance/             # Finance module pages
│   │   └── hr/                  # HR module pages
│   │
│   ├── store/                   # Redux state management
│   │   ├── api/
│   │   │   └── apiSlice.js      # RTK Query base API definition
│   │   ├── slices/
│   │   │   ├── authSlice.js     # Auth state, login, token refresh
│   │   │   ├── masterSlice.js   # Master data caching
│   │   │   ├── purchaseSlice.js # Purchase module API endpoints
│   │   │   ├── salesSlice.js    # Sales module API endpoints
│   │   │   ├── productionSlice.js # Production module API endpoints
│   │   │   ├── qualitySlice.js  # Quality module API endpoints
│   │   │   ├── inventorySlice.js # Inventory module API endpoints
│   │   │   ├── financeSlice.js  # Finance module API endpoints
│   │   │   └── hrSlice.js       # HR module API endpoints
│   │   └── index.js             # Store configuration
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.js           # Auth state & permission checks
│   │   ├── useWarehouseScope.js # Warehouse filtering logic
│   │   └── usePagination.js     # Pagination state management
│   │
│   ├── utils/                   # Utility functions
│   │   ├── api.js               # Axios instance with interceptors
│   │   ├── constants.js         # Status enums, roles, messages
│   │   ├── formatters.js        # Currency, date, number formatters
│   │   └── validators.js        # Input validation functions
│   │
│   ├── components/              # Reusable React components
│   │   ├── common/              # Generic components
│   │   │   ├── DataTable.js
│   │   │   ├── FormBuilder.js
│   │   │   ├── StatusBadge.js
│   │   │   ├── FileUpload.js
│   │   │   └── ...
│   │   └── layout/              # Layout components
│   │       ├── MainLayout.js
│   │       ├── Sidebar.js
│   │       └── Header.js
│   │
│   └── styles/
│       └── globals.css          # Tailwind imports & custom styles
│
├── public/                      # Static assets
├── package.json
├── next.config.js               # Next.js configuration with API proxy
├── tailwind.config.js           # Tailwind theme customization
├── postcss.config.js            # PostCSS configuration
├── .env.example                 # Environment variables template
└── README.md
```

## Core Concepts

### 1. State Management Architecture

#### Redux Store Structure
```
state: {
  auth: {
    user: { id, name, email, ... },
    token: "jwt-token",
    refreshToken: "refresh-token",
    roles: ["procurement_manager"],
    permissions: ["purchase.create", "purchase.approve"],
    modules: ["purchase", "master"],
    warehouseScope: [1, 2], // Warehouse IDs user can access
    isLoading: false,
    error: null,
    isAuthenticated: true,
  },
  
  master: {
    companies: [...],
    warehouses: [...],
    godowns: [...],
    products: [...],
    vendors: [...],
    customers: [...],
    transporters: [...],
    priceLists: [...],
    taxMasters: [...],
    isLoading: false,
    lastUpdated: "2024-03-21T10:00:00Z",
  },
  
  [api.reducerPath]: {
    queries: { /* RTK Query caches */ },
    mutations: { /* Mutation state */ },
  }
}
```

#### RTK Query API Structure
Each module slice injects endpoints into the base apiSlice:
- Queries: GET endpoints with caching
- Mutations: POST/PATCH/DELETE endpoints with tag invalidation

### 2. API Integration Pattern

#### Base API Slice Configuration
```javascript
// baseQuery with JWT token injection
// Auto-refresh logic on 401
// Tag-based invalidation for cache management
// Handles CORS, credentials, content-type
```

#### Module-Specific Slices
Each module (purchase, sales, etc.) injects endpoints:
```javascript
export const purchaseApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPurchaseRequests: builder.query({...}),
    createPurchaseRequest: builder.mutation({...}),
    // ... more endpoints
  }),
});
```

### 3. Authentication Flow

1. **Login Page**
   - User enters email/password
   - `loginUser` async thunk dispatched
   - API returns: access token, refresh token, user data, roles, permissions

2. **Token Storage**
   - Tokens stored in Redux state (cleared on logout)
   - localStorage backup for session persistence

3. **Auto-Refresh**
   - Interceptor detects 401 response
   - Refresh token used to get new access token
   - Failed request retried with new token
   - Redirect to login if refresh fails

4. **Authorization**
   - `useAuth` hook provides permission checks
   - Components conditionally render based on roles/permissions
   - API calls automatically include Authorization header

### 4. Warehouse Scope Filtering

Some users can only see data for specific warehouses:
- Warehouse IDs stored in `auth.warehouseScope`
- `useWarehouseScope` hook provides filtering utilities
- Applied to both API queries and local data filtering
- Users with empty scope (admins) see all data

### 5. Form Handling Strategy

1. **React Hook Form** for efficient form management
2. **Built-in validators** for common patterns:
   - GSTIN validation (Indian GST ID)
   - PAN validation (Permanent Account Number)
   - IFSC validation (Bank code)
   - Email, phone, date validation

3. **Real-time validation** with error display
4. **Custom validation rules** per form

### 6. Data Formatting Utilities

Centralized formatting for consistency:
- Currency: INR format with Intl API
- Dates: date-fns with Indian locale
- Numbers: thousands separator
- Phone: Indian format with +91
- File sizes: Bytes to GB conversion
- Status labels: Capitalized with color mapping

## Key Features Implementation

### Feature 1: JWT Authentication
- Token injection via axios interceptor
- Automatic token refresh on 401
- Credentials/roles/permissions loaded after login
- Session persistence across page reloads

### Feature 2: Role-Based Access Control
```javascript
const { hasRole, canCreate, canApprove } = useAuth();
{canApprove('purchase') && <ApprovalButton />}
```

### Feature 3: Data Caching with RTK Query
```javascript
// Automatic caching with tags
useGetPurchaseRequestsQuery() // Cached
useCreatePurchaseRequestMutation() // Invalidates PurchaseRequests tag
```

### Feature 4: Warehouse Scope Filtering
```javascript
const { getQueryParams, filterByWarehouseScope } = useWarehouseScope();
// Automatically filters queries and data
```

### Feature 5: Pagination Hook
```javascript
const { page, pageSize, total, handlePageChange, getPaginationParams } = usePagination();
// Manages all pagination state in one hook
```

## Module-Specific Endpoints

### Purchase Module (7 sub-modules)
- Purchase Requests (list, create, approve, reject, convert to RFQ)
- RFQs (list, create, send to vendors)
- Quotes (list, submit, evaluate)
- Evaluations (create, approve, reject)
- Purchase Orders (list, create, approve)
- Receipts (list, create, QC approve)
- Freight & Payment Advices

### Sales Module (5 sub-modules)
- Customer PO Upload & Parsing
- Sales Orders (create, approve, dispatch)
- Dispatch Challans (create, release)
- Invoices (create, finalize, process, accept payment)
- Receivables & Payments

### Production Module (4 sub-modules)
- BOMs (list, create, update)
- Work Orders (create, release, complete)
- Wage Vouchers (create, approve)
- Yield Logs (track production output)

### Quality Module (4 sub-modules)
- QC Requests (create, assign, submit results)
- Lab Jobs (track lab testing)
- QC Reports (metrics & analytics)
- Counter Samples (vendor dispute resolution)

### Inventory Module (5 sub-modules)
- Stock Ledger (real-time stock tracking)
- Transfers (inter-warehouse movement)
- Shifting (intra-warehouse movement)
- Job Work (outsourced production)
- Returns & Adjustments

### Finance Module (7 sub-modules)
- Ledgers (GL maintenance)
- Payments (vendor/employee payments)
- Bank Statements (reconciliation)
- Credit/Debit Notes (adjustments)
- Petty Cash (cash management)
- GST (tax compliance)

### HR Module (5 sub-modules)
- Staff (employee master)
- Attendance (daily tracking)
- Leave (requests & approvals)
- Overtime (calculation & approval)
- Payroll (salary processing)

## Constants System

All enums match Django backend exactly:
```javascript
PR_STATUS, RFQ_STATUS, PO_STATUS, SO_STATUS, INVOICE_STATUS,
WORKORDER_STATUS, QC_REQUEST_STATUS, TRANSFER_STATUS, PAYMENT_STATUS,
ROLES, PRIORITY, GENDER, MARITAL_STATUS, EMPLOYMENT_TYPE
```

Color mapping for status badges:
```javascript
STATUS_COLORS = { draft: 'neutral', approved: 'success', ... }
```

## Error Handling Strategy

1. **API Level**
   - Axios interceptors catch all errors
   - 401 triggers auto-refresh
   - 400+ handled with specific messages
   - Network errors show connectivity message

2. **Component Level**
   - RTK Query isError flag
   - Error state in Redux slices
   - Toast notifications for user feedback

3. **Form Level**
   - React Hook Form validation
   - Custom validator functions
   - Field-level error display

## Performance Optimizations

1. **Code Splitting**: Next.js per-route splitting
2. **RTK Query Caching**: Automatic with tag invalidation
3. **Image Optimization**: Next/Image component
4. **Tree Shaking**: Dead code removal in build
5. **Lazy Loading**: Dynamic imports for heavy components
6. **Memoization**: useMemo/useCallback for expensive operations

## Security Considerations

1. **JWT Storage**: Redux state (cleared on logout)
2. **Token Refresh**: Automatic on 401
3. **CSRF Protection**: Handled by Django backend
4. **Input Validation**: Client-side + server-side
5. **XSS Prevention**: React's default escaping
6. **RBAC**: Role & permission based rendering
7. **Warehouse Scope**: Data filtering by allowed warehouses

## Development Workflow

### Adding a New Feature

1. **Create Redux Slice** (if needed)
   ```javascript
   // store/slices/newFeatureSlice.js
   ```

2. **Add RTK Query Endpoints**
   ```javascript
   export const newFeatureApi = apiSlice.injectEndpoints({...})
   ```

3. **Create Component**
   ```javascript
   // components/features/NewFeature.js
   import { useNewFeatureQuery } from '../store/slices/newFeatureSlice'
   ```

4. **Add Route**
   ```javascript
   // pages/module/feature/index.js
   ```

5. **Add Constants** (if needed)
   ```javascript
   // utils/constants.js - add status enums
   ```

### Adding a New Validator

```javascript
// utils/validators.js
export const validateCustomField = (value) => {
  if (!value) return { valid: false, error: 'Required' };
  // Validation logic
  return { valid: true };
};
```

### Adding a New Formatter

```javascript
// utils/formatters.js
export const formatCustomValue = (value) => {
  // Formatting logic
  return formatted;
};
```

## Testing Considerations

While tests aren't included in this base, the architecture supports:
- Unit tests for utils (validators, formatters)
- Component tests with React Testing Library
- Redux state tests with Redux Test Utils
- API mocking with MSW (Mock Service Worker)

## Deployment Checklist

- [ ] Environment variables configured
- [ ] API URL set to production backend
- [ ] Build succeeds without errors
- [ ] No console errors/warnings in dev
- [ ] All RTK Query endpoints working
- [ ] Auth flow tested end-to-end
- [ ] Error handling verified
- [ ] Performance metrics acceptable
- [ ] Security headers configured
- [ ] CORS properly set up

## Future Enhancements

1. **Offline Support**: Service Worker + local storage
2. **Real-time Updates**: WebSocket integration
3. **Advanced Analytics**: Dashboard with charts
4. **Mobile App**: React Native sharing codebase
5. **Internationalization**: Multi-language support
6. **Dark Mode**: Theme toggling
7. **Advanced Search**: Full-text search with filters
8. **Bulk Operations**: Multi-record actions
9. **Audit Trail**: Track all changes
10. **Notifications**: Real-time alerts
