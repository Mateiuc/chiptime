import { supabase } from '@/integrations/supabase/client';

// Module-level cache of the currently signed-in user id.
// Kept in sync via supabase.auth.onAuthStateChange below so any module can
// stamp `createdBy` without prop-drilling the auth context.
let _currentUserId: string | null = null;

supabase.auth.getUser().then(({ data }) => {
  _currentUserId = data.user?.id ?? null;
}).catch(() => {});

supabase.auth.onAuthStateChange((_event, session) => {
  _currentUserId = session?.user?.id ?? null;
});

export function getCurrentUserId(): string | null {
  return _currentUserId;
}
