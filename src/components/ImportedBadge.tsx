/**
 * Visible chip surfaced on every task that has a locked `importedSalary`
 * (i.e. came from an XLS import). Tells the user that parts added to the
 * task are not billed — the total stays at the imported value regardless
 * of subsequent edits.
 */
export function ImportedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={
        'inline-flex items-center rounded-md border-2 border-amber-600 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-200 dark:text-amber-950 ' +
        className
      }
      title="Imported from XLS — parts added to this task are not billed."
    >
      Imported · parts not billed
    </span>
  );
}
