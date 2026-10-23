import { Box, Flex, Heading, IconButton } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import { LuChevronLeft } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  subtitle?: string
  back?: boolean
  action?: ReactNode
  children?: ReactNode
}

export function PageHeader({ title, subtitle, back, action, children }: Props) {
  const navigate = useNavigate()
  return (
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
      pt="calc(16px + env(safe-area-inset-top))"
      shadow="md"
    >
      <Flex align="center" gap={2}>
        {back && (
          <IconButton aria-label="Back" variant="ghost" color="white" size="sm" ms={-2} onClick={() => navigate(-1)}>
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
  )
}
