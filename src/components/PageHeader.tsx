import { Box, Flex, Heading, IconButton } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { LuChevronLeft, LuWifiOff } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useOnline } from '../lib/hooks'

interface Props {
  title: string
  subtitle?: string
  back?: boolean
  /** Where Back goes; defaults to the previous page. */
  backTo?: string
  action?: ReactNode
  children?: ReactNode
}

export function PageHeader({ title, subtitle, back, backTo, action, children }: Props) {
  const navigate = useNavigate()
  const online = useOnline()

  return (
    <>
      <Box
        position="sticky"
        top={0}
        zIndex="docked"
        // Solid, not a gradient: iOS 26+ colours a home-screen app's status bar by sampling the opaque sticky strip at the top.
        bg="teal.600"
        color="white"
        px={4}
        pb={4}
        pt="calc(8px + min(env(safe-area-inset-top), 44px))"
        // Below only: the "md" token adds a 1px outline on every side, which drew a line under the iPhone status bar.
        boxShadow="0 4px 10px rgba(0, 0, 0, 0.18)"
        transition="background-color 0.3s ease-out"
        // While a sheet or dialog is open: the header's colour as seen through the backdrop, drawn above it, so iOS
        // (which samples this bar for the status bar) dims the status bar too. Taps fall through to the backdrop.
        css={{
          'html[data-overlay] &': {
            bg: 'var(--ns-header-dim)',
            // Above every backdrop, sheet (1400) and centred dialog (1500); none of them reach up into the header.
            zIndex: 1550,
            pointerEvents: 'none',
            boxShadow: 'none',
          },
        }}
      >
        <Flex align="center" gap={2}>
          {back && (
            <IconButton
              aria-label="Back"
              variant="ghost"
              color="white"
              size="sm"
              ms={-2}
              onClick={() => (backTo ? navigate(backTo, { replace: true }) : navigate(-1))}
            >
              <LuChevronLeft />
            </IconButton>
          )}
          <Box flex={1} minW={0}>
            <Heading size="lg" truncate>
              {title}
            </Heading>
            {subtitle && (
              <Box fontSize="sm" opacity={0.85} truncate>
                {subtitle}
              </Box>
            )}
          </Box>
          {action}
        </Flex>
        {children}
      </Box>
      {!online && (
        <Flex role="status" align="center" justify="center" gap={2} px={4} py={2} bg="bg.muted" color="fg.muted" fontSize="sm">
          <LuWifiOff aria-hidden />
          <span>You're offline. Showing the last data we saved.</span>
        </Flex>
      )}
    </>
  )
}
