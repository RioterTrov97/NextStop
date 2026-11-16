import { Box, Flex, Heading, IconButton } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { LuChevronLeft, LuWifiOff } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useOnline, useScrolled } from '../lib/hooks'

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
  const scrolled = useScrolled()

  return (
    <>
      <Box
        data-page-header
        position="sticky"
        top={0}
        zIndex="docked"
        // Solid, never glass: iOS 26+ colours a home-screen app's status bar by sampling the opaque sticky strip at the top,
        // and iOS 27 blurs the status bar unless something opaque is painted there. The page colour by default, so the
        // header reads as part of the page; tinted screens (station boards) set --ns-header-bg and --ns-header-fg.
        bg="var(--ns-header-bg)"
        color="var(--ns-header-fg)"
        px={4}
        pb={2}
        // The full status bar height, uncapped: iOS 27 blurs anything in that zone, so the title must start below it
        // (59px on Dynamic Island iPhones). The solid sticky header behind the status bar is also what stops the blur.
        pt="calc(8px + env(safe-area-inset-top))"
        // A hairline below, once the page has scrolled under the header. Below only: Chakra's "md" shadow adds a 1px
        // outline on every side, which drew a line under the iPhone status bar.
        boxShadow={scrolled ? '0 1px 0 var(--chakra-colors-border)' : 'none'}
        transition="background-color 0.3s ease-out, color 0.3s ease-out, box-shadow 0.2s"
        // While a sheet or dialog is open: the header's colour as seen through the backdrop, drawn above it, so iOS
        // (which samples this bar for the status bar) dims the status bar too. Taps fall through to the backdrop.
        css={{
          'html[data-overlay] &': {
            bg: 'var(--ns-header-dim)',
            // Above every backdrop, sheet (1400) and centred dialog (1500); none of them reach up into the header.
            zIndex: 1550,
            pointerEvents: 'none',
            boxShadow: 'none',
            // Only the top of the header stays above the backdrop (the status bar and the title, as far as the sheet's top,
            // see SHEET_MAX_H). Anything taller, like the transport picker on a results page, goes under the sheet and backdrop.
            clipPath: 'inset(0 0 calc(100% - 104px - env(safe-area-inset-top)) 0)',
          },
        }}
      >
        <Flex align="center" gap={2}>
          {back && (
            <IconButton
              aria-label="Back"
              variant="ghost"
              color="inherit"
              size="sm"
              ms={-2}
              onClick={() => (backTo ? navigate(backTo, { replace: true }) : navigate(-1))}
            >
              <LuChevronLeft />
            </IconButton>
          )}
          <Box flex={1} minW={0}>
            <Heading size="xl" fontWeight="bold" letterSpacing="-0.02em" truncate>
              {title}
            </Heading>
            {subtitle && (
              <Box fontSize="sm" opacity={0.72} truncate>
                {subtitle}
              </Box>
            )}
          </Box>
          {action}
        </Flex>
        {/* Under a sheet or dialog the extra rows (transport picker, filters) are hidden; the raised header keeps only its title row.
            The 16px above them is set here, never by each page, so every header has the same room under its title. */}
        {children && (
          <Box mt={4} css={{ 'html[data-overlay] &': { visibility: 'hidden' } }}>
            {children}
          </Box>
        )}
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
