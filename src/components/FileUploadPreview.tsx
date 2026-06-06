import { useEffect, useRef } from 'react';
import { X, FileText, Film, Music } from 'lucide-react';

interface FileUploadPreviewProps { files: File[]; onRemove: (index: number) => void; }

const getFileIcon = (file: File) => {
  if (file.type.startsWith('video/')) return <Film className="w-5 h-5 text-blue-400" />;
  if (file.type.startsWith('audio/')) return <Music className="w-5 h-5 text-emerald-400" />;
  return <FileText className="w-5 h-5 text-muted-foreground" />;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileUploadPreview = ({ files, onRemove }: FileUploadPreviewProps) => {
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    urlsRef.current = files.map(f => f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
    return () => {
      urlsRef.current.forEach(u => { if (u) URL.revokeObjectURL(u); });
    };
  }, [files]);

  if (files.length === 0) return null;

  return (
    <div className="px-4 py-3 border-t border-border/60 bg-card/40 backdrop-blur-sm">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-0.5">
        {files.length} dosya seçildi
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
        {files.map((file, i) => {
          const isImage = file.type.startsWith('image/');
          const objUrl = isImage ? URL.createObjectURL(file) : '';

          return (
            <div
              key={`${file.name}-${i}`}
              className="relative shrink-0 rounded-xl overflow-hidden border border-white/[0.08] bg-secondary/60 shadow-lg group"
              style={{ width: isImage ? 80 : 160, height: isImage ? 80 : 56 }}
            >
              {isImage ? (
                <img
                  src={objUrl}
                  alt={file.name}
                  className="w-full h-full object-cover"
                  onLoad={() => URL.revokeObjectURL(objUrl)}
                />
              ) : (
                <div className="w-full h-full flex items-center gap-2.5 px-3">
                  {getFileIcon(file)}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground truncate font-medium">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatSize(file.size)}</p>
                  </div>
                </div>
              )}

              {/* Hover overlay for image */}
              {isImage && (
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}

              {/* Remove button */}
              <button
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-destructive text-white flex items-center justify-center transition-colors shadow-md"
                title="Kaldır"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FileUploadPreview;
