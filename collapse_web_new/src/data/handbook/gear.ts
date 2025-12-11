import { Card } from '../../domain/decks/DeckEngine'

// Gear is often updated and may be treated separately from engram cards.
export const gear: Card[] = [
  // Example gear entries; treat as updatable content
  { id: 'g1', name: 'Tattered Jacket', type: 'Gear', text: 'Provides 1 protection.' },
]

export default gear
