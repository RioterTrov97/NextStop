import { CloseButton, Dialog, IconButton, Portal } from '@chakra-ui/react'
import { useState } from 'react'
import { LuFootprints } from 'react-icons/lu'
import { resetRefreshTimer } from '../api/realtime'
import { useSettings } from '../store/settings'
import { WalkOptions } from './WalkOptions'

/** Icon button that opens the global "longest walk after the last ride" choice. */
export function EndWalkSetting({ endWalk }: { endWalk?: { value: number; onChange: (n: number) => void } }) {
  const { maxEndWalk: globalEndWalk, walkPace } = useSettings()
  const maxEndWalk = endWalk?.value ?? globalEndWalk
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root placement="center" lazyMount size="sm" open={open} onOpenChange={(e) => setOpen(e.open)}>
      <Dialog.Trigger asChild>
        <IconButton
          aria-label="Walking settings"
          size="xs"
          borderRadius="full"
          variant={maxEndWalk > 0 || walkPace !== 'normal' ? 'solid' : 'outline'}
          colorPalette="teal"
        >
          <LuFootprints />
        </IconButton>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content mx={4} borderRadius="2xl">
            <Dialog.Header>
              <Dialog.Title>Walking</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <WalkOptions
                endWalk={endWalk}
                onPick={() => {
                  resetRefreshTimer()
                  setOpen(false)
                }}
              />
            </Dialog.Body>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
