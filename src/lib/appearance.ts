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
