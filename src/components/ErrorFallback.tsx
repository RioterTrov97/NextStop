import { Box, Button, Code, Flex, Heading, Text } from '@chakra-ui/react'
import { useState } from 'react'
import { LuHouse, LuRefreshCw, LuTrainFront } from 'react-icons/lu'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

const BASE = import.meta.env.BASE_URL

async function hardReload() {
  // Drop service worker + caches so a broken cached bundle can't reload itself.
  try {
    const regs = await navigator.serviceWorker?.getRegistrations()
    await Promise.all((regs ?? []).map((r) => r.unregister()))
    const keys = await caches?.keys()
    await Promise.all((keys ?? []).map((k) => caches.delete(k)))
  } catch {
    // best effort
  }
  window.location.reload()
}

export function ErrorFallback() {
  const error = useRouteError()
  const [showDetails, setShowDetails] = useState(false)

  const notFound = isRouteErrorResponse(error) && error.status === 404
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error)

  return (
    <Flex minH="100dvh" align="center" justify="center" p={6} bg="bg">
      <Flex direction="column" align="center" textAlign="center" maxW="sm" gap={4}>
        <Flex
          align="center"
          justify="center"
          w={20}
          h={20}
          borderRadius="full"
          bgGradient="to-br"
          gradientFrom="teal.600"
          gradientTo="teal.700"
          color="white"
          fontSize="4xl"
          boxShadow="lg"
        >
          <LuTrainFront />
        </Flex>
        <Heading size="xl">{notFound ? 'Wrong platform' : 'Service disrupted'}</Heading>
        <Text color="fg.muted">
          {notFound
            ? "We couldn't find that page. Head back to the start and try again."
            : 'Something went off the rails. Reloading usually gets things moving again.'}
        </Text>

        <Flex gap={3} wrap="wrap" justify="center">
          <Button colorPalette="teal" onClick={hardReload}>
            <LuRefreshCw /> Reload app
          </Button>
          <Button variant="outline" onClick={() => window.location.assign(BASE)}>
            <LuHouse /> Home
          </Button>
        </Flex>

        {!notFound && (
          <Box w="full">
            <Button size="xs" variant="plain" color="fg.muted" onClick={() => setShowDetails((s) => !s)}>
              {showDetails ? 'Hide details' : 'Show details'}
            </Button>
            {showDetails && (
              <Code
                display="block"
                mt={2}
                p={3}
                borderRadius="md"
                textAlign="start"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
                fontSize="xs"
              >
                {detail}
              </Code>
            )}
          </Box>
        )}
      </Flex>
    </Flex>
  )
}
