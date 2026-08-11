'use client';

import { useRef, useState } from 'react';
import {
  Upload,
  Image,
  Video,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

interface FileUploadProps {
  type: 'image' | 'video';
  accept?: string;
  label: string;
  description?: string;
  maxSize?: number; // in MB
  onFileSelect: (file: File) => void;
  uploading?: boolean;
  uploaded?: boolean;
  error?: string | null;
  preview?: string | null;
  url?: string | null;
  className?: string;
}

export default function FileUpload({
  type,
  accept,
  label,
  description,
  maxSize = type === 'video' ? 2048 : 10,
  onFileSelect,
  uploading = false,
  uploaded = false,
  error = null,
  preview = null,
  url = null,
  className = '',
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File size must be less than ${maxSize}MB`);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Validate file type
    if (type === 'video' && !file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }
    if (type === 'image' && !file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      alert(`File size must be less than ${maxSize}MB`);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  };

  const getIcon = () => {
    if (type === 'video') return Video;
    return Image;
  };

  const Icon = getIcon();

  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
          uploaded
            ? 'border-success bg-success-container/10'
            : error
            ? 'border-error bg-error-container/10'
            : dragActive
            ? 'border-primary bg-primary-container/10'
            : 'border-surface-variant hover:border-primary hover:bg-surface-container'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept || (type === 'video' ? 'video/*' : 'image/*')}
          onChange={handleFileChange}
          className="hidden"
        />

        {preview ? (
          <div className="relative">
            {type === 'image' ? (
              <img
                src={preview}
                alt="Preview"
                className="w-full h-48 object-cover rounded-lg"
              />
            ) : (
              <div className="py-8">
                <Icon className="w-12 h-12 mx-auto text-on-surface-variant mb-2" />
                <p className="text-sm text-on-surface-variant truncate">
                  {selectedFile?.name || 'Video file'}
                </p>
                {selectedFile && (
                  <p className="text-xs text-on-surface-variant mt-1">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                )}
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            )}
            {uploaded && (
              <div className="absolute top-2 right-2">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
            )}
          </div>
        ) : (
          <div className="py-8">
            <Icon className="w-12 h-12 mx-auto text-on-surface-variant mb-2" />
            <p className="text-sm text-on-surface-variant">
              {dragActive ? 'Drop file here' : `Click to upload ${type}`}
            </p>
            {description && (
              <p className="text-xs text-on-surface-variant mt-1">{description}</p>
            )}
            <p className="text-xs text-on-surface-variant mt-1">
              Max size: {maxSize}MB
            </p>
          </div>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 mt-2">
          <AlertCircle className="w-4 h-4 text-error" />
          <p className="text-xs text-error">{error}</p>
        </div>
      )}
      {url && !error && (
        <div className="flex items-center gap-2 mt-2">
          <CheckCircle className="w-4 h-4 text-success" />
          <p className="text-xs text-success truncate">Uploaded successfully</p>
        </div>
      )}
    </div>
  );
}
