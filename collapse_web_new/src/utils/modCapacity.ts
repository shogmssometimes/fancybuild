import type { Card } from '../domain/decks/DeckEngine'

type ModState = { modCounts: Record<string, number>; modifierCapacity: number }

export const getModCapacityUsed = (modCards: Card[], modCounts: Record<string, number>) =>
  modCards.reduce((total, card) => {
    const qty = modCounts[card.id] ?? 0
    const cost = card.cost ?? 0
    return total + qty * cost
  }, 0)

export const canAddModCardFrom = (modCards: Card[], state: ModState, cardId: string) => {
  const card = modCards.find((c) => c.id === cardId)
  const cost = card?.cost ?? 0
  return getModCapacityUsed(modCards, state.modCounts) + cost <= state.modifierCapacity
}
