import { Skeleton } from '@/components/ui/skeleton';

const MessageSkeleton = ({ grouped = false }: { grouped?: boolean }) => (
  <div className={`flex gap-3 px-4 ${grouped ? 'py-px mt-0.5' : 'py-1 mt-4'}`}>
    {grouped ? (
      <div className="w-10 shrink-0" />
    ) : (
      <Skeleton className="w-10 h-10 rounded-full shrink-0 mt-0.5" />
    )}
    <div className="flex-1 space-y-1.5 pt-0.5 min-w-0">
      {!grouped && (
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-2.5 w-10 rounded opacity-60" />
        </div>
      )}
      <Skeleton className="h-3.5 rounded" style={{ width: grouped ? '62%' : '88%', maxWidth: grouped ? 200 : 320 }} />
      {!grouped && <Skeleton className="h-3.5 rounded" style={{ width: '52%', maxWidth: 200 }} />}
    </div>
  </div>
);

export const MessageSkeletonList = ({ count = 8 }: { count?: number }) => (
  <div className="flex flex-col py-2">
    {Array.from({ length: count }, (_, i) => (
      <MessageSkeleton key={i} grouped={i % 3 !== 0} />
    ))}
  </div>
);

export default MessageSkeleton;
