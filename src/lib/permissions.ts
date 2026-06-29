import { useAuth } from '@/contexts/AuthContext';

/**
 * Permission helpers.
 *
 * Workers (role = 'member') may:
 *  - view all workspace data
 *  - add new clients/vehicles/tasks/schedule entries
 *  - start/pause/stop/work on ANY car
 *  - edit their OWN created items
 *
 * Admins/owners may edit anything.
 *
 * Admin-only UI:
 *  - global billing rates, payment methods, portal branding
 *  - mark Billed / mark Paid
 *  - edit/delete items they didn't create
 *  - invite management (already admin-only in WorkspaceManager)
 */
export const useIsAdmin = (): boolean => {
  const { workspace } = useAuth();
  return workspace?.role === 'owner' || workspace?.role === 'admin';
};

export const useCurrentUserId = (): string | undefined => {
  const { user } = useAuth();
  return user?.id;
};

/**
 * True if current user can edit/delete the given item.
 * Items without a createdBy field (legacy data) are editable by everyone
 * to avoid locking out old records.
 */
export const useCanEdit = (item: { createdBy?: string } | null | undefined): boolean => {
  const isAdmin = useIsAdmin();
  const uid = useCurrentUserId();
  if (!item) return true;
  if (isAdmin) return true;
  if (!item.createdBy) return true; // legacy item, no owner
  return item.createdBy === uid;
};
