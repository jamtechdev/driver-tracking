import {
  getPrimaryRouteIdFromManifestJson,
  getRouteIdsFromManifestJson,
  parseManifestJsonEntries,
  resolveEffectiveRouteId,
} from '@/utils/manifestMap';

const SAMPLE_MANIFEST_JSON = JSON.stringify([
  { startTime: 445, endTime: 500, type: 'exception', id: -40 },
  { startTime: 500, endTime: 530, type: 'trip', id: 251173, routeID: 12937 },
  { startTime: 530, endTime: 600, type: 'trip', id: 251174, routeID: 12937 },
  { startTime: 600, endTime: 630, type: 'trip', id: 251175, routeID: 12518 },
]);

describe('manifestMap', () => {
  it('parseManifestJsonEntries returns trip and exception entries', () => {
    const entries = parseManifestJsonEntries(SAMPLE_MANIFEST_JSON);
    expect(entries).toHaveLength(4);
    expect(entries[1].type).toBe('trip');
  });

  it('getRouteIdsFromManifestJson returns unique trip route IDs in order', () => {
    expect(getRouteIdsFromManifestJson(SAMPLE_MANIFEST_JSON)).toEqual(['12937', '12518']);
  });

  it('getPrimaryRouteIdFromManifestJson picks the most frequent trip route', () => {
    expect(getPrimaryRouteIdFromManifestJson(SAMPLE_MANIFEST_JSON)).toBe('12937');
  });

  it('handles invalid manifestJson', () => {
    expect(parseManifestJsonEntries('not-json')).toEqual([]);
    expect(getPrimaryRouteIdFromManifestJson(null)).toBeNull();
    expect(getRouteIdsFromManifestJson('')).toEqual([]);
  });

  it('resolveEffectiveRouteId prefers selected route over manifest', () => {
    expect(resolveEffectiveRouteId('12518', SAMPLE_MANIFEST_JSON)).toBe('12518');
    expect(resolveEffectiveRouteId(null, SAMPLE_MANIFEST_JSON)).toBe('12937');
    expect(resolveEffectiveRouteId('0', SAMPLE_MANIFEST_JSON)).toBe('12937');
    expect(resolveEffectiveRouteId(null, null)).toBeNull();
  });
});
