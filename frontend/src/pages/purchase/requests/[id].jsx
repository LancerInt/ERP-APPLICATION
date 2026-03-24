import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import ApprovalWidget from '../../../components/common/ApprovalWidget';
import StatusBadge from '../../../components/common/StatusBadge';
import SubformTable from '../../../components/common/SubformTable';

// Mock data - replace with RTK Query
const mockPRDetail = {
  id: 'PR-001',
  prNumber: 'PR-001',
  vendor: {
    id: 'V001',
    name: 'ABC Supplies Inc',
    email: 'contact@abcsupplies.com',
    phone: '+91-9876543210',
  },
  status: 'PENDING',
  totalAmount: 125000,
  deliveryDate: '2024-04-15',
  createdDate: '2024-03-15',
  createdBy: 'John Doe',
  notes: 'Urgent supply needed for production',
  lineItems: [
    {
      id: 1,
      productId: 'P001',
      productName: 'Steel Plate (2mm)',
      quantity: 100,
      rate: 1000,
      amount: 100000,
    },
    {
      id: 2,
      productId: 'P002',
      productName: 'Fasteners (M10)',
      quantity: 500,
      rate: 50,
      amount: 25000,
    },
  ],
  approvalTrail: [
    {
      approverName: 'Admin',
      role: 'Admin',
      status: 'PENDING',
      timestamp: new Date().toISOString(),
      remarks: null,
    },
  ],
};

export default function PurchaseRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pr, setPR] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    // Fetch PR details
    setTimeout(() => {
      setPR(mockPRDetail);
      setIsLoading(false);
    }, 500);
  }, [id]);

  const handleApprove = async (remarks) => {
    setIsApproving(true);
    try {
      // Call API to approve
      console.log('Approving with remarks:', remarks);
      setPR((prev) => ({
        ...prev,
        status: 'APPROVED',
        approvalTrail: [
          ...prev.approvalTrail,
          {
            approverName: 'Current User',
            role: 'Approver',
            status: 'APPROVED',
            timestamp: new Date().toISOString(),
            remarks,
          },
        ],
      }));
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (remarks) => {
    setIsApproving(true);
    try {
      // Call API to reject
      console.log('Rejecting with remarks:', remarks);
      setPR((prev) => ({
        ...prev,
        status: 'REJECTED',
        approvalTrail: [
          ...prev.approvalTrail,
          {
            approverName: 'Current User',
            role: 'Approver',
            status: 'REJECTED',
            timestamp: new Date().toISOString(),
            remarks,
          },
        ],
      }));
    } finally {
      setIsApproving(false);
    }
  };

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

  if (!pr) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-slate-600">Purchase Request not found</p>
        </div>
      </MainLayout>
    );
  }

  const breadcrumbs = [
    { label: 'Purchase', href: '/purchase/requests' },
    { label: 'Requests', href: '/purchase/requests' },
    { label: pr.prNumber },
  ];

  const tableColumns = [
    {
      field: 'productName',
      header: 'Product',
      width: '200px',
    },
    {
      field: 'quantity',
      header: 'Quantity',
      width: '100px',
    },
    {
      field: 'rate',
      header: 'Rate',
      width: '120px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
    {
      field: 'amount',
      header: 'Amount',
      width: '120px',
      render: (value) => `₹${value.toLocaleString()}`,
    },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{pr.prNumber}</h1>
            <div className="flex items-center gap-4 mt-3">
              <StatusBadge status={pr.status} />
              <p className="text-slate-600">
                Created on {pr.createdDate ? new Date(pr.createdDate).toLocaleDateString() : "-"}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/purchase/requests/${pr.id}/edit`)}
            className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
          >
            Edit
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Details</h2>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-600 font-medium">Vendor</p>
                  <p className="text-slate-900 font-semibold mt-1">{pr.vendor.name}</p>
                  <p className="text-sm text-slate-600">{pr.vendor.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Delivery Date</p>
                  <p className="text-slate-900 font-semibold mt-1">
                    {pr.deliveryDate ? new Date(pr.deliveryDate).toLocaleDateString() : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Total Amount</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    ₹{(pr.totalAmount || 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Created By</p>
                  <p className="text-slate-900 font-semibold mt-1">{pr.createdBy}</p>
                </div>
              </div>

              {pr.notes && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <p className="text-sm text-slate-600 font-medium">Notes</p>
                  <p className="text-slate-900 mt-2">{pr.notes}</p>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">Line Items</h2>
              <SubformTable
                columns={tableColumns}
                data={pr.lineItems}
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
          </div>

          {/* Approval widget */}
          <div>
            <ApprovalWidget
              status={pr.status}
              approvalTrail={pr.approvalTrail}
              canApprove={true}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
