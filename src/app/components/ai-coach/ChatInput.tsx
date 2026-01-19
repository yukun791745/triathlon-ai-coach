import React from 'react';
import { Paperclip, Send, Plus } from 'lucide-react';
import type { AttachedFile } from './FileAttachment';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  attachedFiles: AttachedFile[];
  onFileSelect: (files: FileList) => void;
  isUploading?: boolean;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  attachedFiles,
  onFileSelect,
  isUploading = false,
  disabled = false,
}: ChatInputProps) {
  const [showAttachMenu, setShowAttachMenu] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files);
      setShowAttachMenu(false);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canSend = (value.trim() || attachedFiles.length > 0) && !disabled;

  return (
    <div className="px-4 pb-3">
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 shadow-sm relative">
        {/* File Attachment Button with Menu */}
        <div className="relative">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            disabled={isUploading}
          >
            {isUploading ? (
              <div className="w-4.5 h-4.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Paperclip className="w-4.5 h-4.5" />
            )}
          </button>

          {/* Attachment Menu */}
          {showAttachMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowAttachMenu(false)}
              />
              <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[160px] z-20">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp,.pdf,.csv,.txt"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>ファイルを選ぶ</span>
                </label>
              </div>
            </>
          )}
        </div>

        <input
          type="text"
          placeholder="どんなことでも相談してください"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
          disabled={disabled}
        />
        <button
          onClick={onSend}
          className="text-rose-400 hover:text-rose-500 transition-colors disabled:opacity-40"
          disabled={!canSend}
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}
