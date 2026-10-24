import { Box, Stack, Text } from '@chakra-ui/react'
import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'
import { LuSparkles } from 'react-icons/lu'

interface Props {
  icon: IconType
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, children, action }: Props) {
  return (
    <Stack align="center" textAlign="center" gap={3} py={10} px={6}>
      <Box position="relative">
        <Box display="grid" placeItems="center" w="88px" h="88px" borderRadius="full" bg="teal.subtle" color="teal.fg">
          <Icon size={40} />
        </Box>
        <Box position="absolute" top="-2px" right="-6px" color="teal.solid">
          <LuSparkles size={20} />
        </Box>
      </Box>
      <Text fontSize="lg" fontWeight="bold">
        {title}
      </Text>
      {children && (
        <Text color="fg.muted" fontSize="sm" maxW="280px">
          {children}
        </Text>
      )}
      {action}
    </Stack>
  )
}
