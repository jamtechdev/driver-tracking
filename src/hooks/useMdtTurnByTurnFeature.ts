/**
 * Loads MDTTURNBYTURN agency feature flag for Mapbox start-navigation.
 *
 * Production path:
 *   POST .../index.php
 *   app_id=DR3, key=..., controller=agency, action=featureValues, agencyID=<login agency>
 *   → find name MDTTURNBYTURN, use featureValue true/false
 *
 * Manual QA: set MDT_TURN_BY_TURN_TEST_OVERRIDE in mapbox.config.ts
 */

import { useEffect, useState } from 'react';
import {
  isMdtTurnByTurnEnabled,
  isValidAgencyIdForFeatures,
} from '@/api/featureValues.api';
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
      if (__DEV__) {
        console.warn(
          `[MDTTURNBYTURN] TEST OVERRIDE active → ${testOverride}. Comment out MDT_TURN_BY_TURN_TEST_OVERRIDE for real API.`,
        );
      }
      setEnabled(testOverride);
      setLoading(false);
      setError(null);
      setIsTestOverride(true);
      return;
    }

    setIsTestOverride(false);

    if (!isValidAgencyIdForFeatures(agencyID)) {
      // Wait for login agency — keep disabled, not a hard error
      setEnabled(false);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const on = await isMdtTurnByTurnEnabled(agencyID as string | number);
        if (!cancelled) {
          setEnabled(on);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          // Fail closed: no turn-by-turn if flag cannot be loaded
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
