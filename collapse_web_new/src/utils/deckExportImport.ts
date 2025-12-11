import { Card } from "../domain/decks/DeckEngine"

export type ExportedDeck = {
  name?: string
  deck?: string[]
  baseCounts?: Record<string, number>
  modCounts?: Record<string, number>
  nullCount?: number
  modifierCapacity?: number
  createdAt?: string
}

// Minimal shape validation for imported deck
export function validateImportedDeck(raw: any, baseCards: Card[], modCards: Card[]) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid deck format')

  const baseIds = new Set(baseCards.map((c) => c.id))
  const modIds = new Set(modCards.map((c) => c.id))

  const exported: ExportedDeck = {}

  if (raw.name && typeof raw.name === 'string') exported.name = raw.name

  if (Array.isArray(raw.deck)) exported.deck = raw.deck.filter((d: any): d is string => typeof d === 'string')

  if (raw.baseCounts && typeof raw.baseCounts === 'object') {
    const entries = Object.entries(raw.baseCounts).filter(([k, v]) => baseIds.has(k) && typeof v === 'number') as [string, number][]
    exported.baseCounts = Object.fromEntries(entries)
  }

  if (raw.modCounts && typeof raw.modCounts === 'object') {
    const entries = Object.entries(raw.modCounts).filter(([k, v]) => modIds.has(k) && typeof v === 'number') as [string, number][]
    exported.modCounts = Object.fromEntries(entries)
  }

  if (typeof raw.nullCount === 'number') exported.nullCount = raw.nullCount
  if (typeof raw.modifierCapacity === 'number') exported.modifierCapacity = raw.modifierCapacity
  if (raw.createdAt && typeof raw.createdAt === 'string') exported.createdAt = raw.createdAt

  // Minimal success criteria: must have either deck or counts
  if (!exported.deck && !exported.baseCounts && !exported.modCounts) throw new Error('No deck data found')

  return exported
}

export function exportObjectAsJSON(filename: string, object: any) {
  const s = JSON.stringify(object, null, 2)
  const blob = new Blob([s], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
