import { describe, expect, it } from 'vitest'
import { searchStations } from './stations'

const names = (q: string, n = 3) => searchStations(q, n).map((p) => p.name)

describe('searchStations', () => {
  it('finds stations from the first letters, shortest name first', () => {
    expect(names('cen')[0]).toBe('Central Station')
    expect(names('chats')).toEqual(['Chatswood Station'])
    expect(names('stra')[0]).toBe('Strathfield Station')
  })

  it('matches the start of any word, ignoring case, punctuation and the word "station"', () => {
    expect(names('marys')).toContain('St Marys Station')
    expect(names('MARTIN PLACE station')).toEqual(['Martin Place Station'])
    expect(names('macq uni')).toEqual(['Macquarie University Station'])
  })

  it('carries stop ids and modes the trip planner understands', () => {
    expect(searchStations('central', 1)[0]).toMatchObject({ id: '200060', type: 'stop', modes: [1, 2] })
  })

  it('returns nothing for blank or unmatched text', () => {
    expect(searchStations('   ')).toEqual([])
    expect(searchStations('zzzz')).toEqual([])
  })
})
