/** Request a single best-effort pulse without affecting the triggering action. */
export function pulseHapticFeedback(): void {
  if (typeof navigator === 'undefined') return;

  try {
    if (typeof navigator.vibrate === 'function' && navigator.vibrate(15)) return;
  } catch {
    // Feedback is optional; denied vibration must not interrupt the action.
  }

  if (typeof document === 'undefined' || !document.body) return;
  const input = document.createElement('input');
  if (!('switch' in input)) return;

  // Safari exposes switch feedback rather than the Vibration API. A label click
  // activates it within the originating gesture without focusing a visible field.
  const label = document.createElement('label');
  label.style.display = 'none';
  label.setAttribute('aria-hidden', 'true');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  input.style.appearance = 'auto';
  label.appendChild(input);

  try {
    document.body.appendChild(label);
    label.click();
  } catch {
    // Browser or OS policy may suppress haptics; the clear has already succeeded.
  } finally {
    label.remove();
  }
}
