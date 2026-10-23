// The journey drawer treats taps in the full-screen map as outside clicks; it checks this to ignore them.
// Kept out of LiveMap so the drawer can import it without pulling in the lazy-loaded Leaflet chunk.
let expanded = 0

export const isMapExpanded = () => expanded > 0
export const markMapExpanded = () => {
  expanded++
  // Delayed release so the event that closed the map is still ignored by the drawer.
  return () => void setTimeout(() => expanded--, 300)
}
