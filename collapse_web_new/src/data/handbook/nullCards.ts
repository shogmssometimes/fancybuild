import { Card, CardDetail } from '../../domain/decks/DeckEngine'
import baseCardData from './raw/basecards.json'

type RawBaseCard = typeof baseCardData[number]

const buildNullCardDetails = (card: RawBaseCard): CardDetail[] => {
  const details: CardDetail[] = []
  if (card.category) details.push({ label: 'Category', value: card.category })
  if (card.rarity) details.push({ label: 'Rarity', value: card.rarity })
  details.push({ label: 'Capacity Cost', value: String(card.capacityCost ?? 0) })
  return details
}

export const nullCards: Card[] = baseCardData
  .filter((card) => card.type === 'null')
  .map((card) => ({
    id: card.id,
    name: card.name,
    type: 'null',
    cost: card.capacityCost ?? 0,
    text: 'Null card — clogs your deck until recycled.',
    details: buildNullCardDetails(card),
  }))

export default nullCards
