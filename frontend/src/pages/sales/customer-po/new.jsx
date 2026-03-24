import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../../../components/layout/MainLayout';
import FormBuilder from '../../../components/common/FormBuilder';
import FileUpload from '../../../components/common/FileUpload';
import useLookup from '../../../hooks/useLookup.js';

export default function UploadCustomerPO() {
  const navigate = useNavigate();
  const { options: customerOptions } = useLookup('/api/customers/');
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    customer: '',
    referenceNumber: '',
    notes: '',
  });

  const [parsedData, setParsedData] = useState(null);

  const formFields = [
    {
      section: 'Customer Info',
      name: 'customer',
      label: 'Customer',
      type: 'select',
      required: true,
      options: [{ value: '', label: 'Select Customer...' }, ...customerOptions],
    },
    {
      section: 'Customer Info',
      name: 'referenceNumber',
      label: 'Reference Number (Optional)',
      type: 'text',
      placeholder: 'PO reference or order number...',
    },
    {
      section: 'Customer Info',
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      placeholder: 'Additional information about this PO...',
    },
  ];

  const handleFilesSelected = (selectedFiles) => {
    setFiles(selectedFiles);
  };

  const handleFormSubmit = async (data) => {
    if (files.length === 0) {
      alert('Please upload at least one file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate file upload
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        setUploadProgress(i);
      }

      // Simulate AI parsing
      setParsedData({
        status: 'COMPLETED',
        poNumber: 'CPO-2024-001',
        items: [
          {
            id: 1,
            description: 'Product A',
            quantity: 100,
            unit: 'pieces',
            rate: 500,
          },
          {
            id: 2,
            description: 'Product B',
            quantity: 50,
            unit: 'boxes',
            rate: 1000,
          },
        ],
        totalAmount: 100000,
        deliveryDate: '2024-04-30',
      });

      alert('File uploaded and parsed successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Error uploading file');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const breadcrumbs = [
    { label: 'Sales', href: '/sales/customer-po' },
    { label: 'Customer PO', href: '/sales/customer-po' },
    { label: 'Upload' },
  ];

  return (
    <MainLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Upload Customer PO</h1>
          <p className="text-slate-600 mt-2">Upload and AI-parse customer purchase orders</p>
        </div>

        <div className="space-y-8">
          {/* Upload Form */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Customer Information</h2>
            <FormBuilder
              fields={formFields}
              initialData={formData}
              onSubmit={handleFormSubmit}
              onCancel={() => navigate('/sales/customer-po')}
              submitLabel="Upload & Parse"
              groupBySection={true}
              isLoading={isUploading}
            />
          </div>

          {/* File Upload Section */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">Upload File</h2>
            <FileUpload
              onFilesSelected={handleFilesSelected}
              acceptedFormats={['.pdf', '.jpg', '.jpeg', '.png']}
              maxSizeMB={25}
              multiple={false}
              isLoading={isUploading}
              uploadProgress={uploadProgress}
            />
          </div>

          {/* Parsed Data Preview */}
          {parsedData && (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-900 mb-6">
                Parsed Data Preview
              </h2>

              {parsedData.status === 'COMPLETED' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-slate-600 font-medium">PO Number</p>
                      <p className="text-lg font-bold text-slate-900 mt-1">
                        {parsedData.poNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 font-medium">Delivery Date</p>
                      <p className="text-lg font-bold text-slate-900 mt-1">
                        {parsedData.deliveryDate ? new Date(parsedData.deliveryDate).toLocaleDateString() : "-"}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-slate-600 font-medium mb-4">Items</p>
                    <div className="space-y-3">
                      {parsedData.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                        >
                          <div>
                            <p className="font-medium text-slate-900">
                              {item.description}
                            </p>
                            <p className="text-sm text-slate-600 mt-1">
                              {item.quantity} {item.unit} × ₹{item.rate} = ₹
                              {(item.quantity * item.rate).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-slate-600">Total Amount</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      ₹{parsedData.totalAmount.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        navigate('/sales/customer-po', {
                          state: { parsedData },
                        })
                      }
                      className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Create Sales Order
                    </button>
                    <button
                      onClick={() => setParsedData(null)}
                      className="flex-1 px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                    >
                      Upload Another
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-600">Parsing in progress...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
