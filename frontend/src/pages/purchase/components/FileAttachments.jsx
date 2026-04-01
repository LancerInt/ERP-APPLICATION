import { useState, useEffect, useRef } from 'react';
import { Paperclip, Upload, Trash2, FileText, Image, File, Loader2 } from 'lucide-react';
import apiClient from '../../../utils/api.js';
import toast from 'react-hot-toast';

const FILE_ICONS = {
  pdf: FileText, jpg: Image, jpeg: Image, png: Image,
  docx: FileText, xlsx: FileText, doc: FileText, xls: FileText,
};

function getFileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const Icon = FILE_ICONS[ext] || File;
  return Icon;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Reusable file attachment component for all purchase module pages.
 *
 * Props:
 *   module    - 'PR' | 'RFQ' | 'QUOTE' | 'PO' | 'RECEIPT' | 'BILL' | etc.
 *   recordId  - UUID of the record (null for new records — files upload after save)
 *   readOnly  - if true, only show existing files, no upload/delete
 */
export default function FileAttachments({ module, recordId, readOnly = false, onPendingChange }) {
  const [files, setFiles] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]); // files to upload (for new records)
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef(null);

  // Load existing attachments
  useEffect(() => {
    if (!recordId) return;
    setIsLoading(true);
    apiClient.get('/api/purchase/attachments/', { params: { module, record_id: recordId } })
      .then(res => setFiles(res.data?.results || res.data || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [module, recordId]);

  // Upload files
  const handleFileSelect = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    if (!recordId) {
      // No record yet — store locally for later upload
      setPendingFiles(prev => {
        const updated = [...prev, ...selected];
        onPendingChange?.(updated);
        return updated;
      });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    let uploaded = 0;
    for (const file of selected) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('module', module);
        fd.append('record_id', recordId);
        const res = await apiClient.post('/api/purchase/attachments/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setFiles(prev => [res.data, ...prev]);
        uploaded++;
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    if (uploaded > 0) toast.success(`${uploaded} file(s) uploaded`);
    setIsUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  // Delete
  const handleDelete = async (attachment) => {
    if (!window.confirm(`Delete ${attachment.file_name}?`)) return;
    try {
      await apiClient.delete(`/api/purchase/attachments/${attachment.id}/`);
      setFiles(prev => prev.filter(f => f.id !== attachment.id));
      toast.success('File deleted');
    } catch {
      toast.error('Failed to delete file');
    }
  };

  // Remove pending file
  const removePending = (idx) => {
    setPendingFiles(prev => {
      const updated = prev.filter((_, i) => i !== idx);
      onPendingChange?.(updated);
      return updated;
    });
  };

  const allFiles = [
    ...files.map(f => ({ ...f, source: 'server' })),
    ...pendingFiles.map((f, i) => ({ id: `pending-${i}`, file_name: f.name, file_size: f.size, source: 'pending', rawFile: f })),
  ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paperclip size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">
            Attachments {allFiles.length > 0 && `(${allFiles.length})`}
          </h3>
        </div>
        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.doc,.xls,.csv"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition disabled:opacity-50"
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {isUploading ? 'Uploading...' : 'Upload Files'}
            </button>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </div>
      ) : allFiles.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No attachments</p>
      ) : (
        <div className="space-y-2">
          {allFiles.map((file) => {
            const Icon = getFileIcon(file.file_name);
            const isPending = file.source === 'pending';
            return (
              <div
                key={file.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm ${
                  isPending ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <Icon size={16} className={isPending ? 'text-amber-500' : 'text-slate-500'} />
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => window.open(isPending ? URL.createObjectURL(file.rawFile) : file.file, '_blank')}>
                  <p className="text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline truncate">{file.file_name}</p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(file.file_size)}
                    {isPending && ' — pending upload'}
                    {file.uploaded_by_name && ` — ${file.uploaded_by_name}`}
                  </p>
                </div>
                {(file.file || isPending) && (
                  <a
                    href={isPending ? URL.createObjectURL(file.rawFile) : file.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary-600 hover:underline flex-shrink-0"
                  >
                    View
                  </a>
                )}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => isPending ? removePending(pendingFiles.indexOf(pendingFiles.find((_, i) => `pending-${i}` === file.id))) : handleDelete(file)}
                    className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Upload pending files for a newly created record.
 * Call this after saving the record and getting the ID.
 */
export async function uploadPendingFiles(module, recordId, pendingFiles) {
  let uploaded = 0;
  for (const file of pendingFiles) {
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('module', module);
      fd.append('record_id', recordId);
      await apiClient.post('/api/purchase/attachments/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      uploaded++;
    } catch {
      console.error(`Failed to upload ${file.name}`);
    }
  }
  return uploaded;
}
