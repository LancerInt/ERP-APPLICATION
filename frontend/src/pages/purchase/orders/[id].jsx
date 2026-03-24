import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';
import SubformTable from '../../../components/common/SubformTable';

const mockPODetail = {
  id: 'PO-001',
  poNumber: 'PO-001',
  prNumber: 'PR-001',
  vendor: {
    id: 'V001',
    name: 'ABC Supplies Inc',
    email: 'contact@abcsupplies.com',
    phone: '+91-9876543210',
    address: '123 Industrial Area, City',
  },
  status: 'CONFIRMED',
  totalAmount: 125000,
  deliveryDate: '2024-04-15',
  createdDate: '2024-03-14',
  confirmedDate: '2024-03-15',
  lineItems: [
    {
      id: 1,
      productId: 'P001',
      productName: 'Steel Plate (2mm)',
      quantity: 100,
      received: 60,
      rate: 1000,
      amount: 100000,
    },
    {
      id: 2,
      productId: 'P002',
      productName: 'Fasteners (M10)',
      quantity: 500,
      received: 500,
      rate: 50,
      amount: 25000,
    },
  ],
  receipts: [
    {
      id: 'GRN-001',
      grNumber: 'GRN-001',
      receiptDate: '2024-03-20',
      items: 2,
      quantity: 560,
      status: 'COMPLETED',
    },
  ],
};

export default function PurchaseOrderDetail() {
  const { id } = useParams();
  const [po, setPO] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setPO(mockPODetail);
      setIsLoading(false);
    }, 500);
  }, [id]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 rounded animate-pulse" />
          ))}
        </div>
      </MainLayout>
    );
  }

  const breadcrumbs = [
    { label: 'Purchase', href: '/purchase/orders' },
    { label: 'Orders', href: '/purchase/orders' },
    { label: po.poNumber },
  ];

  const lineItemColumns = [
    {
      field: 'productName',
      header: 'Product',
      width: '200px',
    },
    {
      field: 'quantity',
      header: 'Ordered',
      width: '100px',
    },
    {
      field: 'received',
      header: 'Received',
      width: '100px',
    },
    {
      field: 'rate',
      header: 'Rate',
      width: '100px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'amount',
      header: 'Amount',
      width: '120px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
  ];

  const receiptColumns = [
    {
      field: 'grNumber',
      header: 'GRN',
      width: '120px',
    },
    {
      field: 'receiptDate',
      header: 'Date',
      width: '120px',
      render: (value) => value ? new Date(value).toLocaleDateString() : "-",
    },
    {
      field: 'quantity',
      header: 'Quantity',
      width: '100px',
    },
    {
      field: 'status',
      header: 'Status',
      width: '120px',
      render: (value) => <StatusBadge status={value} />,
    },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-6xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{po.poNumber}</h1>
            <div className="flex items-center gap-4 mt-3">
              <StatusBadge status={po.status} />
              <p className="text-slate-600">
                Created on {po.createdDate ? new Date(po.createdDate).toLocaleDateString() : "-"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Details</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-600 font-medium">PR Number</p>
                  <p className="text-slate-900 font-semibold mt-1">{po.prNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Vendor</p>
                  <p className="text-slate-900 font-semibold mt-1">{po.vendor.name}</p>
                  <p className="text-sm text-slate-600">{po.vendor.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Total Amount</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    ₹{(po.totalAmount || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Expected Delivery</p>
                  <p className="text-slate-900 font-semibold mt-1">
                    {po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString() : "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Line Items</h2>
              <SubformTable
                columns={lineItemColumns}
                data={po.lineItems}
                editable={false}
                summary={[
                  {
                    field: 'amount',
                    label: 'Total',
                    format: (val) => `₹${(val || 0).toLocaleString()}`,
                  },
                ]}
              />
            </div>

            {/* Receipts */}
            {po.receipts && po.receipts.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-6">
                  Goods Receipts
                </h2>
                <SubformTable
                  columns={receiptColumns}
                  data={po.receipts}
                  editable={false}
                />
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Summary</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-600">Total Ordered</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {po.lineItems.reduce((sum, item) => sum + item.quantity, 0)} units
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total Received</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {po.lineItems.reduce((sum, item) => sum + item.received, 0)} units
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Pending Receipt</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {po.lineItems.reduce((sum, item) => sum + (item.quantity - item.received), 0)} units
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Vendor Info</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-600">Email</p>
                  <p className="text-slate-900 font-medium">{po.vendor.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Phone</p>
                  <p className="text-slate-900 font-medium">{po.vendor.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Address</p>
                  <p className="text-slate-900 font-medium">{po.vendor.address}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
