import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Journey } from '../api/types'
import { system } from '../theme'
import { JourneySheet } from './JourneySheet'

// jsdom has no ResizeObserver; the drawer only uses it to measure itself for swipes.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const journey: Journey = {
  legs: [
    { origin: { name: 'Home' }, destination: { name: 'Central Station' }, duration: 300, transportation: { product: { class: 100 } } },
  ],
}

const setup = (props: { showRefresh?: boolean; isCurrent?: boolean; journey?: Journey } = {}) => {
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChakraProvider value={system}>
        <JourneySheet journey={props.journey ?? journey} onClose={onClose} banner={<p>Faster route</p>} {...props} />
      </ChakraProvider>
    </QueryClientProvider>,
  )
  return { onClose }
}

describe('JourneySheet', () => {
  it('shows the trip with the replan banner above the legs', () => {
    setup()
    expect(screen.getByText('Trip details')).toBeTruthy()
    expect(screen.getByText('Faster route')).toBeTruthy()
    expect(screen.getByText(/Walk .* to Central Station/)).toBeTruthy()
  })

  it('leaves the refresh countdown to the page header unless asked', () => {
    setup()
    expect(screen.queryByRole('button', { name: /refresh/i })).toBeNull()
  })

  it('shows the refresh countdown when the header behind it has none', () => {
    setup({ showRefresh: true })
    expect(screen.getByRole('button', { name: /refresh/i })).toBeTruthy()
  })

  it('on the followed trip, puts rides still ahead first and folds finished ones into Previous stops', () => {
    const iso = (min: number) => new Date(Date.now() + min * 60_000).toISOString()
    const ride = (n: string, from: string, to: string, dep: number, arr: number) => ({
      origin: { name: `${from} Station`, departureTimePlanned: iso(dep) },
      destination: { name: `${to} Station`, arrivalTimePlanned: iso(arr) },
      transportation: { number: n, product: { class: 5 }, destination: { name: to } },
      properties: {},
    })
    const trip: Journey = { legs: [ride('600', 'Parramatta', 'Castle Hill', -30, -5), ride('M1', 'Castle Hill', 'Chatswood', 2, 20)] }
    setup({ journey: trip, isCurrent: true })
    const titles = () => screen.getAllByText(/^to (Castle Hill|Chatswood)$/).map((e) => e.textContent)
    // Only the ride ahead shows until the user opens Previous stops.
    expect(titles()).toEqual(['to Chatswood'])
    fireEvent.click(screen.getByRole('button', { name: /Previous stops \(1\)/ }))
    expect(titles()).toEqual(['to Chatswood', 'to Castle Hill'])
  })

  it('keeps the planned order for trips that are not being followed', () => {
    const iso = (min: number) => new Date(Date.now() + min * 60_000).toISOString()
    const trip: Journey = {
      legs: [
        {
          origin: { name: 'A', departureTimePlanned: iso(-30) },
          destination: { name: 'B', arrivalTimePlanned: iso(-5) },
          transportation: { number: '600', product: { class: 5 }, destination: { name: 'B' } },
        },
      ],
    }
    setup({ journey: trip })
    expect(screen.queryByRole('button', { name: /Previous stops/ })).toBeNull()
    expect(screen.getByText('to B')).toBeTruthy()
  })
})
