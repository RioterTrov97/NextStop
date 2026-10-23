import type { SavedTrip } from '../store/savedTrips'

export const tripPath = (t: Pick<SavedTrip, 'fromId' | 'toId' | 'fromName' | 'toName' | 'modes'>, extra: Record<string, string> = {}) =>
  `/trip/${encodeURIComponent(t.fromId)}/${encodeURIComponent(t.toId)}?${new URLSearchParams({
    fn: t.fromName,
    tn: t.toName,
    ...(t.modes.length ? { modes: t.modes.join(',') } : {}),
    ...extra,
  })}`
