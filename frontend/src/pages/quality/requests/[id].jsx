import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';

const mockQCDetail = {
  id: 'QC-001',
  qcNumber: 'QC-2024-001',
  product: 'Steel Plate (2mm)',
  productId: 'P001',
  referenceDoc: 'GRN-001',
  quantity: 100,
  status: 'COMPLETED',
  result: 'PASS',
  createdDate: '2024-03-15',
  completedDate: '2024-03-16',
  qcParams: [
    {
      id: 1,
      name: 'Thickness',
      specification: '2mm ± 0.1mm',
      sampleSize: 10,
      testResult: 'PASS',
      actualValue: '2.0mm',
    },
    {
      id: 2,
      name: 'Surface Finish',
      specification: 'Ra < 3.2',
      sampleSize: 5,
      testResult: 'PASS',
      actualValue: 'Ra 2.8',
    },
    {
      id: 3,
      name: 'Tensile Strength',
      specification: '≥ 400 MPa',
      sampleSize: 3,
      testResult: 'PASS',
      actualValue: '420 MPa',
    },
  ],
  remarks: 'All parameters within specification. Material approved for production use.',
};

export default function QCRequestDetail() {
  const { id } = useParams();
  const [qc, setQC] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setQC(mockQCDetail);
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
    { label: 'Quality', href: '/quality/requests' },
    { label: 'Requests', href: '/quality/requests' },
    { label: qc.qcNumber },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-6xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{qc.qcNumber}</h1>
            <div className="flex items-center gap-4 mt-3">
              <StatusBadge status={qc.status} />
              <StatusBadge status={qc.result} label={qc.result} />
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
                  <p className="text-sm text-slate-600 font-medium">Product</p>
                  <p className="text-slate-900 font-semibold mt-1">{qc.product}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Reference Document</p>
                  <p className="text-slate-900 font-semibold mt-1">{qc.referenceDoc}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Sample Quantity</p>
                  <p className="text-slate-900 font-semibold mt-1">{qc.quantity} units</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Completed Date</p>
                  <p className="text-slate-900 font-semibold mt-1">
                    {qc.completedDate ? new Date(qc.completedDate).toLocaleDateString() : "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* QC Parameters */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">
                Quality Parameters
              </h2>

              <div className="space-y-4">
                {qc.qcParams.map((param) => (
                  <div
                    key={param.id}
                    className="border border-slate-200 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{param.name}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                          Specification: {param.specification}
                        </p>
                      </div>
                      <StatusBadge status={param.testResult} />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-slate-600 uppercase font-medium">
                          Sample Size
                        </p>
                        <p className="text-slate-900 font-semibold mt-1">
                          {param.sampleSize}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 uppercase font-medium">
                          Actual Value
                        </p>
                        <p className="text-slate-900 font-semibold mt-1">
                          {param.actualValue}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-600 uppercase font-medium">
                          Status
                        </p>
                        <p className="text-slate-900 font-semibold mt-1">
                          {param.testResult}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Remarks */}
            {qc.remarks && (
              <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">Remarks</h2>
                <p className="text-slate-700 leading-relaxed">{qc.remarks}</p>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Summary</h3>

              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-2">Overall Result</p>
                  <StatusBadge status={qc.result} label={qc.result} />
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600 mb-3">Parameter Results</p>
                  <div className="space-y-2">
                    {qc.qcParams.map((param) => (
                      <div
                        key={param.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-slate-700">{param.name}</span>
                        <StatusBadge status={param.testResult} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600 mb-2">Pass Rate</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full w-full" />
                    </div>
                    <span className="text-sm font-bold text-slate-900">100%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg border border-green-200 p-4">
              <p className="text-sm text-slate-600 mb-2">Status</p>
              <p className="text-lg font-bold text-green-900">APPROVED</p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
