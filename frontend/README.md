# ERP System - Frontend

A production-grade Next.js 14 + React 18 + Redux Toolkit frontend for a comprehensive Enterprise Resource Planning (ERP) system.

## Architecture Overview

### Technology Stack

- **Framework**: Next.js 14 with React 18
- **State Management**: Redux Toolkit + RTK Query
- **API Client**: Axios with JWT token injection and auto-refresh
- **Styling**: Tailwind CSS
- **Form Handling**: React Hook Form
- **UI Components**: Headless UI + Heroicons
- **Notifications**: React Hot Toast
- **Date Handling**: date-fns
- **Charts**: Chart.js + react-chartjs-2
- **File Handling**: xlsx, react-dropzone

### Project Structure

```
frontend/
├── src/
│   ├── pages/
│   │   ├── _app.js              # Redux Provider + Global Layout
│   │   ├── index.js             # Dashboard Redirect
│   │   └── login.js             # Authentication Page
│   ├── store/
│   │   ├── api/
│   │   │   └── apiSlice.js      # RTK Query Base API
│   │   ├── slices/
│   │   │   ├── authSlice.js     # Auth State & JWT Management
│   │   │   ├── masterSlice.js   # Master Data (Dropdowns)
│   │   │   ├── purchaseSlice.js # Purchase Module Endpoints
│   │   │   ├── salesSlice.js    # Sales Module Endpoints
│   │   │   ├── productionSlice.js # Production Module Endpoints
│   │   │   ├── qualitySlice.js  # Quality Module Endpoints
│   │   │   ├── inventorySlice.js # Inventory Module Endpoints
│   │   │   ├── financeSlice.js  # Finance Module Endpoints
│   │   │   └── hrSlice.js       # HR Module Endpoints
│   │   └── index.js             # Store Configuration
│   ├── hooks/
│   │   ├── useAuth.js           # Authentication & Permission Checks
│   │   ├── useWarehouseScope.js # Warehouse Filtering
│   │   └── usePagination.js     # Pagination State
│   ├── utils/
│   │   ├── api.js               # Axios Instance + Interceptors
│   │   ├── constants.js         # All Status & Role Constants
│   │   ├── formatters.js        # Currency, Date, Number Formatters
│   │   └── validators.js        # GSTIN, PAN, Email, etc Validators
│   └── styles/
│       └── globals.css          # Tailwind + Custom Styles
├── public/
├── package.json
├── next.config.js               # API Proxy to Django Backend
├── tailwind.config.js           # ERP Theme Colors & Config
├── postcss.config.js
└── .env.example
```

## Features

### 1. Authentication & Authorization
- JWT token-based authentication
- Automatic token refresh on 401
- Role-based access control (RBAC)
- Permission checking utilities
- Warehouse scope filtering

### 2. State Management
- Redux Toolkit with RTK Query for API calls
- Centralized auth state with credentials
- Master data caching for dropdowns
- Module-specific state slices
- Auto-tag invalidation for data consistency

### 3. API Integration
- Axios instance with JWT injection
- Automatic token refresh mechanism
- Error handling and retry logic
- Request/response interceptors
- Base URL proxy to Django backend

### 4. Form Handling
- React Hook Form for efficient form management
- Custom validators (GSTIN, PAN, IFSC, Email, Phone)
- Real-time validation feedback
- Error message display

### 5. Data Formatting
- Currency formatting (INR with Intl API)
- Date formatting (date-fns)
- Number formatting with thousands separator
- File size formatting
- Phone number, email, address formatting

### 6. Modules

#### Purchase Module
- Purchase Requests (PR) with multi-level approval
- RFQ Management
- Quote Evaluation
- Purchase Order Processing
- Receipt Management
- Freight & Payment Advice Tracking

#### Sales Module
- Customer PO Upload & Parsing
- Sales Order Creation & Approval
- Dispatch Challan Management
- Invoice Processing with QC
- Receivables & Payment Tracking
- Credit/Debit Notes

#### Production Module
- BOM (Bill of Materials) Management
- Work Order Planning & Execution
- Wage Voucher Tracking
- Yield Logging
- Production Dashboard

#### Quality Module
- QC Request Management
- Lab Job Assignment
- QC Reports & Metrics
- Counter Sample Tracking
- Quality Dashboard

#### Inventory Module
- Stock Ledger Tracking
- Inter-Warehouse Transfers
- Shifting Management
- Job Work Processing
- Stock Returns & Adjustments
- Stock Valuation

#### Finance Module
- General Ledger Management
- Payment Processing
- Bank Statement Reconciliation
- Credit/Debit Notes
- Petty Cash Management
- GST Returns & Liability
- Financial Statements

#### HR Module
- Staff Management
- Attendance Tracking
- Leave Request Management
- Overtime Management
- Payroll Processing
- HR Dashboard

### 7. UI/UX
- Tailwind CSS with custom ERP theme
- Responsive design
- Color-coded status badges
- Toast notifications
- Loading states
- Error handling

## Installation & Setup

### Prerequisites
- Node.js 18+ and npm/yarn
- Django backend running at `http://localhost:8000`

### Installation Steps

1. **Clone the repository**
```bash
cd /sessions/bold-keen-tesla/mnt/ERP/erp_project/frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` and update:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

4. **Run development server**
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

5. **Build for production**
```bash
npm run build
npm start
```

## Usage

### Authentication Flow

1. User navigates to `/login`
2. Enters credentials (email & password)
3. System sends request to `/api/v1/auth/login/`
4. JWT token and refresh token are received and stored
5. Redux state is updated with user credentials
6. User is redirected to appropriate module based on roles

### Making API Calls

#### Using RTK Query (Recommended)

```javascript
import { useGetPurchaseRequestsQuery, useCreatePurchaseRequestMutation } from '../store/slices/purchaseSlice';

function PurchaseRequestsList() {
  const { data, isLoading, error } = useGetPurchaseRequestsQuery({ page: 1 });
  const [createPR] = useCreatePurchaseRequestMutation();

  const handleCreate = async (data) => {
    try {
      await createPR(data).unwrap();
      toast.success('PR created successfully');
    } catch (error) {
      toast.error('Failed to create PR');
    }
  };

  // ... component code
}
```

#### Using Axios

```javascript
import apiClient from '../utils/api';

async function fetchData() {
  try {
    const response = await apiClient.get('/purchase/purchase-requests/');
    return response.data;
  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Authentication & Permissions

```javascript
import { useAuth } from '../hooks/useAuth';

function AdminPanel() {
  const { isAdmin, hasRole, canCreate, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (!hasRole('admin')) {
    return <AccessDenied />;
  }

  return <div>Admin Panel</div>;
}
```

### Warehouse Scope Filtering

```javascript
import { useWarehouseScope } from '../hooks/useWarehouseScope';

function InventoryList() {
  const { inWarehouseScope, filterByWarehouseScope, getQueryParams } = useWarehouseScope();

  // Filter data
  const filtered = filterByWarehouseScope(items);

  // Use in API calls
  const { data } = useGetStockLedgerQuery(getQueryParams());

  return <div>{/* render filtered data */}</div>;
}
```

### Form Validation

```javascript
import { validateForm, validateGSTIN, validateEmail } from '../utils/validators';

const rules = {
  gstin: (val) => validateGSTIN(val),
  email: (val) => validateEmail(val),
};

const { valid, errors } = validateForm(formData, rules);
```

## Constants & Enums

All status choices match the Django backend:

```javascript
import { PR_STATUS, SO_STATUS, ROLES, PRIORITY } from '../utils/constants';

// Usage
if (status === PR_STATUS.APPROVED_L1) {
  // Handle approved L1
}
```

## Error Handling

### API Errors

Errors are automatically handled by the axios interceptor. For 401 errors, the token is automatically refreshed.

```javascript
import { getErrorMessage, isAPIError, isNetworkError } from '../utils/api';

try {
  const response = await apiClient.get('/data');
} catch (error) {
  if (isAPIError(error)) {
    console.error('API Error:', error.response.status);
  } else if (isNetworkError(error)) {
    console.error('Network Error');
  }
  const message = getErrorMessage(error);
  toast.error(message);
}
```

## Performance Optimization

1. **Code Splitting**: Next.js automatically splits code per route
2. **RTK Query Caching**: Automatic cache management with tags
3. **Image Optimization**: Next.js Image component
4. **Tree Shaking**: Unused code removed in production build
5. **SSR/SSG**: Static generation where applicable

## Security

- JWT tokens stored in Redux (cleared on logout)
- CSRF protection via Django backend
- Input validation on client side
- XSS protection via React's default escaping
- Secure password requirements enforced
- Role-based access control
- Warehouse scope filtering

## Troubleshooting

### CORS Issues
Ensure Next.js API proxy is configured in `next.config.js`:
```javascript
async rewrites() {
  return {
    beforeFiles: [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*',
      },
    ],
  };
}
```

### Token Refresh Loop
If experiencing infinite token refresh, check:
- Refresh token validity in backend
- Token expiration times match frontend
- Backend refresh endpoint returns `access` field

### State not updating
Ensure Redux DevTools is enabled in development for debugging:
```javascript
devTools: process.env.NODE_ENV !== 'production'
```

## Deployment

### Building for Production
```bash
npm run build
```

### Environment Configuration
Update `.env.production.local` with production API URL:
```
NEXT_PUBLIC_API_URL=https://api.yoursite.com/api/v1
```

### Hosting Options
- Vercel (Recommended for Next.js)
- AWS Amplify
- Heroku
- Self-hosted Node.js server
- Docker container

## Contributing

1. Follow the existing code structure
2. Use consistent naming conventions
3. Add proper error handling
4. Write comments for complex logic
5. Test thoroughly before committing

## License

Proprietary - ERP System

## Support

For issues, contact the development team or create an issue in the repository.
