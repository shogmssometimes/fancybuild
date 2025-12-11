import { describe, expect, it } from 'vitest'
import { getModCapacityUsed, canAddModCardFrom } from './modCapacity'

import type { Card } from '../domain/decks/DeckEngine'

const modCards: Card[] = [
  { id: 'm1', name: 'Mod 1', text: '', type: 'mod', cost: 2 },
  { id: 'm2', name: 'Mod 2', text: '', type: 'mod', cost: 3 },
]

describe('modCapacity helpers', () => {
  it('calculates used capacity from counts', () => {
    const used = getModCapacityUsed(modCards, { m1: 2, m2: 1 })
    expect(used).toBe(2 * 2 + 3 * 1)
  })

  it('prevents adding when capacity exceeded', () => {
    const state = { modCounts: { m1: 2, m2: 1 }, modifierCapacity: 7 }
    // m1 currently uses 4, m2 uses 3 => used = 7
    const canAddM1 = canAddModCardFrom(modCards, state, 'm1')
    const canAddM2 = canAddModCardFrom(modCards, state, 'm2')
    expect(canAddM1).toBe(false)
    expect(canAddM2).toBe(false)
  })

  it('allows adding if capacity permits', () => {
    const state = { modCounts: { m1: 1, m2: 1 }, modifierCapacity: 7 }
    // used = 2 + 3 = 5
    expect(canAddModCardFrom(modCards, state, 'm1')).toBe(true) // would be 7
    expect(canAddModCardFrom(modCards, state, 'm2')).toBe(false) // would be 8 -> false
  })
})
