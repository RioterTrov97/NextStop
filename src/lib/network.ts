/**
 * Where changing trains could pay off, worked out on the device from the bundled timetable, without API calls.
 *
 * The trip planner never offers a change it can avoid, so faster combinations (Lidcombe to Strathfield, then an
 * express to Wynyard) only show up when searched for separately, and every search costs quota. This model picks the
 * few interchanges worth that cost, from every stopping pattern's running times and how often it runs right now
 * (src/data/network.json, regenerated with `npm run stations`).
 *
 * It computes the classic "optimal strategy" for frequency-based transit (Spiess and Florian, 1989): from every
 * station, the expected time to the destination when boarding whichever attractive train comes first, where a train
 * is attractive if riding it (and changing after it) beats waiting for something better. Waits are half the combined
 * headway; each change costs the user's minimum change time.
 */

export interface NetworkData {
  /** Station ids; patterns refer to them by index. */
  stations: string[]
  /** [mode (1 train, 2 metro), stop indexes, minutes from the first stop in halves, trips per hour in tenths per band]. */
  patterns: [number, number[], number[], number[]][]
}

export interface HubOption {
  id: string
  /** Expected minutes to the destination when changing here, waits included. */
  expectedMin: number
  /** Trains per hour from the origin to here. */
  perHour: number
  /** Trains per hour worth taking on from here to the destination. */
  onwardPerHour: number
}

export interface ChangePlan {
  /** Expected minutes on the best strategy, changes allowed. */
  expectedMin: number
  /** Expected minutes using only trains that run straight through, if any do. */
  directMin?: number
  /** Interchanges worth searching, best first. */
  hubs: HubOption[]
}

export interface PlanOptions {
  /** Band index from `bandAt`. */
  band: number
  /** Minutes each change costs. */
  changeMin: number
  /** Allowed modes: 1 train, 2 metro. */
  modes?: number[]
  /** At most this many interchanges. */
  max?: number
  /** Keep interchanges whose expected time is within this share of the best strategy's. */
  tolerance?: number
}

/** Half the headway on average, for timetabled services rather than random arrivals. */
const WAIT_FACTOR = 0.5
/** Two hubs this close on the same trains are interchangeable: searching both would return the same journeys. */
const SAME_HUB_MIN = 6

interface Occurrence {
  p: number
  k: number
}

class Heap<T> {
  private a: { key: number; v: T }[] = []
  get size() {
    return this.a.length
  }
  push(key: number, v: T) {
    const a = this.a
    a.push({ key, v })
    for (let i = a.length - 1; i > 0;) {
      const up = (i - 1) >> 1
      if (a[up].key <= a[i].key) break
      ;[a[up], a[i]] = [a[i], a[up]]
      i = up
    }
  }
  pop(): { key: number; v: T } | undefined {
    const a = this.a
    const top = a[0]
    const last = a.pop()
    if (a.length && last) {
      a[0] = last
      for (let i = 0; ;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l].key < a[m].key) m = l
        if (r < a.length && a[r].key < a[m].key) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
}

/** Patterns usable now, with their per-minute frequency, and where each station appears in them. */
function prepare(data: NetworkData, band: number, modes: number[]) {
  const freq = data.patterns.map(([mode, , , rates]) => (modes.includes(mode) ? rates[band] / 10 / 60 : 0))
  const at = data.stations.map(() => [] as Occurrence[])
  data.patterns.forEach(([, stops], p) => {
    if (freq[p] > 0) stops.forEach((s, k) => at[s].push({ p, k }))
  })
  return { freq, at }
}

const ride = (data: NetworkData, p: number, from: number, to: number) => (data.patterns[p][2][to] - data.patterns[p][2][from]) / 2

interface Strategy {
  /** Expected minutes from every station to the destination. */
  u: number[]
  /** The patterns each station's strategy boards. */
  boards: Set<number>[]
}

/** The optimal strategy to `dest` from every station. */
function strategyTo(data: NetworkData, dest: number, freq: number[], at: Occurrence[][], changeMin: number): Strategy {
  const n = data.stations.length
  const u = new Array<number>(n).fill(Infinity)
  const F = new Array<number>(n).fill(0)
  const N = new Array<number>(n).fill(0)
  const done = new Array<boolean>(n).fill(false)
  const boards = data.stations.map(() => new Set<number>())
  type Ev = { node: number } | { from: number; p: number }
  const heap = new Heap<Ev>()
  u[dest] = 0
  heap.push(0, { node: dest })
  while (heap.size) {
    const { key, v } = heap.pop()!
    if ('node' in v) {
      if (done[v.node] || key !== u[v.node]) continue
      done[v.node] = true
      // Every ride that ends here, from any earlier stop of any pattern calling here.
      const penalty = v.node === dest ? 0 : changeMin
      for (const { p, k } of at[v.node]) {
        const stops = data.patterns[p][1]
        for (let i = 0; i < k; i++) {
          if (!done[stops[i]]) heap.push(key + ride(data, p, i, k) + penalty, { from: stops[i], p })
        }
      }
    } else if (!done[v.from] && key < u[v.from]) {
      // An attractive ride: add it to the station's strategy.
      F[v.from] += freq[v.p]
      N[v.from] += freq[v.p] * key
      u[v.from] = (WAIT_FACTOR + N[v.from]) / F[v.from]
      boards[v.from].add(v.p)
      heap.push(u[v.from], { node: v.from })
    }
  }
  return { u, boards }
}

interface Ride {
  f: number
  /** Minutes to the destination when taking this ride: the ride, then the change and the strategy from its end. */
  t: number
  p: number
  /** Positions of the boarding and alighting stops in the pattern. */
  k0: number
  k: number
}

/** Expected minutes when boarding the first of the given rides that is worth taking. */
function expected(rides: Ride[]): number {
  return attractive(rides).u
}

/** The rides worth taking (each better than waiting for the others) and the expected minutes with them. */
function attractive(rides: Ride[]): { u: number; used: Ride[] } {
  let F = 0
  let N = 0
  let u = Infinity
  const used: Ride[] = []
  for (const r of [...rides].sort((a, b) => a.t - b.t)) {
    if (r.t >= u) break
    F += r.f
    N += r.f * r.t
    u = (WAIT_FACTOR + N) / F
    used.push(r)
  }
  return { u, used }
}

/** Default share of the best strategy's expected time an interchange may add and still be searched. */
export const HUB_TOLERANCE = 0.2
/** Riding less than this to or from a hub means it sits at an end: its trains are the direct trip's trains. */
const NEAR_END_MIN = 4
/** A busier interchange this close in expected time stands in for a quieter one with the same trains. */
const BUSIER_WITHIN_MIN = 3

/**
 * The interchanges worth searching between two stations, best first. A hub qualifies when changing there comes within
 * `tolerance` of the best strategy, it isn't right next to either end, and it brings in trains the direct trip
 * doesn't use (an express from Strathfield that skips Lidcombe). Hubs offering the same trains a few minutes apart
 * (Redfern, Central, Town Hall) count once, as the busiest of them. Undefined when either end isn't in the network.
 */
export function changePlan(data: NetworkData, fromId: string, toId: string, o: PlanOptions): ChangePlan | undefined {
  const from = data.stations.indexOf(fromId)
  const to = data.stations.indexOf(toId)
  if (from < 0 || to < 0 || from === to) return undefined
  const { freq, at } = prepare(data, o.band, o.modes ?? [1, 2])
  const { u, boards } = strategyTo(data, to, freq, at, o.changeMin)
  if (!Number.isFinite(u[from])) return { expectedMin: Infinity, hubs: [] }

  // Every ride from the origin, grouped by where it ends.
  const rides = new Map<number, Ride[]>()
  for (const { p, k: k0 } of at[from]) {
    const stops = data.patterns[p][1]
    for (let k = k0 + 1; k < stops.length; k++) {
      const s = stops[k]
      if (!Number.isFinite(u[s])) continue
      const t = ride(data, p, k0, k) + (s === to ? 0 : o.changeMin + u[s])
      rides.set(s, [...(rides.get(s) ?? []), { f: freq[p], t, p, k0, k }])
    }
  }
  const direct = rides.get(to)
  const throughPatterns = new Set((direct ?? []).map((r) => r.p))
  // How busy each station is now, to prefer the major interchange among equivalent ones.
  const busy = (s: number) => at[s].reduce((n, { p }) => n + freq[p], 0)
  const onwardRide = (s: number) =>
    Math.min(
      ...at[s].map(({ p, k }) => {
        const kt = data.patterns[p][1].indexOf(to)
        return kt > k ? ride(data, p, k, kt) : Infinity
      }),
    )

  const all = [...rides.entries()]
    .filter(([s]) => s !== to)
    .map(([s, list]) => {
      const { u: expectedMin, used } = attractive(list)
      return { s, list, used, expectedMin, perHour: list.reduce((n, r) => n + r.f, 0) * 60 }
    })
  type Candidate = (typeof all)[number]
  const limit = u[from] * (1 + (o.tolerance ?? HUB_TOLERANCE))
  const useful = (c: Candidate) =>
    c.expectedMin <= limit &&
    Math.min(...c.list.map((r) => ride(data, r.p, r.k0, r.k))) >= NEAR_END_MIN &&
    onwardRide(c.s) >= NEAR_END_MIN &&
    (c.used.some((r) => !throughPatterns.has(r.p)) || [...boards[c.s]].some((p) => !throughPatterns.has(p)))
  const same = (a: Candidate, b: Candidate) => sameTrains(data, a, b.s, to, boards, freq) || sameTrains(data, b, a.s, to, boards, freq)

  const chosen: Candidate[] = []
  for (const c of all.filter(useful).sort((a, b) => a.expectedMin - b.expectedMin)) {
    // The busiest station offering the same trains about as well stands in for this one.
    const rep = all
      .filter((x) => x === c || (x.expectedMin <= c.expectedMin + BUSIER_WITHIN_MIN && same(x, c)))
      .sort((a, b) => busy(b.s) - busy(a.s))[0]
    if (chosen.some((h) => h === rep || same(h, rep))) continue
    chosen.push(rep)
    if (chosen.length >= (o.max ?? 2)) break
  }
  return {
    expectedMin: u[from],
    directMin: direct ? expected(direct) : undefined,
    hubs: chosen
      .sort((a, b) => a.expectedMin - b.expectedMin)
      .map((c) => ({
        id: data.stations[c.s],
        expectedMin: c.expectedMin,
        perHour: c.perHour,
        onwardPerHour: [...boards[c.s]].reduce((n, p) => n + freq[p], 0) * 60,
      })),
  }
}

/**
 * Whether changing at `a` gives the same journeys as changing at `b`: the trains worth taking to `a` also call at `b`,
 * so do the trains worth taking on from `a`, and `b` is only a few minutes from `a` on all of them.
 */
function sameTrains(
  data: NetworkData,
  a: { s: number; used: Ride[] },
  b: number,
  to: number,
  boards: Set<number>[],
  freq: number[],
): boolean {
  const close = (p: number, k: number) => {
    const kb = data.patterns[p][1].indexOf(b)
    return kb >= 0 && Math.abs(ride(data, p, k, kb)) <= SAME_HUB_MIN
  }
  if (!a.used.every((r) => close(r.p, r.k))) return false
  const onward = [...boards[a.s]].filter((p) => freq[p] > 0 && data.patterns[p][1].indexOf(to) >= 0)
  return onward.every((p) => close(p, data.patterns[p][1].indexOf(a.s)))
}
