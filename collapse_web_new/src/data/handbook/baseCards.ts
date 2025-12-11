import { Card } from '../../domain/decks/DeckEngine'
import baseCardData from './raw/basecards.json'

type RawBaseCard = typeof baseCardData[number]

const pretty = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return value.toString()
  return value.replace(/(^|\s)([a-z])/g, (_, space, letter) => `${space}${letter.toUpperCase()}`)
}

const buildBaseCardDetails = (card: RawBaseCard) => {
  const details = [
    { label: 'Skill', value: pretty(card.skill) },
    { label: 'Rarity', value: pretty(card.rarity) },
    { label: 'Capacity Cost', value: pretty(card.capacityCost) },
  ]

  if (card.category) details.push({ label: 'Category', value: pretty(card.category) })

  return details
}

const formatBaseCardText = (card: RawBaseCard) => {
  const rendered = buildBaseCardDetails(card)
    .filter((detail) => detail.label !== 'Category')
    .map((detail) => `${detail.label}: ${detail.value}`)
  return rendered.join(' • ')
}

export const baseCards: Card[] = baseCardData
  .filter((card) => card.type !== 'null')
  .map((card) => ({
    id: card.id,
    name: card.name,
    type: 'base',
    cost: card.capacityCost ?? 0,
    text: formatBaseCardText(card),
    details: buildBaseCardDetails(card),
  }))

export default baseCards
