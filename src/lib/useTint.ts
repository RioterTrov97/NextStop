import { useMemo, type CSSProperties } from 'react'
import type { Journey, Leg } from '../api/types'
import { useSettings } from '../store/settings'
import { useColorMode } from './colorMode'
import { isTransit } from './journey'
import { lineColor } from './lines'
import { cardWash, makeTint, tintGradient, tintVars, type Tint } from './tint'

/** The official colour of a ride's line (as its badge shows it). */
export const legColour = (leg: Leg) =>
  lineColor(leg.transportation?.number ?? leg.transportation?.disassembledName, leg.transportation?.product?.class)

/** The first and last line colours of a journey's rides; undefined for walk-only trips. */
export function journeyColours(journey: Journey | undefined): [string, string] | undefined {
  const rides = journey?.legs.filter(isTransit) ?? []
  if (!rides.length) return undefined
  return [legColour(rides[0]), legColour(rides[rides.length - 1])]
}

export interface ScreenTint {
  first: Tint
  last: Tint
  /** CSS variables for the tinted area (see tintVars). */
  vars: CSSProperties
  /** A screen background: the line colour fading into the page. */
  gradient: string
  /** A faint wash for a card. */
  card: string
}

/**
 * The tint for one or two line colours in the current colour mode, or undefined when "Colour screens by line" is off
 * or there's no line. Memoised on the colours, so it is cheap on pages that re-render every second.
 */
export function useTint(first: string | undefined, last: string | undefined = first): ScreenTint | undefined {
  const { tintByLine } = useSettings()
  const mode = useColorMode()
  return useMemo(() => {
    if (!tintByLine || !first) return undefined
    const a = makeTint(first, mode)
    const b = last && last !== first ? makeTint(last, mode) : a
    return { first: a, last: b, vars: tintVars(a), gradient: tintGradient(a, b, mode), card: cardWash(a, b) }
  }, [tintByLine, first, last, mode])
}

/** The tint for a journey: its first ride's line, blending into its last ride's. */
export function useJourneyTint(journey: Journey | undefined): ScreenTint | undefined {
  const colours = journeyColours(journey)
  return useTint(colours?.[0], colours?.[1])
}
