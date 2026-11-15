import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { system } from '../theme'
import { StopSearch } from './StopSearch'

afterEach(() => vi.unstubAllGlobals())

describe('StopSearch', () => {
  it('lists matching stations straight away, with a loader while the stop finder is still answering', () => {
    // A network that never answers: anything shown must come from the bundled station list.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChakraProvider value={system}>
          <StopSearch label="From" onChange={() => {}} />
        </ChakraProvider>
      </QueryClientProvider>,
    )
    fireEvent.change(screen.getByLabelText('From'), { target: { value: 'chats' } })
    expect(screen.getByText('Chatswood Station')).toBeTruthy()
    expect(screen.getByText('Searching stops, addresses and places…')).toBeTruthy()
  })

  it('keeps a departure board search to stations and stops', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChakraProvider value={system}>
          <StopSearch label="Station or stop" stopsOnly onChange={() => {}} />
        </ChakraProvider>
      </QueryClientProvider>,
    )
    const input = screen.getByLabelText('Station or stop')
    fireEvent.focus(input)
    expect(screen.queryByText('Current location')).toBeNull()
    fireEvent.change(input, { target: { value: 'chats' } })
    expect(screen.getByText('Searching all stops…')).toBeTruthy()
  })
})
