# ERP System - Complete Project Structure

## System Overview

A production-grade Enterprise Resource Planning (ERP) system for manufacturing and trading businesses with integrated modules for:
- Purchase Management (PR, PO, Receipts, Payments)
- Sales Management (Customer POs, Sales Orders, Invoices, Receivables)
- Production Management (BOM, Work Orders, Yield Tracking)
- Quality Management (QC Requests, Lab Testing, Reports)
- Inventory Management (Stock Ledger, Transfers, Adjustments)
- Finance Management (Vendor/Customer Ledgers, Payments, GST, Freight)
- HR Management (Attendance, Payroll, Leave, Shifts)
- Master Data Management (Products, Vendors, Customers, Warehouses)

## Technology Stack

**Frontend:**
- React 18+ (JavaScript, no TypeScript)
- Tailwind CSS for styling
- Redux for state management
- Redux hooks (useSelector, useDispatch)
- RTK Query (prepared for integration)
- React Router for navigation
- React Hook Form for form management
- Lucide React for icons

**Architecture:**
- Component-based architecture
- Layout isolation (Sidebar, Header)
- Reusable common components
- Page-level components for features
- Mock data with RTK Query readiness

## File Inventory

### Layout Components (3 files)
1. **Sidebar.js** - Role-based collapsible navigation
   - Modules: Dashboard, Masters, Purchase, Sales, Production, Quality, Inventory, Finance, HR, Admin
   - Mobile responsive
   - Icons from Lucide

2. **Header.js** - Top navigation bar
   - User profile with avatar
   - Warehouse selector dropdown
   - Notifications bell with counter
   - Logout functionality

3. **MainLayout.js** - Layout wrapper
   - Combines Sidebar + Header
   - Breadcrumb support
   - Page content area

### Common Components (8 files)

1. **DataTable.js** - Generic data table
   - Configurable columns with sorting
   - Server-side pagination
   - Full-text search
   - Multi-select filters
   - Bulk select with checkboxes
   - Export button
   - Loading skeleton
   - Empty state

2. **FormBuilder.js** - Dynamic form renderer
   - Field types: text, email, phone, number, decimal, date, datetime, select, multiselect, textarea, file, checkbox, lookup
   - Conditional field visibility
   - Section grouping with collapsible headers
   - React Hook Form integration
   - Inline validation
   - Async field options

3. **ApprovalWidget.js** - Approval workflow
   - Status badges
   - Approval timeline with icons
   - Approve/Reject buttons
   - Remarks modal
   - Partial approval for line items
   - Permission gating

4. **SubformTable.js** - Editable line items table
   - Add/Delete rows
   - Inline cell editing
   - Auto-calculate totals
   - Summary row
   - Non-editable columns

5. **FileUpload.js** - Drag-and-drop upload
   - File type validation
   - Size validation
   - Progress bar
   - Multiple file support
   - File icons
   - Error handling

6. **StatusBadge.js** - Status indicator
   - 9 color schemes
   - Custom labels
   - Inline display

7. **ConfirmModal.js** - Confirmation dialog
   - Custom title, message, buttons
   - Danger mode styling
   - Backdrop overlay

8. **StatsCard.js** - Dashboard metric
   - Icon, label, value
   - Trend indicator with percentage
   - Click handler
   - Loading state

### Dashboard (1 file)

**dashboard/index.js** - Main dashboard
- 4 stats cards (Pending Approvals, Open POs, Overdue Receivables, Active WOs)
- Recent activity feed with timeline
- Quick action buttons
- Dashboard charts (placeholder)
- Role-based widget visibility

### Purchase Module (4 files)

1. **purchase/requests/index.js** - PR list
   - DataTable with PR data
   - Status filter
   - Vendor search
   - Create new button
   - Export to Excel

2. **purchase/requests/new.js** - Create PR
   - Vendor lookup with async search
   - Delivery date selection
   - Line items table with add/delete
   - SubformTable for line items
   - Auto-calculate totals
   - Form submission

3. **purchase/requests/[id].js** - PR detail
   - Full PR information
   - Vendor details
   - Line items display
   - ApprovalWidget for approval workflow
   - Approval trail timeline
   - Status display

4. **purchase/orders/index.js** - PO list
   - PO data with PR reference
   - Status filter
   - Create new button
   - Expected delivery date

5. **purchase/orders/[id].js** - PO detail
   - Ordered vs Received quantities
   - Goods receipt tracking
   - Vendor information panel
   - Summary: total ordered, received, pending

### Sales Module (3 files)

1. **sales/customer-po/index.js** - Customer PO uploads
   - File upload history
   - AI parse status (Completed, Processing, Failed)
   - Customer search
   - Upload new PO button

2. **sales/customer-po/new.js** - Upload & parse PO
   - Customer selection
   - File upload with drag-drop
   - AI-powered parsing preview
   - Extracted items display
   - Create sales order button

3. **sales/orders/index.js** - Sales orders
   - SO number, customer, amount
   - Status filters
   - Delivery date tracking
   - Create new button

### Production Module (2 files)

1. **production/work-orders/index.js** - Work order list
   - Product, quantity, stage
   - Progress bar with percentage
   - Filter by stage
   - Search by product
   - Create new button

2. **production/work-orders/[id].js** - Work order detail
   - Product and BOM information
   - Production timeline with 6 stages
   - Completed percentage progress bar
   - Stage-wise timeline visualization
   - Stage breakdown summary

### Quality Module (2 files)

1. **quality/requests/index.js** - QC request list
   - QC number, product, reference
   - Test status (Pending, In Progress, Completed)
   - Result badge (Pass/Fail)
   - Filter by status
   - Create new button

2. **quality/requests/[id].js** - QC detail
   - Product and batch information
   - Quality parameters with specifications
   - Sample size and actual values
   - Test results
   - Pass rate percentage
   - Remarks section
   - Approval status

### Inventory Module (1 file)

**inventory/stock-ledger/index.js** - Stock ledger
- Summary cards: Total Stock Qty, Total Stock Value
- Multi-column table:
  - Date, Product, Warehouse, Godown, Batch
  - Opening, In, Out, Closing quantities
  - Stock value with rate
- Filters: Warehouse, Product, Date range
- Export functionality

### Finance Module (1 file)

**finance/payments/index.js** - Payment advice
- Summary cards: Pending, Approved, Total Amount
- 2-step approval workflow visualization
- Payment list with:
  - Payment number, vendor, amount
  - Approval counter (1/2, 2/2)
  - Status badges
  - Due date
- Status filters
- Create new payment button

### HR Module (1 file)

**hr/attendance/index.js** - Attendance dashboard
- Summary cards: Total Staff, Present, Absent, Late
- Date selector
- Staff grid with cards:
  - Name, Employee ID, Department
  - Status badge
  - Check-in/out times
  - Check-in button
- Geo-fenced location verification modal
- Location coordinates display

### Masters Module (2 files)

1. **masters/products/index.js** - Product master
   - Product code, name, category
   - Type (Goods vs Services)
   - Unit, HSN code, status
   - Filter by status and type
   - Search by code or name
   - Create new button

2. **masters/products/new.js** - Create product
   - Basic information section
   - Classification section
   - Tax & Compliance section
   - Conditional HSN code field (goods only)
   - GST rate selection
   - Category and unit selection
   - Info box with notes

## Component Dependencies

```
MainLayout
├── Sidebar (module navigation)
├── Header (user menu, warehouse selector, notifications)
└── Page content
    ├── DataTable (for list pages)
    ├── FormBuilder (for create/edit forms)
    ├── SubformTable (for line items)
    ├── ApprovalWidget (for approval workflows)
    ├── FileUpload (for document uploads)
    ├── StatusBadge (for status display)
    ├── StatsCard (for dashboard)
    └── ConfirmModal (for actions)
```

## Data Flow

1. **List Pages**: DataTable → Select row → Navigate to detail
2. **Detail Pages**: Fetch data → Display with related components → ApprovalWidget for approvals
3. **Create Pages**: FormBuilder → SubformTable for line items → Submit → Redirect to list
4. **Approval Flow**: Status → ApprovalWidget → Approve/Reject → Update trail

## State Management

**Redux Usage:**
- User authentication state
- Warehouse selection
- Notifications
- Permission flags for role-based access

**Local State:**
- Form data (with React Hook Form)
- Page pagination, sorting, filters
- Modal visibility
- Loading states

## Styling Approach

**Tailwind CSS:**
- Primary colors: Blue (#2563EB)
- Neutral: Slate (#334155)
- Status colors: Green (success), Red (error), Yellow (warning), Purple (closed)
- Consistent spacing: 4px unit system
- Responsive breakpoints: `md:` (768px), `lg:` (1024px)

## Responsive Design

- Mobile: Full-width layout, sidebar drawer overlay
- Tablet: Sidebar visible, grid columns: 2
- Desktop: Full layout, grid columns: 3-4

## Key Features Implemented

✅ Module-based navigation with role-based access
✅ Multi-level approval workflows
✅ Inline form validation
✅ Advanced data table with sorting, filtering, pagination
✅ Dynamic form builder with conditional fields
✅ Editable line items with auto-calculation
✅ File upload with validation
✅ Approval timeline visualization
✅ Geo-fenced attendance tracking
✅ AI-powered document parsing preview
✅ Stock ledger with multi-level filtering
✅ Responsive mobile-first design
✅ Loading states and empty states
✅ Error handling and validation

## Missing Files (Ready for Backend Integration)

- RTK Query API hooks
- Redux slices for state management
- API service endpoints
- Actual backend integration
- WebSocket for real-time updates
- File download/export functionality
- Chart library integration (Recharts/Chart.js)

## Usage Examples

### Basic List Page
```javascript
import MainLayout from '../components/layout/MainLayout';
import DataTable from '../components/common/DataTable';

export default function ItemList() {
  const [page, setPage] = useState(1);
  return (
    <MainLayout breadcrumbs={[{ label: 'Items' }]}>
      <DataTable
        columns={columns}
        data={data}
        page={page}
        onPageChange={setPage}
      />
    </MainLayout>
  );
}
```

### Form Page
```javascript
import FormBuilder from '../components/common/FormBuilder';
import SubformTable from '../components/common/SubformTable';

export default function CreateItem() {
  return (
    <MainLayout>
      <FormBuilder fields={fields} onSubmit={handleSubmit} />
      <SubformTable columns={columns} data={lineItems} />
    </MainLayout>
  );
}
```

### Approval Page
```javascript
import ApprovalWidget from '../components/common/ApprovalWidget';

export default function ItemDetail() {
  return (
    <MainLayout>
      <ApprovalWidget
        status={status}
        approvalTrail={trail}
        canApprove={true}
        onApprove={handleApprove}
      />
    </MainLayout>
  );
}
```

## Production Checklist

- [ ] Connect to actual backend API with RTK Query
- [ ] Implement Redux slices for state management
- [ ] Add error boundaries for better error handling
- [ ] Implement image/PDF preview in FileUpload
- [ ] Add chart library for dashboard visualization
- [ ] Implement WebSocket for real-time notifications
- [ ] Add file export functionality
- [ ] Implement audit trail logging
- [ ] Add user activity tracking
- [ ] Setup environment variables
- [ ] Add unit tests for components
- [ ] Setup E2E tests with Cypress/Playwright
- [ ] Performance optimization (lazy loading, code splitting)
- [ ] SEO optimization if needed
- [ ] Accessibility audit (WCAG 2.1)
- [ ] Security audit (XSS, CSRF, SQL injection prevention)
