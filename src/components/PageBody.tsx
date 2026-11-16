import { Stack, type StackProps } from '@chakra-ui/react'
import { forwardRef } from 'react'

/**
 * The content under a page header, with the app's spacing: 12px below the header's last line (the header's own
 * padding), the same as between rows, 16px at the sides, and 12px between rows of one list. Pages made of separate sections pass `gap={6}`
 * (24px) so the sections read apart. Use this rather than spacing each page by hand, so every tab lines up.
 */
export const PageBody = forwardRef<HTMLDivElement, StackProps>(function PageBody(props, ref) {
  return <Stack ref={ref} gap={3} px={4} pt={0} pb={6} {...props} />
})
