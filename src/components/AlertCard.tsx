import { Box, Flex, Text } from '@chakra-ui/react'
import DOMPurify from 'dompurify'
import { useState } from 'react'
import { LuChevronDown, LuInfo, LuTriangleAlert } from 'react-icons/lu'
import type { InfoLink } from '../api/types'

interface Props {
  title?: string
  html?: string
  priority?: string
  url?: string
  urlText?: string
}

const sanitize = (html: string) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'a'], ALLOWED_ATTR: ['href'] })

export const toAlertProps = (i: InfoLink): Props => ({
  title: i.subtitle,
  html: i.content,
  priority: i.priority,
  url: i.url,
  urlText: i.urlText,
})

export function AlertCard({ title, html, priority, url, urlText }: Props) {
  const [open, setOpen] = useState(false)
  const severe = priority === 'high' || priority === 'veryHigh'
  const Icon = severe ? LuTriangleAlert : LuInfo
  const body = html ? sanitize(html) : ''

  return (
    <Box borderWidth="1px" borderLeftWidth="4px" borderLeftColor={severe ? 'red.500' : 'blue.500'} bg="bg.panel" borderRadius="lg" p={3}>
      <Flex as="button" w="full" textAlign="start" gap={2} align="start" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Box color={severe ? 'red.500' : 'blue.500'} mt={0.5}>
          <Icon />
        </Box>
        <Text flex={1} fontSize="sm" fontWeight="semibold">
          {title ?? 'Service information'}
        </Text>
        {body && (
          <Box transform={open ? 'rotate(180deg)' : undefined}>
            <LuChevronDown />
          </Box>
        )}
      </Flex>
      {open && (
        <Box
          mt={2}
          fontSize="sm"
          color="fg.muted"
          css={{ '& a': { textDecoration: 'underline' }, '& ul': { paddingInlineStart: '1.2em' } }}
        >
          <div dangerouslySetInnerHTML={{ __html: body }} />
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              style={{ textDecoration: 'underline', display: 'inline-block', marginTop: 6 }}
            >
              {urlText ?? 'More information'}
            </a>
          )}
        </Box>
      )}
    </Box>
  )
}
