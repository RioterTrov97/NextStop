import { useEffect } from 'react'

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0')

/** The colour seen through a black overlay of the given opacity. */
export function darken(color: string, overlayAlpha: number): string {
  const m = color.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return color
  const keep = 1 - overlayAlpha
  return `#${[m[1], m[2], m[3]].map((c) => hex(parseInt(c, 16) * keep)).join('')}`
}

const alphaOf = (bg: string) => {
  const parts = bg
    .match(/rgba?\(([^)]+)\)/)?.[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
  return parts && parts.length >= 4 ? Number(parts[3]) : parts ? 1 : 0
}

/**
 * Keeps the iPhone status bar dimmed along with the page while a sheet or dialog is open.
 *
 * iOS 26+ Safari (and home-screen apps) paint the status bar from the opaque sticky bar at the top of the page,
 * ignoring translucent overlays, so the dark backdrop alone left a bright orange strip above a dimmed page. While a
 * backdrop is open this marks <html data-overlay> and sets --ns-header-dim to the header colour as seen through it;
 * PageHeader then paints itself in that colour above the backdrop, which iOS samples. theme-color is updated too,
 * for browsers that still use it.
 */
export function useStatusBarFollowsBackdrops() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) return
    const base = meta.content
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        let keep = 1
        for (const el of document.querySelectorAll('[data-part="backdrop"][data-state="open"]')) {
          // The resting colour, not the current opacity: the fade-in has only just started when this runs.
          keep *= 1 - alphaOf(getComputedStyle(el).backgroundColor)
        }
        const next = keep < 1 ? darken(base, 1 - keep) : base
        if (meta.content !== next) meta.content = next
        const root = document.documentElement
        if (keep < 1) {
          root.style.setProperty('--ns-header-dim', next)
          root.dataset.overlay = 'open'
        } else delete root.dataset.overlay
      })
    }
    const observer = new MutationObserver(update)
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      meta.content = base
      delete document.documentElement.dataset.overlay
    }
  }, [])
}

const isInstalledIphoneApp = () =>
  (matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true) &&
  /iPhone|iPad|iPod/.test(navigator.userAgent)

/**
 * iOS 27 decides whether to blur the area under the status bar when the page is first composited, before React has
 * drawn the header, and doesn't look again until something forces a recomposite (developers saw the blur vanish
 * after opening a menu or pulling the page). Briefly showing an invisible full-screen layer after the app has drawn,
 * and whenever it comes back to the foreground, makes iOS re-check and see the opaque header and strip.
 */
export function repaintStatusBarArea() {
  if (!isInstalledIphoneApp()) return
  const nudge = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const veil = document.createElement('div')
        veil.setAttribute('aria-hidden', 'true')
        veil.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:rgba(255,255,255,0.01);pointer-events:none'
        document.body.appendChild(veil)
        setTimeout(() => veil.remove(), 400)
      }),
    )
  if (document.readyState === 'complete') nudge()
  else window.addEventListener('load', nudge, { once: true })
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && nudge())
}
