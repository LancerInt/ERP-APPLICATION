import { useState, useCallback } from 'react';
import { UploadCloud, CheckCircle, XCircle, File } from 'lucide-react';

export default function FileUpload({
  onFilesSelected = () => {},
  acceptedFormats = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'],
  maxSizeMB = 10,
  multiple = false,
  isLoading = false,
  uploadProgress = 0,
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState([]);

  const validateFile = (file) => {
    const errors = [];

    // Check file size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      errors.push(`File size exceeds ${maxSizeMB}MB limit`);
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    const hasValidExtension = acceptedFormats.some((format) =>
      fileName.endsWith(format.toLowerCase())
    );
    if (!hasValidExtension) {
      errors.push(`File type not supported. Accepted: ${acceptedFormats.join(', ')}`);
    }

    return errors;
  };

  const handleFiles = (fileList) => {
    const newFiles = Array.from(fileList);
    const allErrors = [];
    const validFiles = [];

    newFiles.forEach((file) => {
      const fileErrors = validateFile(file);
      if (fileErrors.length > 0) {
        allErrors.push({ fileName: file.name, errors: fileErrors });
      } else {
        validFiles.push(file);
      }
    });

    setErrors(allErrors);

    if (validFiles.length > 0) {
      const filesToSet = multiple ? [...files, ...validFiles] : validFiles;
      setFiles(filesToSet);
      onFilesSelected(filesToSet);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleChange = (e) => {
    handleFiles(e.target.files);
  };

  const removeFile = (idx) => {
    const updatedFiles = files.filter((_, i) => i !== idx);
    setFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg'].includes(ext)) {
      return '🖼️';
    } else if (['pdf'].includes(ext)) {
      return '📄';
    } else if (['xls', 'xlsx'].includes(ext)) {
      return '📊';
    } else if (['doc', 'docx'].includes(ext)) {
      return '📝';
    }
    return '📎';
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 bg-slate-50'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <UploadCloud
            size={32}
            className={isDragActive ? 'text-blue-600' : 'text-slate-400'}
          />
          <div>
            <p className="font-semibold text-slate-900">
              Drag and drop your files here
            </p>
            <p className="text-sm text-slate-600 mt-1">
              or{' '}
              <label className="text-blue-600 cursor-pointer hover:underline">
                browse
                <input
                  type="file"
                  onChange={handleChange}
                  multiple={multiple}
                  accept={acceptedFormats.join(',')}
                  className="hidden"
                  disabled={isLoading}
                />
              </label>
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Max file size: {maxSizeMB}MB | Accepted: {acceptedFormats.join(', ')}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {isLoading && (
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Error messages */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, idx) => (
            <div
              key={idx}
              className="bg-red-50 border border-red-200 rounded-lg p-3"
            >
              <p className="text-sm font-medium text-red-900">{error.fileName}</p>
              {error.errors.map((err, errIdx) => (
                <p key={errIdx} className="text-sm text-red-700 mt-1">
                  • {err}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-900">Uploaded Files</h4>
          <div className="space-y-2">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-lg">{getFileIcon(file.name)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-600">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                >
                  <XCircle size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
