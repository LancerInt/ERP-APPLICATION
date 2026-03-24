import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import StatusBadge from '../../../components/common/StatusBadge';

const mockWODetail = {
  id: 'WO-001',
  woNumber: 'WO-2024-001',
  product: 'Steel Assembly Part A',
  productId: 'P001',
  bom: 'BOM-001',
  quantity: 500,
  stage: 'IN_PROGRESS',
  completedPercentage: 65,
  startDate: '2024-03-10',
  targetDate: '2024-03-25',
  actualStart: '2024-03-10',
  notes: 'Standard production run',
  stageTimeline: [
    { stage: 'RAW_MATERIAL_ISSUED', status: 'COMPLETED', date: '2024-03-10' },
    { stage: 'CUTTING', status: 'COMPLETED', date: '2024-03-12' },
    { stage: 'WELDING', status: 'IN_PROGRESS', date: '2024-03-15' },
    { stage: 'FINISHING', status: 'PENDING', date: null },
    { stage: 'QUALITY_CHECK', status: 'PENDING', date: null },
    { stage: 'PACKAGING', status: 'PENDING', date: null },
  ],
};

export default function WorkOrderDetail() {
  const { id } = useParams();
  const [wo, setWO] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setWO(mockWODetail);
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
    { label: 'Production', href: '/production/work-orders' },
    { label: 'Work Orders', href: '/production/work-orders' },
    { label: wo.woNumber },
  ];

  const getStageColor = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600';
      case 'IN_PROGRESS':
        return 'text-blue-600';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-6xl space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{wo.woNumber}</h1>
            <div className="flex items-center gap-4 mt-3">
              <StatusBadge status={wo.stage} />
              <p className="text-slate-600">
                Created on {wo.startDate ? new Date(wo.startDate).toLocaleDateString() : "-"}
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
                  <p className="text-sm text-slate-600 font-medium">Product</p>
                  <p className="text-slate-900 font-semibold mt-1">{wo.product}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">BOM</p>
                  <p className="text-slate-900 font-semibold mt-1">{wo.bom}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Quantity</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {wo.quantity} units
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-600 font-medium">Target Date</p>
                  <p className="text-slate-900 font-semibold mt-1">
                    {wo.targetDate ? new Date(wo.targetDate).toLocaleDateString() : "-"}
                  </p>
                </div>
              </div>

              {wo.notes && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <p className="text-sm text-slate-600 font-medium">Notes</p>
                  <p className="text-slate-900 mt-2">{wo.notes}</p>
                </div>
              )}
            </div>

            {/* Stage Timeline */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">
                Production Timeline
              </h2>

              <div className="space-y-6">
                {wo.stageTimeline.map((step, idx) => (
                  <div key={idx} className="flex gap-4">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                          step.status === 'COMPLETED'
                            ? 'border-green-600 bg-green-50'
                            : step.status === 'IN_PROGRESS'
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-300 bg-slate-50'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            step.status === 'COMPLETED'
                              ? 'bg-green-600'
                              : step.status === 'IN_PROGRESS'
                              ? 'bg-blue-600'
                              : 'bg-slate-300'
                          }`}
                        />
                      </div>
                      {idx < wo.stageTimeline.length - 1 && (
                        <div
                          className={`w-1 h-16 ${
                            step.status === 'COMPLETED'
                              ? 'bg-green-600'
                              : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </div>

                    {/* Step details */}
                    <div className="pb-4">
                      <div className="font-semibold text-slate-900">
                        {step.stage.replace(/_/g, ' ')}
                      </div>
                      <StatusBadge status={step.status} className="mt-2" />
                      {step.date && (
                        <div className="text-xs text-slate-500 mt-2">
                          {step.date ? new Date(step.date).toLocaleDateString() : "-"}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Progress Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Progress</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-600 font-medium">Overall</p>
                    <p className="text-lg font-bold text-slate-900">
                      {wo.completedPercentage}%
                    </p>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all"
                      style={{ width: `${wo.completedPercentage}%` }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-600 font-medium mb-3">
                    Stage Breakdown
                  </p>
                  <div className="space-y-2">
                    {wo.stageTimeline.map((step, idx) => {
                      const completedCount = wo.stageTimeline.filter(
                        (s) => s.status === 'COMPLETED'
                      ).length;
                      const percentage = Math.round(
                        (completedCount / wo.stageTimeline.length) * 100
                      );

                      return (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              step.status === 'COMPLETED'
                                ? 'bg-green-600'
                                : step.status === 'IN_PROGRESS'
                                ? 'bg-blue-600'
                                : 'bg-slate-300'
                            }`}
                          />
                          <span className="text-slate-700">
                            {step.stage.replace(/_/g, ' ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <p className="text-sm text-slate-600 mb-2">Completed Stages</p>
              <p className="text-2xl font-bold text-blue-900">
                {wo.stageTimeline.filter((s) => s.status === 'COMPLETED').length}/
                {wo.stageTimeline.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
