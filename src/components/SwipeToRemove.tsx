import { Box, Flex } from '@chakra-ui/react'
import { useRef, useState, type ReactNode } from 'react'
import { LuTrash2 } from 'react-icons/lu'

/** Share of the row's width it must be dragged before releasing removes it. */
export const SWIPE_REMOVE_RATIO = 0.4

/** Drag the row sideways past the threshold to remove it. Delete also removes it from the keyboard. */
export function SwipeToRemove({
  children,
  onRemove,
  confirm = false,
  ratio = SWIPE_REMOVE_RATIO,
}: {
  children: ReactNode
  onRemove: () => void
  /** The row snaps back and onRemove is only a request, e.g. to open a confirmation. */
  confirm?: boolean
  /** Overrides SWIPE_REMOVE_RATIO for this row. */
  ratio?: number
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [gone, setGone] = useState(false)
  const start = useRef<{ x: number; y: number; locked: boolean } | null>(null)
  const moved = useRef(false)
  const dxRef = useRef(0)
  const rowRef = useRef<HTMLDivElement>(null)

  const finish = (remove: boolean) => {
    start.current = null
    setDragging(false)
    if (remove && confirm) {
      setDx(0)
      onRemove()
    } else if (remove) {
      setGone(true)
      setDx(dxRef.current < 0 ? -window.innerWidth : window.innerWidth)
      setTimeout(onRemove, 180)
    } else setDx(0)
  }

  return (
    <Box
      ref={rowRef}
      position="relative"
      overflow="hidden"
      borderRadius="2xl"
      opacity={gone ? 0 : 1}
      transition="opacity 0.18s"
      tabIndex={-1}
      onKeyDown={(e) => e.key === 'Delete' && e.currentTarget.contains(e.target as Node) && onRemove()}
    >
      <Flex
        position="absolute"
        inset={0}
        bg="red.solid"
        visibility={dx === 0 ? 'hidden' : 'visible'}
        align="center"
        justify={dx > 0 ? 'flex-start' : 'flex-end'}
        px={5}
        color="white"
      >
        <LuTrash2 size={20} />
      </Flex>
      <Box
        position="relative"
        touchAction="pan-y"
        style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 0.18s ease-out' }}
        onPointerDown={(e) => {
          // React bubbles events from portals (dialogs, sheets) through the tree; only the row itself may start a swipe.
          if (!e.currentTarget.contains(e.target as Node)) return
          if ((e.target as HTMLElement).closest('[data-no-swipe]')) return
          start.current = { x: e.clientX, y: e.clientY, locked: false }
          moved.current = false
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s || !e.currentTarget.contains(e.target as Node)) return
          const mx = e.clientX - s.x
          if (!s.locked) {
            if (Math.abs(mx) < 8) return
            if (Math.abs(e.clientY - s.y) > Math.abs(mx)) {
              start.current = null
              return
            }
            s.locked = true
            moved.current = true
            setDragging(true)
            e.currentTarget.setPointerCapture(e.pointerId)
          }
          dxRef.current = mx
          setDx(mx)
        }}
        onPointerUp={() => {
          // A tap never locks, so clear it here or later pointer moves elsewhere would continue this gesture.
          if (start.current?.locked) finish(Math.abs(dxRef.current) > (rowRef.current?.offsetWidth ?? 0) * ratio)
          else start.current = null
        }}
        onDragStart={(e) => e.preventDefault()}
        onPointerCancel={() => start.current && finish(false)}
        onClickCapture={(e) => {
          if (moved.current && e.currentTarget.contains(e.target as Node)) {
            e.preventDefault()
            e.stopPropagation()
            moved.current = false
          }
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
