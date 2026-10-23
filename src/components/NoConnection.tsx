import { Text } from '@chakra-ui/react'

/** Shown when a query is paused for lack of a connection and nothing was cached for it. */
export function NoConnection({ what }: { what: string }) {
  return (
    <Text color="fg.muted" textAlign="center" py={8} fontSize="sm">
      You're offline and {what} hasn't been saved on this device yet. It will load when you reconnect.
    </Text>
  )
}
