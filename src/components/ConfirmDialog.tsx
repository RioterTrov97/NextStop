import { Box, Button, Dialog, Portal, Stack, Text } from '@chakra-ui/react'

interface Props {
  open: boolean
  title: string
  /** What the action does. */
  does: string
  /** What the action leaves untouched, where that isn't obvious. */
  doesNot?: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, does, doesNot, confirmLabel, onConfirm, onClose }: Props) {
  return (
    <Dialog.Root role="alertdialog" open={open} placement="center" lazyMount onOpenChange={(e) => !e.open && onClose()}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content mx={4} borderRadius="2xl">
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Stack gap={3} fontSize="sm">
                <Box>
                  <Text fontWeight="semibold">What this does</Text>
                  <Text color="fg.muted">{does}</Text>
                </Box>
                {doesNot && (
                  <Box>
                    <Text fontWeight="semibold">What it won't do</Text>
                    <Text color="fg.muted">{doesNot}</Text>
                  </Box>
                )}
              </Stack>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline">Cancel</Button>
              </Dialog.ActionTrigger>
              <Button
                colorPalette="red"
                onClick={() => {
                  onConfirm()
                  onClose()
                }}
              >
                {confirmLabel}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
