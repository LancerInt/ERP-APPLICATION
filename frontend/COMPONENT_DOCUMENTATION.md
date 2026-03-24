# ERP System - Frontend Components Documentation

## Overview

This is a production-grade React ERP system built with JavaScript (no TypeScript), Tailwind CSS, Redux hooks, and RTK Query. The system is designed for enterprise-level manufacturing and trading operations.

## Directory Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.js           # Collapsible navigation sidebar
│   │   ├── Header.js            # Top navigation bar with user menu
│   │   └── MainLayout.js        # Layout wrapper combining Sidebar + Header
│   └── common/
│       ├── DataTable.js         # Generic data table with sorting, filtering, pagination
│       ├── FormBuilder.js       # Dynamic form renderer with conditional fields
│       ├── ApprovalWidget.js    # Approval workflow component
│       ├── SubformTable.js      # Editable inline table for line items
│       ├── FileUpload.js        # Drag-and-drop file upload with validation
│       ├── StatusBadge.js       # Color-coded status indicators
│       ├── ConfirmModal.js      # Reusable confirmation dialog
│       └── StatsCard.js         # Dashboard metric cards
├── pages/
│   ├── dashboard/
│   │   └── index.js             # Dashboard with stats and quick actions
│   ├── purchase/
│   │   ├── requests/
│   │   │   ├── index.js         # PR list with filters
│   │   │   ├── new.js           # Create PR with line items
│   │   │   └── [id].js          # PR detail with approval workflow
│   │   └── orders/
│   │       ├── index.js         # PO list
│   │       └── [id].js          # PO detail with receipt tracking
│   ├── sales/
│   │   ├── customer-po/
│   │   │   ├── index.js         # Customer PO uploads
│   │   │   └── new.js           # Upload & AI parse POs
│   │   └── orders/
│   │       └── index.js         # Sales orders list
│   ├── production/
│   │   └── work-orders/
│   │       ├── index.js         # Work order list with progress
│   │       └── [id].js          # Work order detail with timeline
│   ├── quality/
│   │   └── requests/
│   │       ├── index.js         # QC request list
│   │       └── [id].js          # QC detail with test results
│   ├── inventory/
│   │   └── stock-ledger/
│   │       └── index.js         # Stock ledger with multi-level filtering
│   ├── finance/
│   │   └── payments/
│   │       └── index.js         # Payment advice with 2-step approval
│   ├── hr/
│   │   └── attendance/
│   │       └── index.js         # Geo-fenced attendance dashboard
│   └── masters/
│       └── products/
│           ├── index.js         # Product master list
│           └── new.js           # Create product with conditional fields
```

## Layout Components

### Sidebar.js
Role-based navigation with collapsible menus for all modules.

**Props:**
- Auto-detects user roles from Redux state
- Only shows accessible modules
- Mobile-friendly with overlay

**Features:**
- Collapse/expand icon navigation
- Smooth transitions
- Dashboard, Masters, Purchase, Sales, Production, Quality, Inventory, Finance, HR, Admin menus

### Header.js
Top navigation with user info, warehouse selector, notifications, and logout.

**Features:**
- Warehouse dropdown with multi-warehouse support
- Notification bell with counter
- User profile menu
- Logout functionality

### MainLayout.js
Wrapper component that combines Sidebar + Header + breadcrumbs.

```javascript
<MainLayout breadcrumbs={[{ label: 'Purchase', href: '#' }, { label: 'Requests' }]}>
  {/* Page content */}
</MainLayout>
```

## Common Components

### DataTable.js
Generic, reusable data table component with full functionality.

**Props:**
```javascript
<DataTable
  columns={[
    { field: 'id', header: 'ID', sortable: true, width: '100px' },
    { field: 'name', header: 'Name', sortable: true, width: '200px' },
    {
      field: 'status',
      header: 'Status',
      render: (value) => <StatusBadge status={value} />
    }
  ]}
  data={array}
  page={1}
  pageSize={10}
  totalRecords={100}
  onPageChange={setPage}
  onSort={(field, order) => {}}
  sortBy="name"
  sortOrder="asc"
  onSearch={setSearchTerm}
  searchPlaceholder="Search..."
  filters={[
    { key: 'status', label: 'Status', options: [...] }
  ]}
  onFilterChange={(filters) => {}}
  onRowClick={(row) => {}}
  onExport={() => {}}
  showBulkSelect={true}
  selectedRows={[]}
  onBulkSelect={setSelectedRows}
  isLoading={false}
  emptyMessage="No data found"
/>
```

**Features:**
- Server-side pagination
- Sorting (click headers)
- Full-text search
- Multi-select filters
- Bulk select with checkboxes
- Export to Excel button
- Loading skeleton
- Empty state
- Row click handler

### FormBuilder.js
Dynamic form renderer with conditional field visibility and validation.

**Props:**
```javascript
<FormBuilder
  fields={[
    {
      section: 'General',
      name: 'vendor',
      label: 'Vendor',
      type: 'lookup',
      required: true,
      placeholder: 'Search vendor...',
      isAsync: true,
      fetchOptions: async (search) => {
        return [{ value: 'V1', label: 'Vendor 1' }];
      }
    },
    {
      section: 'Details',
      name: 'amount',
      label: 'Amount',
      type: 'decimal',
      required: true
    },
    {
      section: 'Details',
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      dependsOn: { field: 'vendor', value: 'V1' }
    }
  ]}
  initialData={{ vendor: '' }}
  onSubmit={(data) => {}}
  onCancel={() => {}}
  submitLabel="Create"
  isLoading={false}
  groupBySection={true}
/>
```

**Supported Field Types:**
- `text`, `email`, `phone` - Text inputs with validation
- `number`, `decimal` - Numeric inputs
- `date`, `datetime` - Date/time pickers
- `select`, `multiselect` - Dropdowns
- `textarea` - Multi-line text
- `checkbox` - Boolean toggle
- `file` - File upload
- `lookup` - Async searchable dropdown

**Features:**
- Group fields by section with collapsible headers
- Conditional visibility with `dependsOn`
- Inline validation with error messages
- React Hook Form integration
- Auto-generated field layout

### ApprovalWidget.js
Complete approval workflow component with timeline and multi-level approval.

**Props:**
```javascript
<ApprovalWidget
  status="PENDING"
  approvalTrail={[
    {
      approverName: 'Admin',
      role: 'Approver Level 1',
      status: 'PENDING',
      timestamp: new Date().toISOString(),
      remarks: null
    }
  ]}
  canApprove={true}
  canPartialApprove={false}
  lineItems={[]}
  onApprove={(remarks) => {}}
  onReject={(remarks) => {}}
  onPartialApprove={(selectedIds, remarks) => {}}
/>
```

**Features:**
- Status badge display
- Approval timeline with icons
- Approve/Reject buttons with remark modal
- Partial approval for line items
- Permission-gated visibility

### SubformTable.js
Editable inline table for line items (PRs, POs, DCs, etc.).

**Props:**
```javascript
<SubformTable
  columns={[
    { field: 'productName', header: 'Product', width: '200px', editable: true },
    { field: 'quantity', header: 'Qty', width: '100px', type: 'number' },
    { field: 'rate', header: 'Rate', width: '100px', type: 'number' },
    { field: 'amount', header: 'Amount', width: '100px', editable: false }
  ]}
  data={lineItems}
  onDataChange={(updatedItems) => {}}
  editable={true}
  summary={[
    { field: 'amount', label: 'Total', format: (val) => `₹${val}` }
  ]}
/>
```

**Features:**
- Click cells to edit inline
- Add/Delete rows
- Auto-calculate totals
- Summary row with formatting
- Non-editable columns

### FileUpload.js
Drag-and-drop file upload with validation.

**Props:**
```javascript
<FileUpload
  onFilesSelected={(files) => {}}
  acceptedFormats={['.pdf', '.doc', '.xls', '.jpg']}
  maxSizeMB={25}
  multiple={false}
  isLoading={false}
  uploadProgress={0}
/>
```

**Features:**
- Drag-and-drop zone
- File type validation
- Size validation
- Progress bar
- File preview
- Error handling

### StatusBadge.js
Color-coded status indicator.

```javascript
<StatusBadge status="PENDING" />
<StatusBadge status="APPROVED" label="Approved by CFO" />
```

**Supported Statuses:**
- DRAFT (gray)
- PENDING (yellow)
- APPROVED (green)
- REJECTED (red)
- IN_PROGRESS (blue)
- CLOSED (purple)
- PAID (emerald)
- CANCELLED (slate)
- COMPLETED (green)
- FAILED (red)

### ConfirmModal.js
Reusable confirmation dialog.

```javascript
<ConfirmModal
  isOpen={true}
  title="Delete Item?"
  message="This action cannot be undone."
  confirmLabel="Delete"
  cancelLabel="Cancel"
  isDangerous={true}
  onConfirm={() => {}}
  onCancel={() => {}}
/>
```

### StatsCard.js
Dashboard metric card with trend indicator.

```javascript
<StatsCard
  icon={ShoppingCartIcon}
  label="Pending Orders"
  value={45}
  trend={15}
  trendLabel="vs last week"
  isLoading={false}
  onClick={() => navigate('/orders')}
/>
```

## Page Components

### Dashboard (src/pages/dashboard/index.js)
**Features:**
- Stats cards: Pending Approvals, Open POs, Overdue Receivables, Active Work Orders
- Recent activity feed
- Quick action buttons
- Dashboard charts (placeholder)
- Role-based widget visibility

### Purchase Module

#### Requests List
- Filter by status (Draft, Pending, Approved, Rejected)
- Sort by date, vendor, amount
- Create new PR
- Click to view detail

#### Create PR
- Dynamic form with vendor lookup
- Line items table with add/delete rows
- Auto-calculate totals
- Submit to create PR

#### PR Detail
- Full PR information
- Line items display
- Approval widget with timeline
- Approve/Reject with remarks

#### Orders List
- Similar to PR list
- Status filters (Confirmed, Partially Received, Closed)
- Quick access to receipts

#### PO Detail
- Vendor information
- Ordered vs Received quantities
- Receipt tracking

### Sales Module

#### Customer PO Upload
- File upload with drag-and-drop
- AI-powered PDF/image parsing
- Parsed data preview with extracted items
- Create SO from parsed data

#### Sales Orders
- Full order lifecycle tracking
- Delivery challan integration
- Invoice generation

### Production Module

#### Work Orders
- List with progress bars
- Filter by stage (Pending, In Progress, Completed)
- Search by product

#### Work Order Detail
- Production timeline with stage progression
- Completed percentage
- Stage-wise breakdown
- Summary panel

### Quality Module

#### QC Requests
- List with test status
- Filter by status
- Search by product

#### QC Detail
- Quality parameters with specifications
- Test results
- Pass/Fail indicators
- Remarks section

### Inventory Module

#### Stock Ledger
- Multi-level filtering (warehouse, godown, product, batch)
- Opening/closing balances
- In/Out quantities
- Stock value calculation
- Summary cards

### Finance Module

#### Payments
- 2-step approval workflow
- Filter by status (Pending, Approved, Processed)
- Approval counter
- Summary: pending, approved, total amount

### HR Module

#### Attendance
- Daily attendance dashboard
- Geo-fenced check-in/check-out
- Staff grid with status
- Check-in modal with location verification
- Summary: present, absent, late count

### Masters Module

#### Products
- Product and service master
- Filter by status and type
- Search by code or name
- Category, unit, HSN code

#### Create Product
- Type selector (Goods vs Services)
- Conditional HSN code field (goods only)
- Unit selection
- GST rate
- Category classification

## Redux Integration

### Expected Redux State Structure

```javascript
{
  auth: {
    user: {
      id: 'USR-001',
      name: 'John Doe',
      email: 'john@company.com',
      roles: ['ADMIN', 'PURCHASE'],
    }
  },
  warehouse: {
    selected: { id: 'WH-001', name: 'Main Warehouse' },
    list: [
      { id: 'WH-001', name: 'Main Warehouse' },
      { id: 'WH-002', name: 'Branch Warehouse' }
    ]
  },
  notifications: {
    items: [
      { id: 1, title: 'PR Approved', message: 'PR-001 approved', timestamp: '2 hours ago' }
    ]
  }
}
```

### Hooks Used

```javascript
// Selection
const user = useSelector((state) => state.auth?.user);
const warehouse = useSelector((state) => state.warehouse?.selected);

// Dispatch
const dispatch = useDispatch();
dispatch({ type: 'auth/logout' });
dispatch({ type: 'warehouse/select', payload: warehouseId });
```

## RTK Query Integration

While components are prepared for RTK Query, currently using mock data. To integrate:

```javascript
import { useGetPurchaseRequestsQuery } from '../api/purchaseApi';

const { data, isLoading, error } = useGetPurchaseRequestsQuery({
  page: 1,
  pageSize: 10,
  sortBy: 'createdDate',
  sortOrder: 'desc'
});
```

## Styling

All components use Tailwind CSS utility classes:
- Color scheme: Blue (primary), Slate (neutral), Green (success), Red (danger), Yellow (warning)
- Spacing: Standard 4px increment (p-4, gap-4, etc.)
- Responsive: Mobile-first with `md:` and `lg:` breakpoints
- Transitions: Smooth 200ms transitions on hover

## Best Practices

1. **Form Handling**: Use FormBuilder for all forms to ensure consistency
2. **Tables**: Use DataTable for all list views with built-in features
3. **Status Display**: Always use StatusBadge for consistency
4. **Layouts**: Always wrap pages with MainLayout
5. **Loading States**: Show loading skeletons while fetching data
6. **Error Handling**: Display user-friendly error messages
7. **Empty States**: Always provide meaningful empty state messages
8. **Role-Based Access**: Check user roles before rendering sensitive features

## Performance Optimization

- Loading skeletons prevent layout shift
- Pagination reduces data transfer
- Async component splitting for large pages
- Memoization ready (can add React.memo)
- Virtual scrolling ready (can integrate react-window)

## Browser Support

- Modern browsers with ES6 support
- Mobile-responsive design
- Touch-friendly buttons and inputs
- Keyboard navigation support

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Color contrast compliance
- Form labels and error messages properly associated

