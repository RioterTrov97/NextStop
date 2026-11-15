import { addressAt } from '../api/client'
import type { Place } from '../api/types'

export type LocationError = 'denied' | 'unavailable' | 'unsupported' | 'no-address'

export const LOCATION_ERRORS: Record<LocationError, string> = {
  denied: 'Location is off for NextStop. Allow it in Settings > Privacy & Security > Location Services, or search for the address.',
  unavailable: "Couldn't find where you are. Try again outdoors, or search for the address.",
  unsupported: "This browser can't share your location. Search for the address instead.",
  'no-address': "Couldn't find an address here. Search for it instead.",
}

/**
 * Where the user is, as the nearest street address. Asks for location permission only when called, which is only
 * on tapping "Current location". The position goes to Transport for NSW once, to look up the address.
 */
export async function currentPlace(): Promise<Place> {
  if (!('geolocation' in navigator)) throw 'unsupported' satisfies LocationError
  const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 }),
  ).catch((e: GeolocationPositionError) => {
    throw (e.code === e.PERMISSION_DENIED ? 'denied' : 'unavailable') satisfies LocationError
  })
  const place = await addressAt(pos.coords.latitude, pos.coords.longitude).catch(() => undefined)
  if (!place) throw 'no-address' satisfies LocationError
  return place
}
