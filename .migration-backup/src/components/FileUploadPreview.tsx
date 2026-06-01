import { X, FileText, Image } from 'lucide-react';

interface FileUploadPreviewProps { files: File[]; onRemove: (index: number) => void; }

const FileUploadPreview = ({ files, onRemove }: FileUploadPreviewProps) => {
  if (files.length === 0) return null;

  return (
    <div className="px-4 py-2 border-t border-border flex gap-2 overflow-x-auto">
      {files.map((file, i) => {
        const isImage = file.type.startsWith('image/');
        return (
          <div key={i} className="relative shrink-0 rounded-lg border border-border bg-card p-2 flex items-center gap-2 max-w-[200px]">
            {isImage ? <Image className="w-4 h-4 text-muted-foreground shrink-0" /> : <FileText className="w-4 h-4 text-muted-foreground shrink-0" />}
            <span className="text-xs text-foreground truncate">{file.name}</span>
            <button onClick={() => onRemove(i)} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default FileUploadPreview;