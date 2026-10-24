import { ChakraProvider } from '@chakra-ui/react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { system } from '../theme'
import { SwipeToRemove } from './SwipeToRemove'

const setup = () => {
  const onRemove = vi.fn()
  render(
    <ChakraProvider value={system}>
      <SwipeToRemove onRemove={onRemove}>
        <span>row</span>
      </SwipeToRemove>
    </ChakraProvider>,
  )
  const el = screen.getByText('row').parentElement!
  el.setPointerCapture = vi.fn()
  Object.defineProperty(el.parentElement!, 'offsetWidth', { value: 400 })
  return { el, onRemove }
}

const swipe = (el: HTMLElement, to: number) => {
  fireEvent.pointerDown(el, { clientX: 300, clientY: 100, pointerId: 1 })
  fireEvent.pointerMove(el, { clientX: to, clientY: 100, pointerId: 1 })
  fireEvent.pointerUp(el, { clientX: to, clientY: 100, pointerId: 1 })
}

describe('SwipeToRemove', () => {
  it('removes when released past the threshold', () => {
    vi.useFakeTimers()
    const { el, onRemove } = setup()
    swipe(el, 520)
    vi.advanceTimersByTime(300)
    expect(onRemove).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it('keeps the row when released before the threshold', () => {
    vi.useFakeTimers()
    const { el, onRemove } = setup()
    swipe(el, 420)
    vi.advanceTimersByTime(300)
    expect(onRemove).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
