# Implementation Guide - ERP Frontend

This guide provides step-by-step instructions for implementing pages, components, and features using the created architecture.

## Quick Start

```bash
cd /sessions/bold-keen-tesla/mnt/ERP/erp_project/frontend

# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local

# Run development server
npm run dev
```

Visit `http://localhost:3000/login` to access the application.

## File Structure Quick Reference

```
Created Files (26 files):
✓ package.json                    - All dependencies configured
✓ next.config.js                  - API proxy setup
✓ tailwind.config.js              - ERP theme colors
✓ postcss.config.js               - CSS processing
✓ src/styles/globals.css          - Base styles + utilities
✓ src/pages/_app.js               - Redux + Toast setup
✓ src/pages/index.js              - Home redirect
✓ src/pages/login.js              - Login form
✓ src/store/index.js              - Store configuration
✓ src/store/api/apiSlice.js       - RTK Query base
✓ src/store/slices/authSlice.js   - Authentication state
✓ src/store/slices/masterSlice.js - Master data caching
✓ src/store/slices/purchaseSlice.js - Purchase endpoints
✓ src/store/slices/salesSlice.js  - Sales endpoints
✓ src/store/slices/productionSlice.js - Production endpoints
✓ src/store/slices/qualitySlice.js - Quality endpoints
✓ src/store/slices/inventorySlice.js - Inventory endpoints
✓ src/store/slices/financeSlice.js - Finance endpoints
✓ src/store/slices/hrSlice.js     - HR endpoints
✓ src/utils/api.js                - Axios + JWT management
✓ src/utils/constants.js          - All enums & constants
✓ src/utils/formatters.js         - Data formatting
✓ src/utils/validators.js         - Input validation
✓ src/hooks/useAuth.js            - Auth checks
✓ src/hooks/useWarehouseScope.js  - Warehouse filtering
✓ src/hooks/usePagination.js      - Pagination state
✓ .env.example                    - Environment template
✓ .gitignore                      - Git ignore rules
✓ README.md                       - Complete documentation
✓ ARCHITECTURE.md                 - Architecture details
```

## Common Implementation Patterns

### Pattern 1: Create a List Page

```javascript
// src/pages/purchase/requests/index.js
import { useGetPurchaseRequestsQuery } from '../../../store/slices/purchaseSlice';
import { usePagination } from '../../../hooks/usePagination';
import { useAuth } from '../../../hooks/useAuth';

export default function PurchaseRequestsList() {
  const { canCreate } = useAuth();
  const pagination = usePagination();
  
  const { data, isLoading, error } = useGetPurchaseRequestsQuery({
    page: pagination.page,
    page_size: pagination.pageSize,
  });

  return (
    <div>
      {canCreate('purchase') && <CreateButton />}
      <Table data={data?.results} />
      <Pagination {...pagination} total={data?.count} />
    </div>
  );
}
```

### Pattern 2: Create a Form Page

```javascript
// src/pages/purchase/requests/new.js
import { useForm } from 'react-hook-form';
import { useCreatePurchaseRequestMutation } from '../../../store/slices/purchaseSlice';
import { validateGSTIN, validateEmail } from '../../../utils/validators';
import toast from 'react-hot-toast';

export default function CreatePR() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [createPR, { isLoading }] = useCreatePurchaseRequestMutation();

  const onSubmit = async (data) => {
    try {
      const result = await createPR(data).unwrap();
      toast.success('PR created successfully');
      router.push(`/purchase/requests/${result.id}`);
    } catch (error) {
      toast.error('Failed to create PR');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('vendor_gstin', {
          validate: (v) => {
            const validation = validateGSTIN(v);
            return validation.valid || validation.error;
          },
        })}
      />
      {errors.vendor_gstin && <span>{errors.vendor_gstin.message}</span>}
      <button type="submit" disabled={isLoading}>
        Create PR
      </button>
    </form>
  );
}
```

### Pattern 3: Use Custom Hooks

```javascript
// Check permissions
const { canApprove, hasRole } = useAuth();

// Filter by warehouse
const { filterByWarehouseScope, getQueryParams } = useWarehouseScope();

// Manage pagination
const { page, pageSize, handlePageChange } = usePagination();

// Use in API call
const { data } = useGetStockLedgerQuery(getQueryParams());
```

### Pattern 4: Format Data

```javascript
import { formatCurrency, formatDate, formatPhoneNumber } from '../utils/formatters';

<span>{formatCurrency(12345.67)}</span>      // ₹12,345.67
<span>{formatDate(dateString)}</span>        // 21-Mar-2024
<span>{formatPhoneNumber('+919876543210')}</span> // +91 98765 43210
```

### Pattern 5: Validate Input

```javascript
import { validateGSTIN, validatePAN, validateEmail, validateForm } from '../utils/validators';

const rules = {
  gstin: (v) => validateGSTIN(v),
  email: (v) => validateEmail(v),
};

const { valid, errors } = validateForm(formData, rules);
if (!valid) {
  console.error(errors); // { gstin: 'Invalid GSTIN', ... }
}
```

## Module-Specific Guides

### Implementing Purchase Module Page

**Available Endpoints:**
```javascript
// From purchaseSlice
useGetPurchaseRequestsQuery()
useGetPurchaseRequestQuery(id)
useCreatePurchaseRequestMutation()
useUpdatePurchaseRequestMutation()
useApprovePurchaseRequestMutation()
useRejectPurchaseRequestMutation()
useGetRFQsQuery()
useGetQuotesQuery()
useGetPurchaseOrdersQuery()
useGetReceiptsQuery()
useGetPaymentAdvicesQuery()
// ... more endpoints
```

**Typical Flow:**
1. Load list with `useGetPurchaseRequestsQuery()`
2. Create new item with `useCreatePurchaseRequestMutation()`
3. Approve with `useApprovePurchaseRequestMutation()`
4. Convert/escalate with custom mutations

### Implementing Sales Module Page

**Available Endpoints:**
```javascript
useUploadCustomerPOMutation()      // File upload
useConvertPOToSOMutation()         // Create SO from PO
useGetSalesOrdersQuery()
useApproveSalesOrderMutation()
useGetDispatchChallansQuery()
useGetInvoicesQuery()
useRecordPaymentMutation()
// ... more endpoints
```

### Implementing Quality Module Page

**Available Endpoints:**
```javascript
useGetQCRequestsQuery()
useAssignQCRequestMutation()       // Assign inspector
useSubmitQCResultMutation()        // QC result
useGetLabJobsQuery()
useGetQCReportsQuery()             // Reports & metrics
useGetCounterSamplesQuery()
// ... more endpoints
```

## Error Handling Examples

### Scenario 1: List Page Error

```javascript
const { data, isLoading, error } = useGetPurchaseRequestsQuery();

if (error) {
  return <ErrorMessage error={error} />;
}
```

### Scenario 2: Mutation Error

```javascript
const [createPR] = useCreatePurchaseRequestMutation();

try {
  await createPR(data).unwrap();
} catch (error) {
  const message = error.data?.detail || 'Failed to create PR';
  toast.error(message);
}
```

### Scenario 3: Auto Token Refresh

Token refresh is automatic - no code needed! The interceptor in `src/utils/api.js` handles it.

## Security Best Practices

### Always Check Permissions

```javascript
import { useAuth } from '../hooks/useAuth';

const { canCreate, canApprove } = useAuth();

// Don't render buttons if user can't perform action
{canApprove('purchase') && <ApproveButton />}
```

### Filter Data by Warehouse Scope

```javascript
import { useWarehouseScope } from '../hooks/useWarehouseScope';

const { getQueryParams } = useWarehouseScope();

// Automatically filters to user's warehouses
const { data } = useGetStockLedgerQuery(getQueryParams());
```

### Validate on Both Client and Server

```javascript
// Client-side validation
const validation = validateGSTIN(value);
if (!validation.valid) {
  // Show error
}

// Server-side validation happens on API
try {
  await createVendor(data).unwrap();
} catch (error) {
  // Handle server validation errors
}
```

## Performance Tips

### 1. Use RTK Query Caching

RTK Query automatically caches results. Avoid fetching same data twice:
```javascript
// ✓ Good - will be cached
useGetPurchaseRequestsQuery({ page: 1 });
useGetPurchaseRequestsQuery({ page: 1 }); // Uses cache

// ✗ Bad - always refetches
useGetPurchaseRequestsQuery({ page: 1 });
useGetPurchaseRequestsQuery({ page: 2 });
```

### 2. Use Pagination

Always paginate large lists:
```javascript
const { page, pageSize } = usePagination();
useGetPurchaseRequestsQuery({ 
  page, 
  page_size: pageSize 
});
```

### 3. Lazy Load Components

```javascript
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('../charts/Heavy'), {
  loading: () => <Skeleton />,
});
```

## Testing the Implementation

### Test Auth Flow
1. Go to `/login`
2. Enter demo credentials (see login page)
3. Should redirect to home page
4. Verify Redux state has token

### Test API Calls
1. Enable Redux DevTools in browser
2. Make an API call
3. Check RTK Query state in Redux
4. Verify data is cached

### Test Error Handling
1. Stop backend server
2. Try to load data
3. Should show error message
4. Check axios interceptor logs

### Test Permissions
1. Login as different roles
2. Verify buttons are hidden/shown
3. Try to access restricted pages
4. Should redirect to login or dashboard

## Deployment Steps

### 1. Build the Project
```bash
npm run build
```

### 2. Set Environment Variables
```bash
# .env.production.local
NEXT_PUBLIC_API_URL=https://api.production.com/api/v1
```

### 3. Run Production Build
```bash
npm start
```

### 4. Verify
- Check Redux store initializes
- Test login flow
- Test API calls
- Check no console errors

## Troubleshooting

### Issue: CORS Error
**Solution:** Check `next.config.js` has correct API URL proxy

### Issue: Token not refreshing
**Solution:** Verify backend refresh endpoint returns `access` field

### Issue: Redux state not persisting
**Solution:** Tokens are cleared on logout - this is intentional

### Issue: Mutations not invalidating cache
**Solution:** Check mutation has correct `invalidatesTags`

### Issue: Warehouse scope filter not working
**Solution:** Verify `auth.warehouseScope` is populated after login

## Next Steps

1. **Create dashboard page** - Summary of all modules
2. **Create common components** - Tables, forms, modals
3. **Implement module pages** - Purchase, Sales, etc.
4. **Add unit tests** - For utilities and components
5. **Setup CI/CD** - GitHub Actions or similar
6. **Monitor performance** - Using Next.js analytics

## Support Resources

- Next.js: https://nextjs.org/docs
- Redux Toolkit: https://redux-toolkit.js.org/
- RTK Query: https://redux-toolkit.js.org/rtk-query
- Tailwind CSS: https://tailwindcss.com/docs
- React Hook Form: https://react-hook-form.com/
