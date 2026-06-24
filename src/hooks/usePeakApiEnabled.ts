import { useSession } from '@/context/SessionContext';

/**
 * Peak Transit APIs may run only after login (or restored session) has an agencyId.
 */
export function usePeakApiEnabled(): boolean {
  const { isReady, isLoggedIn, agencyId } = useSession();
  return isReady && isLoggedIn && !!agencyId;
}

/**
 * Polling / secondary APIs that should start only after an interactive login this session.
 */
export function useAfterLoginApiEnabled(): boolean {
  const { isReady, isLoggedIn, agencyId, bootstrapKey } = useSession();
  return isReady && isLoggedIn && !!agencyId && bootstrapKey > 0;
}
