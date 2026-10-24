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
        bgGradient="to-br"
        gradientFrom="teal.600"
        gradientTo="teal.700"
        color="white"
        px={4}
        pb={4}
        pt="calc(12px + min(env(safe-area-inset-top), 44px))"
        shadow="md"
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
