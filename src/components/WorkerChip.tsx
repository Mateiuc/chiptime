import { WorkerDisplay } from '@/lib/workers';

interface Props {
  worker: WorkerDisplay;
  size?: 'xs' | 'sm';
  className?: string;
  title?: string;
}

/**
 * Compact colored pill showing a worker's first name.
 * Each worker gets a deterministic hue from their user_id.
 */
export const WorkerChip = ({ worker, size = 'xs', className = '', title }: Props) => {
  const sizing =
    size === 'sm'
      ? 'text-xs px-2 py-0.5 gap-1.5'
      : 'text-[10px] px-1.5 py-[1px] gap-1';
  const dot = size === 'sm' ? 'h-1.5 w-1.5' : 'h-1.5 w-1.5';
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${sizing} ${className}`}
      style={{
        color: worker.color,
        backgroundColor: worker.bg,
        borderColor: worker.border,
      }}
      title={title || worker.fullName}
    >
      <span className={`rounded-full ${dot}`} style={{ backgroundColor: worker.color }} />
      {worker.firstName}
    </span>
  );
};
