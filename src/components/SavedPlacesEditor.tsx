import { Box, Button, Flex, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { SAVED_PLACES, savedPlaces, useSavedPlaces, type SavedPlaceKey } from '../store/places'
import { ConfirmDialog } from './ConfirmDialog'
import { PlaceIcon, StopSearch } from './StopSearch'

/** Home and Work for Settings: set from a search or the current location, change or remove. */
export function SavedPlacesEditor() {
  const saved = useSavedPlaces()
  const [editing, setEditing] = useState<SavedPlaceKey>()
  const [removing, setRemoving] = useState<SavedPlaceKey>()
  const label = (k: SavedPlaceKey) => SAVED_PLACES.find((s) => s.key === k)!.label

  return (
    <Box>
      <Text fontWeight="semibold">Home and Work</Text>
      <Text fontSize="sm" color="fg.muted" mb={2}>
        Plan from or to them in one tap. Stored on this phone only; the address is sent to Transport for NSW just when you plan a trip.
      </Text>
      <Stack gap={2}>
        {SAVED_PLACES.map(({ key, label: name }) => {
          const place = saved[key]
          if (editing === key)
            return (
              <Box key={key}>
                <StopSearch
                  label={`${name} address`}
                  hideSaved
                  onChange={(p) => {
                    // Picking Home while setting Work (or the other way round) would make it point at itself.
                    if (!p || p.type === 'saved') return
                    savedPlaces.set(key, p)
                    setEditing(undefined)
                  }}
                />
                <Button size="xs" variant="ghost" mt={1} onClick={() => setEditing(undefined)}>
                  Cancel
                </Button>
              </Box>
            )
          return (
            <Flex key={key} align="center" gap={3} p={3} bg="bg.panel" borderWidth="1px" borderRadius="xl">
              <Box color={place ? 'teal.500' : 'fg.muted'}>
                <PlaceIcon place={{ id: key }} />
              </Box>
              <Box flex={1} minW={0}>
                <Text fontWeight="medium">{name}</Text>
                <Text fontSize="xs" color="fg.muted" truncate>
                  {place ? place.name : 'Not set'}
                </Text>
              </Box>
              <Button size="xs" variant="outline" borderRadius="full" onClick={() => setEditing(key)}>
                {place ? 'Change' : 'Set'}
              </Button>
              {place && (
                <Button size="xs" variant="ghost" colorPalette="red" borderRadius="full" onClick={() => setRemoving(key)}>
                  Remove
                </Button>
              )}
            </Flex>
          )
        })}
      </Stack>
      <ConfirmDialog
        open={!!removing}
        title={`Remove ${removing ? label(removing) : ''}?`}
        does={`Forgets the ${removing ? label(removing) : ''} address on this phone.`}
        doesNot="Saved trips from or to it stay, but can't be planned until you set it again."
        confirmLabel="Remove"
        onConfirm={() => removing && savedPlaces.set(removing, undefined)}
        onClose={() => setRemoving(undefined)}
      />
    </Box>
  )
}
