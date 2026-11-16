import { Box, type BoxProps } from '@chakra-ui/react'
import { useId, useMemo } from 'react'
import { markBody } from '../../shared/logo'

interface Props extends Omit<BoxProps, 'children'> {
  /** Width and height in pixels. */
  size: number
  /** The bus and tram on the orbit; leave off below about 64px, where they turn into specks. */
  vehicles?: boolean
}

/** The NextStop mark, inline so it follows the app colour: the same in light and dark mode. */
export function BrandMark({ size, vehicles = false, ...rest }: Props) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const body = useMemo(() => markBody({ pin: 'var(--ns-logo-pin)', ring: '#fff', train: '#fff', edge: 'var(--ns-logo-pin)', vehicles, id }), [vehicles, id])
  return (
    <Box
      as="span"
      display="inline-block"
      flexShrink={0}
      w={`${size}px`}
      h={`${size}px`}
      css={{
        // The same in light and dark: the pin in the primary accent (the colour of solid buttons, following the app colour
        // chosen in Settings) with a white train, and a white ring and vehicles edged in the accent so they show on a
        // white page too.
        '--ns-logo-pin': 'var(--chakra-colors-brand-solid)',
      }}
      {...rest}
    >
      <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label="NextStop" dangerouslySetInnerHTML={{ __html: body }} />
    </Box>
  )
}
