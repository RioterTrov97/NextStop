import { Box } from '@chakra-ui/react'
import { LuFootprints } from 'react-icons/lu'

interface Props {
  seconds: number
  size?: 'sm' | 'md'
}

/** Walk at the end of a journey, shaped like a LineBadge so it reads as one more leg. */
export function WalkBadge({ seconds, size = 'md' }: Props) {
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      gap={1}
      h={size === 'md' ? '24px' : '20px'}
      px={1.5}
      borderRadius="md"
      fontWeight="bold"
      fontSize={size === 'md' ? 'sm' : 'xs'}
      color="white"
      style={{ background: '#64748b' }}
      aria-label={`Walk ${Math.round(seconds / 60)} minutes`}
    >
      <LuFootprints />
      {Math.max(1, Math.round(seconds / 60))}m
    </Box>
  )
}
