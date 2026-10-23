import { Box } from '@chakra-ui/react'
import { lineColor } from '../lib/lines'

interface Props {
  number?: string
  cls?: number
  size?: 'sm' | 'md'
}

export function LineBadge({ number, cls, size = 'md' }: Props) {
  const label = number ?? '·'
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      minW={size === 'md' ? '34px' : '28px'}
      h={size === 'md' ? '24px' : '20px'}
      px={1.5}
      borderRadius="md"
      fontWeight="bold"
      fontSize={size === 'md' ? 'sm' : 'xs'}
      color="white"
      style={{ background: lineColor(number, cls) }}
    >
      {label}
    </Box>
  )
}
