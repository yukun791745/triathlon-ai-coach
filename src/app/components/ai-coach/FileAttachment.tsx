import React from 'react';
import { X, FileText, File } from 'lucide-react';

export interface AttachedFile {
  id: string;
  file: File;
  type: 'image' | 'pdf' | 'csv' | 'txt' | 'other';
  preview?: string;
  size: number;
  name: string;
}

interface FileAttachmentProps {
  files: AttachedFile[];
  onRemove: (id: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function FileAttachment({ files, onRemove }: FileAttachmentProps) {
  if (files.length === 0) return null;

  return (
    <div className="px-4 pb-2">
      <div className="flex gap-2 flex-wrap">
        {files.map((file) => (
          <div key={file.id} className="relative">
            {file.type === 'image' && file.preview ? (
              // Image Preview
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                <img
                  src={file.preview}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => onRemove(file.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-700 rounded-full flex items-center justify-center hover:bg-slate-800 transition-colors"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              // File Card
              <div className="relative bg-white border border-slate-200 rounded-lg px-3 py-2.5 pr-8 shadow-sm min-w-[140px]">
                <div className="flex items-center gap-2">
                  {file.type === 'pdf' && <FileText className="w-4 h-4 text-rose-500" />}
                  {file.type === 'csv' && <File className="w-4 h-4 text-indigo-500" />}
                  {file.type === 'txt' && <FileText className="w-4 h-4 text-slate-500" />}
                  {file.type === 'other' && <File className="w-4 h-4 text-slate-400" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 font-medium truncate">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => onRemove(file.id)}
                  className="absolute top-1.5 right-1.5 w-4 h-4 bg-slate-200 rounded-full flex items-center justify-center hover:bg-slate-300 transition-colors"
                >
                  <X className="w-2.5 h-2.5 text-slate-600" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
