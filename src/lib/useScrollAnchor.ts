import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'

/**
 * Keeps one element still on screen while content is inserted above it, like a chat loading older messages: the page
 * scrolls by exactly what was added, so nothing visibly moves and the new content waits above for the user to scroll
 * up to. Safari has no native scroll anchoring at the top of a page, so this does it by hand.
 *
 * `hold(el)` starts keeping `el` where it is now; `release()` stops. Whenever the page has scrolled since the last
 * correction (the user, or the browser's own anchoring), the element's new position is taken as the one to keep, so
 * this never fights a scroll.
 */
export function useScrollAnchor() {
  const anchor = useRef<{ el: Element; top: number; scrollY: number } | null>(null)
  const frame = useRef(0)

  const correct = () => {
    const a = anchor.current
    if (!a) return
    if (!a.el.isConnected) {
      anchor.current = null
      return
    }
    const top = a.el.getBoundingClientRect().top
    if (window.scrollY !== a.scrollY) {
      a.top = top
      a.scrollY = window.scrollY
      return
    }
    if (Math.abs(top - a.top) > 0.5) {
      window.scrollBy({ top: top - a.top, behavior: 'instant' })
      a.scrollY = window.scrollY
      // At the very top the page can't scroll up to undo a shrink above: keep the element where it ended up.
      a.top = a.el.getBoundingClientRect().top
    }
  }

  // After every render, before paint: undo any shift of the held element caused by content above it. Changes without
  // a render (the header shrinking as the page scrolls, a CSS transition) are caught every frame while held.
  useLayoutEffect(correct)
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  // Stable, so callers can list them as effect dependencies.
  return useMemo(
    () => ({
      hold: (el: Element | null) => {
        cancelAnimationFrame(frame.current)
        anchor.current = el ? { el, top: el.getBoundingClientRect().top, scrollY: window.scrollY } : null
        const tick = () => {
          correct()
          if (anchor.current) frame.current = requestAnimationFrame(tick)
        }
        if (anchor.current) frame.current = requestAnimationFrame(tick)
      },
      release: () => {
        cancelAnimationFrame(frame.current)
        anchor.current = null
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `correct` only reads refs.
    [],
  )
}
