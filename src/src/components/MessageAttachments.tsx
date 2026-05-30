import { useState } from 'react';
import { ImageOff, FileText, Download, Play } from 'lucide-react';
import ImageLightbox from './ImageLightbox';
import VideoLightbox from './VideoLightbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface MessageAttachmentsProps {
  attachments: string[];
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv', 'ogg', 'm4v', 'flv', 'wmv', '3gp'];

const isImageUrl = (url: string) => {
  try {
    const cleanUrl = url.split('?')[0];
    const pathname = new URL(cleanUrl).pathname.toLowerCase();
    return IMAGE_EXTENSIONS.some(ext => pathname.endsWith(`.${ext}`));
  } catch {
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg|ico)(\?|$)/i.test(url);
  }
};

const isVideoUrl = (url: string) => {
  try {
    const cleanUrl = url.split('?')[0];
    const pathname = new URL(cleanUrl).pathname.toLowerCase();
    if (VIDEO_EXTENSIONS.some(ext => pathname.endsWith(`.${ext}`))) return true;
    const originalName = new URL(url).searchParams.get('originalName') || '';
    return VIDEO_EXTENSIONS.some(ext => originalName.toLowerCase().endsWith(`.${ext}`));
  } catch {
    return /\.(mp4|webm|mov|avi|mkv|ogv|ogg|m4v|flv|wmv|3gp)(\?|$)/i.test(url);
  }
};

const getFileName = (url: string) => {
  try {
    const parsed = new URL(url);
    const originalName = parsed.searchParams.get('originalName');
    if (originalName) return originalName;
    const pathname = parsed.pathname;
    const name = pathname.split('/').pop() || 'file';
    return decodeURIComponent(name);
  } catch {
    return 'file';
  }
};

const formatFileSize = (url: string) => {
  try {
    const parsed = new URL(url);
    const sizeStr = parsed.searchParams.get('size');
    if (!sizeStr) return '';
    const bytes = parseInt(sizeStr, 10);
    if (isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } catch {
    return '';
  }
};

const MessageAttachments = ({ attachments }: MessageAttachmentsProps) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [videoLightboxUrl, setVideoLightboxUrl] = useState<string | null>(null);
  const [videoLightboxName, setVideoLightboxName] = useState<string>('');

  if (!attachments || attachments.length === 0) return null;

  const imageAttachments = attachments.filter((url, i) => isImageUrl(url) && !failedImages.has(i));
  const videoAttachments = attachments.filter(url => isVideoUrl(url));
  const fileAttachments = attachments.filter(url => !isImageUrl(url) && !isVideoUrl(url));
  const imageIndices = attachments.map((url, i) => isImageUrl(url) && !failedImages.has(i) ? i : -1).filter(i => i >= 0);

  const openLightbox = (index: number) => {
    const imageIndex = imageIndices.indexOf(index);
    setLightboxIndex(imageIndex >= 0 ? imageIndex : 0);
    setLightboxOpen(true);
  };

  const electronDownload = async (url: string, fileName: string) => {
    const api = (window as any).electronAPI;
    if (!api?.downloadUrlFile) return false;
    try {
      const result = await api.downloadUrlFile(url, fileName);
      if (result?.success) return true;
      if (result?.cancelled) return true;
      return false;
    } catch {
      return false;
    }
  };

  const handleDownload = async (url: string) => {
    const fileName = getFileName(url);
    const isElectron = !!(window as any).electronAPI?.downloadUrlFile;
    if (isElectron) {
      await electronDownload(url, fileName);
      return;
    }
    const skipWarning = localStorage.getItem('skip_download_warning') === 'true';
    if (skipWarning) {
      window.open(url, '_blank');
      return;
    }
    setDownloadUrl(url);
    setShowWarning(true);
  };

  const confirmDownload = () => {
    if (dontShowAgain) {
      localStorage.setItem('skip_download_warning', 'true');
    }
    if (downloadUrl) window.open(downloadUrl, '_blank');
    setShowWarning(false);
    setDownloadUrl(null);
    setDontShowAgain(false);
  };

  const gridClass =
    imageAttachments.length === 1 ? 'grid-cols-1 max-w-lg' :
    imageAttachments.length === 2 ? 'grid-cols-2 max-w-lg' :
    'grid-cols-2 max-w-lg';

  return (
    <>
      {imageAttachments.length > 0 && (
        <div className={`grid gap-1 mt-1.5 ${gridClass}`}>
          {attachments.map((url, i) => {
            if (!isImageUrl(url) || failedImages.has(i)) return null;
            return (
              <div
                key={i}
                className={`relative rounded-lg overflow-hidden cursor-pointer group border border-border/30 ${
                  imageAttachments.length === 3 && imageIndices.indexOf(i) === 0 ? 'col-span-2' : ''
                }`}
                onClick={() => openLightbox(i)}
              >
                {failedImages.has(i) ? (
                  <div className="w-full h-32 bg-secondary/50 flex items-center justify-center">
                    <ImageOff className="w-8 h-8 text-muted-foreground" />
                  </div>
                ) : (
                  <img
                    src={url}
                    alt=""
                    className="w-full h-auto max-h-96 object-contain transition-transform group-hover:scale-[1.02]"
                    loading="lazy"
                    onError={() => setFailedImages((prev) => new Set(prev).add(i))}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {videoAttachments.length > 0 && (
        <div className="flex flex-col gap-2 mt-1.5">
          {videoAttachments.map((url, i) => {
            const fileName = getFileName(url);
            const fileSize = formatFileSize(url);
            return (
              <div
                key={`video-${i}`}
                className="relative rounded-xl overflow-hidden cursor-pointer group border border-border/40 bg-black"
                style={{ maxWidth: '380px' }}
                onClick={() => { setVideoLightboxUrl(url); setVideoLightboxName(fileName); }}
              >
                <video
                  src={`${url}#t=0.1`}
                  preload="metadata"
                  muted
                  playsInline
                  className="w-full h-auto max-h-52 object-contain block"
                  style={{ pointerEvents: 'none' }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/45 transition-colors">
                  <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform shadow-lg">
                    <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-xs text-white/90 font-medium truncate">{fileName}</p>
                  {fileSize && <p className="text-[10px] text-white/55 mt-0.5">{fileSize}</p>}
                </div>
                <button
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); handleDownload(url); }}
                  title="İndir"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {fileAttachments.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-1.5">
          {fileAttachments.map((url, i) => {
            const fileName = getFileName(url);
            const fileSize = formatFileSize(url);
            return (
              <div key={`file-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-secondary/40 max-w-sm">
                <FileText className="w-8 h-8 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-primary font-medium truncate hover:underline cursor-pointer" onClick={() => handleDownload(url)}>
                    {fileName}
                  </p>
                  {fileSize && <p className="text-[11px] text-muted-foreground">{fileSize}</p>}
                </div>
                <button
                  onClick={() => handleDownload(url)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                  title="İndir"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ImageLightbox
        images={imageAttachments}
        currentIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onIndexChange={setLightboxIndex}
      />

      {videoLightboxUrl && (
        <VideoLightbox
          url={videoLightboxUrl}
          open={!!videoLightboxUrl}
          onOpenChange={(open) => { if (!open) setVideoLightboxUrl(null); }}
          fileName={videoLightboxName}
        />
      )}

      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dosya İndirme Uyarısı</AlertDialogTitle>
            <AlertDialogDescription>
              Bu dosya sakıncalı olabilir. İndirmek ister misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              id="dont-show"
              checked={dontShowAgain}
              onCheckedChange={(v) => setDontShowAgain(!!v)}
            />
            <label htmlFor="dont-show" className="text-sm text-muted-foreground cursor-pointer">
              Bir daha gösterme
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDownload}>İndir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MessageAttachments;
