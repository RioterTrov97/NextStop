import { Button } from '@chakra-ui/react'
import { useState } from 'react'
import { LuCheck, LuStar } from 'react-icons/lu'
import { savedTrips, tripId, useSavedTrips, type SavedTrip } from '../store/savedTrips'
import { ConfirmDialog } from './ConfirmDialog'

type Route = Pick<SavedTrip, 'fromId' | 'toId' | 'fromName' | 'toName' | 'modes'>

interface Props {
  route: Route
  /** White, for the coloured page header. */
  onHeader?: boolean
  /** Let "Saved" be tapped to take the trip off Home again, after a confirmation. */
  removable?: boolean
}

/**
 * A small labelled "Save" pill; once saved it reads "Saved". Used on trip results, History and Home's previous
 * trips, so saving looks and works the same everywhere.
 */
export function SaveTripChip({ route, onHeader, removable }: Props) {
  const saved = useSavedTrips().some((t) => t.id === tripId(route.fromId, route.toId))
  const [confirm, setConfirm] = useState(false)
  const name = `${route.fromName.split(',')[0]} to ${route.toName.split(',')[0]}`
  const locked = saved && !removable

  return (
    <>
      <Button
        size="xs"
        borderRadius="full"
        variant={saved ? 'plain' : 'outline'}
        colorPalette="teal"
        color={onHeader ? 'white' : undefined}
        borderColor={onHeader && !saved ? 'whiteAlpha.700' : undefined}
        _hover={onHeader ? { bg: 'whiteAlpha.200' } : undefined}
        flexShrink={0}
        disabled={locked}
        _disabled={{ opacity: 1, cursor: 'default' }}
        aria-label={saved ? (removable ? `Saved on Home. Remove ${name}` : 'Saved on Home') : `Save ${name} to Home`}
        onClick={() => (saved ? setConfirm(true) : savedTrips.add(route))}
      >
        {saved ? <LuCheck /> : <LuStar />}
        {saved ? 'Saved' : 'Save'}
      </Button>
      {removable && (
        <ConfirmDialog
          open={confirm}
          title="Remove from Home?"
          does="Takes this trip off your Home screen."
          doesNot="You can still search it any time, and save it again."
          confirmLabel="Remove"
          onConfirm={() => savedTrips.remove(tripId(route.fromId, route.toId))}
          onClose={() => setConfirm(false)}
        />
      )}
    </>
  )
}
