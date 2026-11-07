/**
 * Cross-platform haptic feedback for PWAs.
 *
 * iOS 18+: programmatically clicking a hidden `<input type="checkbox" switch>` causes
 * WebKit to fire its native Taptic Engine response — the same feel as toggling a system
 * toggle switch. This must be called synchronously inside a user-gesture handler (e.g.
 * touchmove / touchend); async calls are silently ignored by the browser.
 *
 * Android / Chrome: navigator.vibrate() with a short duration.
 *
 * Both platforms do nothing (no throw) on older OS versions that don't support the APIs.
 */

let iosSwitch: HTMLInputElement | null = null

function getIosSwitch(): HTMLInputElement {
  if (!iosSwitch) {
    const el = document.createElement('input')
    el.type = 'checkbox'
    el.setAttribute('switch', '') // WebKit-only boolean attribute; ignored elsewhere
    Object.assign(el.style, {
      position: 'fixed',
      opacity: '0',
      pointerEvents: 'none',
      width: '0',
      height: '0',
      top: '-9999px',
      left: '-9999px',
    })
    document.body.appendChild(el)
    iosSwitch = el
  }
  return iosSwitch
}

/** Durations (ms) for each intensity level on Android. */
const ANDROID_MS = { light: 10, medium: 20, heavy: 40 } as const

/**
 * Fire a haptic impulse.
 * Safe to call unconditionally — silently no-ops on unsupported platforms.
 * Must be called synchronously inside a user-gesture handler.
 */
export function haptic(intensity: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (typeof window === 'undefined') return
  try {
    // iOS Safari (18+): toggle the hidden switch to fire the system haptic.
    getIosSwitch().click()
  } catch {
    // ignore — element creation may fail in some sandboxed environments
  }
  // Android / Chromium: standard Vibration API.
  navigator.vibrate?.(ANDROID_MS[intensity])
}
