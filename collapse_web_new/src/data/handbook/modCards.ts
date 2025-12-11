import { Card, CardDetail } from '../../domain/decks/DeckEngine'
import modCardData from './raw/modcards.json'

type RawModCard = typeof modCardData[number]

const normalize = (value?: string) => (value ? value.trim() : '')

const buildModCardDetails = (card: RawModCard): CardDetail[] => {
  const details: CardDetail[] = []
  if (card.effect) details.push({ label: 'Effect', value: normalize(card.effect) })
  if (card.target) details.push({ label: 'Target', value: normalize(card.target) })
  if (card.extraActions) details.push({ label: 'Extra Actions', value: normalize(card.extraActions) })
  if (card.notes) details.push({ label: 'Notes', value: normalize(card.notes) })
  if (card.type) details.push({ label: 'Rarity', value: normalize(card.type) })
  return details
}

const formatModCardText = (card: RawModCard) => {
  const summary = []
  if (card.effect) summary.push(normalize(card.effect))
  if (card.target) summary.push(`Target: ${normalize(card.target)}`)
  return summary.join(' • ')
}

export const modCards: Card[] = modCardData.map((card) => ({
  id: card.id,
  name: card.name,
  type: 'mod',
  cost: card.cost,
  text: formatModCardText(card),
  details: buildModCardDetails(card),
}))

export default modCards
