import { describe, it, expect } from 'vitest'
import { validateImportedDeck } from './deckExportImport'
import type { Card } from '../domain/decks/DeckEngine'

describe('deckExportImport', () => {
  const baseCards: Card[] = [
    { id: 'b1', name: 'Base 1' },
    { id: 'b2', name: 'Base 2' },
  ]
  const modCards: Card[] = [
    { id: 'm1', name: 'Mod 1' },
  ]

  it('parses exported deck with deck and counts', () => {
    const raw = {
      name: 'My Deck',
      deck: ['b1', 'm1', 'b2'],
      baseCounts: { b1: 2, b2: 1 },
      modCounts: { m1: 1 },
      nullCount: 5,
      modifierCapacity: 10,
    }
    const parsed = validateImportedDeck(raw, baseCards, modCards)
    expect(parsed.name).toBe('My Deck')
    expect(parsed.deck).toEqual(['b1', 'm1', 'b2'])
    expect(parsed.baseCounts).toMatchObject({ b1: 2, b2: 1 })
    expect(parsed.modCounts).toMatchObject({ m1: 1 })
  })

  it('filters unknown ids from counts', () => {
    const raw = {
      baseCounts: { b1: 1, unknown: 3 },
      modCounts: { m1: 2, unknownm: 2 },
      deck: ['b1', 'unknown', 'm1'],
    }
    const parsed = validateImportedDeck(raw, baseCards, modCards)
    expect(parsed.baseCounts).toMatchObject({ b1: 1 })
    expect(parsed.modCounts).toMatchObject({ m1: 2 })
    // deck keeps string ids; validation only ensures string type
    expect(parsed.deck).toContain('unknown')
  })

  it('throws on invalid objects', () => {
    expect(() => validateImportedDeck(null as any, baseCards, modCards)).toThrow()
    expect(() => validateImportedDeck(123 as any, baseCards, modCards)).toThrow()
    expect(() => validateImportedDeck({ foo: 'bar' }, baseCards, modCards)).toThrow()
  })
})
