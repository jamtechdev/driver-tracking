/**
 * Pure helpers for rejecting sticky Mapbox stop banners mid-trip.
 * Kept separate so unit tests can cover Route Start / past-stop regressions.
 *
 * IMPORTANT: Do NOT treat ordinary street / place titles as stale — Mapbox often
 * puts only the street name in primary text and left/right in the modifier.
 */

export function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function textMentionsStop(text: string, stopName: string): boolean {
  const hay = normalizeNameKey(text);
  const needle = normalizeNameKey(stopName);
  if (!hay || !needle || needle.length < 3) return false;
  return hay.includes(needle);
}

export function isStaleMapboxStopBanner(
  text: string | undefined,
  currentStopName: string,
  completedStopNames: string[],
): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  const lower = t.toLowerCase();

  // Arrive / destination banners frozen on an old waypoint (e.g. "You will arrive at Route Start")
  const looksLikeArrival =
    /\barriv(e|ed|ing)\b/.test(lower) ||
    /\byour destination\b/.test(lower) ||
    /\bwaypoint\b/.test(lower);

  if (looksLikeArrival) {
    // Allow only when it clearly names the *current* HUD stop
    return !textMentionsStop(t, currentStopName);
  }

  // Reject copy that names an already-passed stop (and not the current one)
  if (completedStopNames.some((name) => textMentionsStop(t, name))) {
    if (!textMentionsStop(t, currentStopName)) return true;
  }

  return false;
}
