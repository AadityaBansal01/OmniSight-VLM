/**
 * Shared formatting utilities across OmniSight VLM.
 */

/**
 * Formats a confidence value safely into a clean 0-100 percentage.
 *
 * The backend (see app/ai/vector_store.py) always returns confidence
 * already scaled to 0-100 — never a bare 0-1 ratio. This does NOT try to
 * auto-detect ratio vs. percentage: a genuine low-confidence match like
 * 0.8 (meaning 0.8%) must stay "1%", not get misread as an 80% match.
 */
export function formatConfidence(val) {
  if (val == null || isNaN(val)) return '0%';
  const num = typeof val === 'number' ? val : parseFloat(val) || 0;
  const clamped = Math.min(100, Math.max(0, Math.round(num)));
  return `${clamped}%`;
}

/**
 * Formats seconds into MM:SS.
 */
export function formatTime(secs) {
  if (secs == null || isNaN(secs) || secs < 0) return '00:00';
  const mins = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Formats seconds with millisecond precision: MM:SS.s
 */
export function formatTimePrecise(secs) {
  if (secs == null || isNaN(secs) || secs < 0) return '00:00.0';
  const mins = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(1);
  return `${mins.toString().padStart(2, '0')}:${parseFloat(s) < 10 ? '0' : ''}${s}`;
}
