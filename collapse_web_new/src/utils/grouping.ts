export type HandItem = { id: string }
export type DiscardItem = { id: string; origin?: 'played' | 'discarded' }

// Return grouped counts keyed by id for a list of items
export function groupCounts(items: { id: string }[]) {
  return items.reduce<Record<string, number>>((acc, it) => {
    acc[it.id] = (acc[it.id] ?? 0) + 1
    return acc
  }, {})
}

// Given hand length and handLimit and discard groups for a specific id, compute
// how many items of that id can be returned to hand without exceeding handLimit
export function computeReturnableCount(handLength: number, handLimit: number, availableInDiscard: number) {
  const space = Math.max(0, handLimit - handLength)
  return Math.min(space, availableInDiscard)
}

export default { groupCounts, computeReturnableCount }
