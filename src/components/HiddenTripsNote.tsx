import { Box, Stack, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuChevronDown, LuEyeOff } from 'react-icons/lu'

/**
 * One small line saying how many trips the walking and change settings hide, which opens to explain each reason. The
 * full explanations took several lines above the results on every search.
 */
export function HiddenTripsNote({
  reasons,
  allHidden = false,
}: {
  reasons: { count: number; text: string }[]
  /** Every trip found is hidden: open with the reasons, since they are the whole answer. */
  allHidden?: boolean
}) {
  const [open, setOpen] = useState(allHidden)
  // Opens itself when the list turns out to be all hidden (the count settles after the extra searches land).
  const [wasAll, setWasAll] = useState(allHidden)
  if (allHidden !== wasAll) {
    setWasAll(allHidden)
    if (allHidden) setOpen(true)
  }
  const shown = reasons.filter((r) => r.count > 0)
  const total = shown.reduce((n, r) => n + r.count, 0)
  if (total === 0) return null
  return (
    <Box fontSize="xs" color="fg.muted">
      <Box
        as="button"
        display="inline-flex"
        alignItems="center"
        gap={1.5}
        py={1}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        _focusVisible={{ outline: '2px solid', outlineColor: 'brand.focusRing', borderRadius: 'sm' }}
      >
        <LuEyeOff aria-hidden />
        <Text as="span" fontWeight="medium">
          {total} {total === 1 ? 'trip' : 'trips'} hidden
        </Text>
        <Text as="span" textDecoration="underline" textUnderlineOffset="2px">
          {open ? 'Hide why' : 'Why?'}
        </Text>
        <Box as="span" display="inline-flex" transform={open ? 'rotate(180deg)' : undefined} transition="transform 0.2s">
          <LuChevronDown aria-hidden />
        </Box>
      </Box>
      {open && (
        <Stack gap={1} mt={1} pl={5}>
          {shown.map((r) => (
            <Text key={r.text}>{r.text}</Text>
          ))}
        </Stack>
      )}
    </Box>
  )
}
