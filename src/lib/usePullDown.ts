import { useEffect, useRef } from 'react'
import { haptic } from './haptic'

/** iOS-style rubber band: the further you drag, the harder it resists, and it never passes `dim`. */
export const rubberBand = (x: number, dim = 160, c = 0.8) => (1 - 1 / ((x * c) / dim + 1)) * dim

const ACTIVATE = 8

interface Options {
  enabled: boolean
  /** Rubber-banded distance (px) at which letting go counts as a request. */
  threshold?: number
  onRelease: () => void
}

/**
 * Pull-to-reveal for the top of the page, with touch or mouse. The element in `ref` follows the finger with rubber-band
 * resistance and springs back on release; the label in `labelRef` fades in as it moves. Letting go before the threshold,
 * dragging back up, pressing Escape or a cancelled touch all cancel without triggering anything.
 *
 * Everything during the drag is written straight to the DOM (one write per frame, no React renders), and the
 * `data-armed` attribute on the label lets CSS swap its text, so a long list below never re-renders mid-gesture. The
 * release callback waits for the spring-back to finish for the same reason.
 */
export function usePullDown({ enabled, threshold = 72, onRelease }: Options) {
  const ref = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const release = useRef(onRelease)
  useEffect(() => {
    release.current = onRelease
  })

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let startY: number | undefined
    let dragging = false
    let distance = 0
    let mouse = false
    let frame = 0
    let pending = 0
    let armed = false
    const SPRING = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)'
    const paint = (d: number, animate: boolean) => {
      el.style.transition = animate && !reduce ? SPRING : 'none'
      el.style.transform = d ? `translate3d(0, ${d}px, 0)` : ''
      const label = labelRef.current
      if (label) {
        label.style.transition = animate ? 'opacity 0.25s' : 'none'
        label.style.opacity = String(Math.min(1, d / (threshold * 0.8)))
        const next = d >= threshold
        if (next !== armed) {
          armed = next
          label.dataset.armed = next ? 'true' : 'false'
        }
      }
    }
    // One write per frame however often the finger reports.
    const apply = (d: number) => {
      pending = d
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0
          paint(pending, false)
        })
      }
    }
    const begin = (y: number, target: EventTarget | null, isMouse: boolean) => {
      const t = target as Element | null
      if (window.scrollY > 0 || t?.closest?.('[data-no-drag], [role="dialog"], input, textarea, select')) return
      startY = y
      mouse = isMouse
      dragging = false
      // Don't set willChange yet — defer until we commit to a pull gesture so the
      // compositing layer promotion doesn't interfere with the browser's scroll decision.
    }
    const move = (y: number, e: Event) => {
      if (startY === undefined) return
      const dy = y - startY
      if (!dragging) {
        // Upwards or already scrolled: abandon and let the browser handle it normally.
        if (dy < -4 || window.scrollY > 0) {
          startY = undefined
          return
        }
        // Not yet enough movement to commit to a pull gesture — let it through so the
        // browser can still start a scroll if the user is just scrolling down.
        if (dy <= ACTIVATE) return
        // Committed to a pull-down. Promote the layer now and steal from the next event.
        dragging = true
        el.style.willChange = 'transform'
        // The card under the finger would otherwise show its pressed (shrunk) state for the whole drag and look glitchy.
        el.style.pointerEvents = 'none'
        // A mouse drag (a desktop window, or Chrome's phone view) would otherwise select text and drag card contents along.
        document.documentElement.style.userSelect = 'none'
        document.documentElement.style.setProperty('-webkit-user-select', 'none')
        window.getSelection()?.removeAllRanges()
        return
      }
      if (e.cancelable) e.preventDefault()
      // Measured from where the finger first went down, less the activation slack, so the page starts moving from zero.
      distance = rubberBand(Math.max(0, dy - ACTIVATE))
      // Fire the threshold-crossing haptic synchronously in the touch event (iOS requires
      // sw.click() to run in the same call stack as the user gesture, not in rAF).
      const willArm = distance >= threshold
      if (willArm && !armed) haptic('light')
      apply(distance)
    }
    const end = (commit: boolean) => {
      if (startY === undefined) return
      if (dragging) {
        const fire = commit && distance >= threshold
        cancelAnimationFrame(frame)
        frame = 0
        paint(0, true)
        if (fire) haptic('medium') // confirm bump on successful release
        // Spring back first, then load, so the animation is never competing with a render. The layer promotion (willChange)
        // stays until the spring has finished: dropping it mid-spring made iOS repaint the list and cut the animation short.
        setTimeout(() => {
          if (fire) release.current()
        }, reduce ? 0 : 320)
        el.style.pointerEvents = ''
        document.documentElement.style.userSelect = ''
        document.documentElement.style.removeProperty('-webkit-user-select')
        setTimeout(() => {
          el.style.willChange = ''
        }, reduce ? 0 : 560)
        // A mouse drag ends with a click on whatever is under the pointer; swallow it.
        if (mouse) {
          const stop = (ev: Event) => ev.stopPropagation()
          window.addEventListener('click', stop, { capture: true, once: true })
          setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0)
        }
      } else el.style.willChange = ''
      startY = undefined
      dragging = false
      distance = 0
    }

    const ts = (e: TouchEvent) => begin(e.touches[0].clientY, e.target, false)
    const tm = (e: TouchEvent) => !mouse && move(e.touches[0].clientY, e)
    const te = () => end(true)
    const tc = () => end(false)
    const md = (e: MouseEvent) => e.button === 0 && begin(e.clientY, e.target, true)
    // A mouse button released outside the window or over devtools never reaches `mouseup`; without this the list kept
    // following the pointer with no button held, stuck half pulled.
    const mm = (e: MouseEvent) => {
      if (!mouse) return
      if (e.buttons === 0) end(false)
      else move(e.clientY, e)
    }
    const away = () => end(false)
    // The browser's touch emulation can lose `touchend` when the button is released outside the page; pointer events still say.
    const pup = () => end(true)
    const noDrag = (e: Event) => dragging && e.preventDefault()
    const mu = () => mouse && end(true)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && end(false)

    window.addEventListener('touchstart', ts, { passive: true })
    window.addEventListener('touchmove', tm, { passive: false })
    window.addEventListener('touchend', te)
    window.addEventListener('touchcancel', tc)
    window.addEventListener('mousedown', md)
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', mu)
    window.addEventListener('keydown', key)
    window.addEventListener('blur', away)
    window.addEventListener('pointerup', pup)
    window.addEventListener('dragstart', noDrag)
    window.addEventListener('selectstart', noDrag)
    document.addEventListener('mouseleave', away)
    document.addEventListener('visibilitychange', away)
    return () => {
      end(false)
      window.removeEventListener('touchstart', ts)
      window.removeEventListener('touchmove', tm)
      window.removeEventListener('touchend', te)
      window.removeEventListener('touchcancel', tc)
      window.removeEventListener('mousedown', md)
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mouseup', mu)
      window.removeEventListener('keydown', key)
      window.removeEventListener('blur', away)
      window.removeEventListener('pointerup', pup)
      window.removeEventListener('dragstart', noDrag)
      window.removeEventListener('selectstart', noDrag)
      document.removeEventListener('mouseleave', away)
      document.removeEventListener('visibilitychange', away)
    }
  }, [enabled, threshold])

  return { ref, labelRef }
}
