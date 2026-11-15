import { useEffect } from 'react'
import { useSettings } from '../store/settings'

/** Marks <html data-solid> while "Reduce transparency" is on, which swaps every glass surface for a solid one. */
export function useSolidSurfaces() {
  const { reduceTransparency } = useSettings()
  useEffect(() => {
    const root = document.documentElement
    if (reduceTransparency) root.dataset.solid = ''
    else delete root.dataset.solid
  }, [reduceTransparency])
}

/**
 * Colours the page header (and with it the iPhone status bar and theme-color, see statusBar.ts) in a tint's wash while
 * the calling screen is open. Pass undefined for the plain page colour.
 */
export function useHeaderTint(tint: { wash: string; onWash: string } | undefined) {
  const wash = tint?.wash
  const onWash = tint?.onWash
  useEffect(() => {
    const root = document.documentElement.style
    if (!wash || !onWash) return
    root.setProperty('--ns-header-bg', wash)
    root.setProperty('--ns-header-fg', onWash)
    return () => {
      root.removeProperty('--ns-header-bg')
      root.removeProperty('--ns-header-fg')
    }
  }, [wash, onWash])
}
