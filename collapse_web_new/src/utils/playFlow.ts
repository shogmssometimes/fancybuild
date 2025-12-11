export type ActivePlay = { baseId: string; mods: string[] } | null
export type ActivePlaySelection = { baseId: string; mods: string[] }

export function startPlaySelection(prev: ActivePlay, baseId: string): ActivePlay {
  if (prev && prev.baseId === baseId) return null
  return { baseId, mods: [] }
}

export function toggleAttach(
  prev: ActivePlay,
  cardId: string,
  handCounts: Record<string, number>,
  cardCosts: Record<string, number>,
  capacity: number,
): ActivePlay {
  if (!prev) return prev
  const mods = [...prev.mods]
  const idx = mods.lastIndexOf(cardId)
  // if already attached, detach last occurrence
  if (idx !== -1) {
    mods.splice(idx, 1)
    return { ...prev, mods }
  }

  // compute available copies in hand, minus those already attached
  const inHand = handCounts[cardId] ?? 0
  const attachedCount = mods.filter((m) => m === cardId).length
  if (inHand - attachedCount <= 0) return prev

  // compute total cost if this card is added
  const currentCost = mods.reduce((s, m) => s + (cardCosts[m] ?? 0), 0)
  const additional = cardCosts[cardId] ?? 0
  if (currentCost + additional > capacity) return prev
  mods.push(cardId)
  return { ...prev, mods }
}

export function finalizeSelection(activePlay: ActivePlay): ActivePlaySelection | null {
  if (!activePlay) return null
  return { baseId: activePlay.baseId, mods: [...activePlay.mods] }
}

export function cancelSelection(activePlay: ActivePlay) {
  return null
}
