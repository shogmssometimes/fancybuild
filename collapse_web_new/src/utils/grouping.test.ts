import { describe, it, expect } from 'vitest'
import { groupCounts, computeReturnableCount } from './grouping'

describe('groupCounts', () => {
  it('counts items by id', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: 'c' }, { id: 'b' }]
    const out = groupCounts(items)
    expect(out).toEqual({ a: 2, b: 2, c: 1 })
  })

  it('returns empty object for empty input', () => {
    expect(groupCounts([])).toEqual({})
  })
})

describe('computeReturnableCount', () => {
  it('returns 0 when hand is full', () => {
    expect(computeReturnableCount(5, 5, 3)).toBe(0)
  })

  it('returns available when space >= available', () => {
    expect(computeReturnableCount(2, 5, 3)).toBe(3)
  })

  it('returns space when space < available', () => {
    expect(computeReturnableCount(3, 6, 10)).toBe(3)
  })
})
