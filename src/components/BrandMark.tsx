import { Box, type BoxProps } from '@chakra-ui/react'
import { useId, useMemo } from 'react'
import { markBody } from '../../shared/logo'

interface Props extends Omit<BoxProps, 'children'> {
  /** Width and height in pixels. */
  size: number
  /** The bus and tram on the orbit; leave off below about 64px, where they turn into specks. */
  vehicles?: boolean
}

/** The NextStop mark, inline so it follows the colour mode: the deep accent on light pages, the pale one on dark ones. */
export function BrandMark({ size, vehicles = false, ...rest }: Props) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const body = useMemo(() => markBody({ pin: 'var(--ns-logo-pin)', ring: 'var(--ns-logo-ring)', vehicles, id }), [vehicles, id])
  return (
    <Box
      as="span"
      display="inline-block"
      flexShrink={0}
      w={`${size}px`}
      h={`${size}px`}
      css={{
        // The theme's variables, so the mark follows the app colour chosen in Settings.
        '--ns-logo-pin': 'var(--chakra-colors-brand-600)',
        '--ns-logo-ring': 'var(--chakra-colors-brand-800)',
        '.dark &': { '--ns-logo-pin': 'var(--chakra-colors-brand-300)', '--ns-logo-ring': 'var(--chakra-colors-brand-100)' },
      }}
      {...rest}
    >
      <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label="NextStop" dangerouslySetInnerHTML={{ __html: body }} />
    </Box>
  )
}
