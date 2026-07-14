/**
 * Loads MDTTURNBYTURN agency feature flag for Mapbox start-navigation.
 */

import { useEffect, useState } from 'react';
import { isMdtTurnByTurnEnabled } from '@/api/featureValues.api';
import { getMdtTurnByTurnTestOverride } from '@/config/mapbox.config';

export interface MdtTurnByTurnFeatureState {
  /** True only when API reports MDTTURNBYTURN = true (or manual test override). */
  enabled: boolean;
  loading: boolean;
  error: string | null;
  /** True when MDT_TURN_BY_TURN_TEST_OVERRIDE is active. */
  isTestOverride: boolean;
}

export function useMdtTurnByTurnFeature(
  agencyID: string | null | undefined,
): MdtTurnByTurnFeatureState {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTestOverride, setIsTestOverride] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const testOverride = getMdtTurnByTurnTestOverride();
    if (testOverride !== null) {
      setEnabled(testOverride);
      setLoading(false);
      setError(null);
      setIsTestOverride(true);
      return;
    }

    setIsTestOverride(false);

    if (!agencyID || String(agencyID).trim() === '') {
      setEnabled(false);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const on = await isMdtTurnByTurnEnabled(agencyID);
        if (!cancelled) {
          setEnabled(on);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setEnabled(false);
          setError(
            e instanceof Error ? e.message : 'Failed to load navigation feature flag',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agencyID]);

  return { enabled, loading, error, isTestOverride };
}
