import { useEffect, useRef } from 'react'

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
      el.style.willChange = 'transform'
    }
    const move = (y: number, e: Event) => {
      if (startY === undefined) return
      const dy = y - startY
      if (!dragging) {
        // Upwards is an ordinary scroll; only a clear downward drag from the top starts the pull.
        if (dy < -4 || window.scrollY > 0) startY = undefined
        else if (dy > ACTIVATE) dragging = true
        else return
      }
      if (e.cancelable) e.preventDefault()
      // Measured from where the finger first went down, less the activation slack, so the page starts moving from zero.
      distance = rubberBand(Math.max(0, dy - ACTIVATE))
      apply(distance)
    }
    const end = (commit: boolean) => {
      if (startY === undefined) return
      if (dragging) {
        const fire = commit && distance >= threshold
        cancelAnimationFrame(frame)
        frame = 0
        paint(0, true)
        // Spring back first, then load, so the animation is never competing with a render.
        setTimeout(
          () => {
            el.style.willChange = ''
            if (fire) release.current()
          },
          reduce ? 0 : 320,
        )
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
    const mm = (e: MouseEvent) => mouse && move(e.clientY, e)
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
    }
  }, [enabled, threshold])

  return { ref, labelRef }
}
