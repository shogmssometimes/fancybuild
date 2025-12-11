import React, {useEffect, useMemo, useState, useCallback} from 'react'
import ImportExportJSON from '../components/ImportExportJSON'
import { startPlaySelection, toggleAttach, finalizeSelection, cancelSelection, ActivePlay } from '../utils/playFlow'
import { getModCapacityUsed, canAddModCardFrom } from '../utils/modCapacity'
import { validateImportedDeck } from '../utils/deckExportImport'
import Handbook from '../data/handbook'
import { Card } from '../domain/decks/DeckEngine'

const DEFAULT_BASE_TARGET = 26
const DEFAULT_MIN_NULLS = 5
const DEFAULT_STORAGE_KEY = 'collapse.deck-builder.v2'
const DEFAULT_MODIFIER_CAPACITY = 10
const DEFAULT_HAND_LIMIT = 5

type CountMap = Record<string, number>

type DeckBuilderState = {
  baseCounts: CountMap
  modCounts: CountMap
  nullCount: number
  modifierCapacity: number
  hasBuiltDeck?: boolean
  hasShuffledDeck?: boolean
  // runtime deck state
  deck?: string[]
  hand?: { id: string; state: 'unspent' | 'played' }[]
  discard?: { id: string; origin: 'played' | 'discarded' }[]
  isLocked?: boolean
  deckName?: string
  savedDecks?: Record<string, {
    name: string
    deck: string[]
    baseCounts: CountMap
    modCounts: CountMap
    nullCount: number
    modifierCapacity: number
  hasBuiltDeck?: boolean
  hasShuffledDeck?: boolean
    createdAt: string
  }>
  handLimit?: number
}

const clamp = (value: number, min: number, max?: number) => {
  if (value < min) return min
  if (typeof max === 'number' && value > max) return max
  return value
}

const sumCounts = (counts: CountMap) => Object.values(counts).reduce((sum, qty) => sum + qty, 0)

const buildInitialCounts = (cards: Card[]) =>
  cards.reduce<CountMap>((acc, card) => {
    acc[card.id] = 0
    return acc
  }, {})

const defaultState = (baseCards: Card[], modCards: Card[], minNulls: number, defaultModCapacity: number): DeckBuilderState => ({
  baseCounts: buildInitialCounts(baseCards),
  modCounts: buildInitialCounts(modCards),
  nullCount: minNulls,
  modifierCapacity: defaultModCapacity,
  deck: [],
  hand: [],
  discard: [],
  isLocked: false,
  deckName: '',
  savedDecks: {},
  handLimit: DEFAULT_HAND_LIMIT,
})

const loadState = (baseCards: Card[], modCards: Card[], storageKey: string, minNulls: number, defaultModCapacity: number): DeckBuilderState => {
  if (typeof window === 'undefined') return defaultState(baseCards, modCards, minNulls, defaultModCapacity)
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return defaultState(baseCards, modCards, minNulls, defaultModCapacity)
    const parsed = JSON.parse(raw) as DeckBuilderState
    return {
      baseCounts: { ...buildInitialCounts(baseCards), ...parsed.baseCounts },
      modCounts: { ...buildInitialCounts(modCards), ...parsed.modCounts },
      nullCount: Math.max(parsed.nullCount ?? minNulls, minNulls),
      modifierCapacity: parsed.modifierCapacity ?? defaultModCapacity,
      deck: parsed.deck ?? [],
      hand: parsed.hand ?? [],
      discard: parsed.discard ?? [],
      isLocked: parsed.isLocked ?? false,
      deckName: parsed.deckName ?? '',
      handLimit: parsed.handLimit ?? DEFAULT_HAND_LIMIT,
      savedDecks: parsed.savedDecks ?? {},
    }
  } catch {
    return defaultState(baseCards, modCards, minNulls, defaultModCapacity)
  }
}

type DeckBuilderProps = {
  storageKey?: string
  exportPrefix?: string
  baseCardsOverride?: Card[]
  modCardsOverride?: Card[]
  nullCardOverride?: Card
  baseTarget?: number
  minNulls?: number
  modifierCapacityDefault?: number
  showCardDetails?: boolean
  simpleCounters?: boolean
  modCapacityAsCount?: boolean
  baseInitialCount?: number
  modInitialCount?: number
  showBuilderSections?: boolean
  showOpsSections?: boolean
  showModifierCards?: boolean
  showModifierCardCounter?: boolean
  showModifierCapacity?: boolean
  showBaseCounters?: boolean
  showBaseAdjusters?: boolean
}

export default function DeckBuilder({
  storageKey = DEFAULT_STORAGE_KEY,
  exportPrefix = 'collapse-deck',
  baseCardsOverride,
  modCardsOverride,
  nullCardOverride,
  baseTarget = DEFAULT_BASE_TARGET,
  minNulls = DEFAULT_MIN_NULLS,
  modifierCapacityDefault = DEFAULT_MODIFIER_CAPACITY,
  showCardDetails = true,
  simpleCounters = false,
  modCapacityAsCount = false,
  baseInitialCount,
  modInitialCount,
  showBuilderSections = true,
  showOpsSections = true,
  showModifierCards = true,
  showModifierCardCounter = true,
  showModifierCapacity = true,
  showBaseCounters = true,
  showBaseAdjusters = true,
}: DeckBuilderProps){
  const baseCards = baseCardsOverride ?? (Handbook.baseCards ?? [])
  const modCards = modCardsOverride ?? (Handbook.modCards ?? [])
  const nullCard = nullCardOverride ?? Handbook.nullCards?.[0]

  const primaryBaseId = baseCards[0]?.id
  const primaryModId = modCards[0]?.id

  const applyInitialCounts = useCallback(
    (state: DeckBuilderState): DeckBuilderState => {
      if (!simpleCounters) return state
      const next: DeckBuilderState = {
        ...state,
        baseCounts: { ...state.baseCounts },
        modCounts: { ...state.modCounts },
      }
      const totalBase = sumCounts(next.baseCounts)
      const totalMod = sumCounts(next.modCounts)
      if (primaryBaseId && totalBase === 0) {
        next.baseCounts[primaryBaseId] = baseInitialCount ?? baseTarget
      }
      if (primaryModId && totalMod === 0) {
        next.modCounts[primaryModId] = modInitialCount ?? modifierCapacityDefault
      }
      return next
    },
    [baseInitialCount, baseTarget, modInitialCount, modifierCapacityDefault, primaryBaseId, primaryModId, simpleCounters]
  )

  const initialState = applyInitialCounts(loadState(baseCards, modCards, storageKey, minNulls, modifierCapacityDefault))
  const [builderState, setBuilderState] = useState(initialState)
  const [modSearch, setModSearch] = useState('')
  const [deckSeed, setDeckSeed] = useState(0)
  const [activePlay, setActivePlay] = useState<ActivePlay>(null)
  const compactView = false
  const [hasBuiltDeck, setHasBuiltDeck] = useState(initialState.hasBuiltDeck ?? false)
  const [hasShuffledDeck, setHasShuffledDeck] = useState(initialState.hasShuffledDeck ?? false)
  const [opsError, setOpsError] = useState<string | null>(null)
  const [handFocusIdx, setHandFocusIdx] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const payload = { ...builderState, hasBuiltDeck, hasShuffledDeck }
    window.localStorage.setItem(storageKey, JSON.stringify(payload))
  }, [builderState, storageKey, hasBuiltDeck, hasShuffledDeck])

  const baseTotal = sumCounts(builderState.baseCounts)
  const modCapacityUsed = useMemo(
    () => (modCapacityAsCount ? sumCounts(builderState.modCounts) : getModCapacityUsed(modCards, builderState.modCounts)),
    [builderState.modCounts, modCards, modCapacityAsCount]
  )

  const getModUsedSnapshot = useCallback(
    (state: DeckBuilderState) => (modCapacityAsCount ? sumCounts(state.modCounts ?? {}) : getModCapacityUsed(modCards, state.modCounts ?? {})),
    [modCapacityAsCount, modCards]
  )

  // enforce mod capacity when adding a modifier
  const canAddModCard = useCallback(
    (cardId: string) => {
      if (simpleCounters && modCapacityAsCount) return true
      if (modCapacityAsCount) {
        return getModUsedSnapshot(builderState) < (builderState.modifierCapacity ?? 0)
      }
      return canAddModCardFrom(modCards, builderState, cardId)
    },
    [builderState, getModUsedSnapshot, modCapacityAsCount, modCards, simpleCounters]
  )

  // pure helper: test if a card can be added given a state snapshot
  function canAddModCardSnapshot(state: DeckBuilderState, cardId: string) {
    if (simpleCounters && modCapacityAsCount) return true
    if (modCapacityAsCount) {
      return getModUsedSnapshot(state) < (state.modifierCapacity ?? 0)
    }
    return canAddModCardFrom(modCards, state, cardId)
  }

  const baseValid = simpleCounters ? true : baseTotal === baseTarget
  const nullValid = builderState.nullCount >= minNulls
  const modValid = simpleCounters && modCapacityAsCount ? true : modCapacityUsed <= builderState.modifierCapacity
  const deckIsValid = baseValid && nullValid && modValid
  const lockLabel = builderState.isLocked && hasBuiltDeck && hasShuffledDeck ? 'Deck Locked + Primed' : (builderState.isLocked ? 'Deck Locked' : 'Deck Unlocked')
  const lockPill = builderState.isLocked ? <span className="lock-pill locked">{lockLabel}</span> : <span className="lock-pill unlocked">{lockLabel}</span>

  // Mouse move/up handlers attached to window for desktop drag support
  const filteredModCards = useMemo(() => {
    if (simpleCounters) return modCards
    if (!modSearch.trim()) return modCards
    const needle = modSearch.trim().toLowerCase()
    return modCards.filter((card) =>
      [card.name, card.text, card.details?.map((d) => d.value).join(' ')].some((field) =>
        field?.toLowerCase().includes(needle)
      )
    )
  }, [modCards, modSearch, simpleCounters])

  const cardLookup = useMemo(() => {
    const all: Card[] = [...baseCards, ...modCards]
    if (nullCard) all.push(nullCard)
    return new Map(all.map((c) => [c.id, c]))
  }, [baseCards, modCards, nullCard])
  const baseIdSet = useMemo(() => new Set(baseCards.map((c) => c.id)), [baseCards])
  const modIdSet = useMemo(() => new Set(modCards.map((c) => c.id)), [modCards])
  const nullId = nullCard?.id ?? null

  const getCard = useCallback(
    (id: string) => cardLookup.get(id) ?? Handbook.getAllCards().find((c) => c.id === id),
    [cardLookup]
  )

  // utility: build a fresh deck array (ids repeated per counts)
  const buildDeckArray = () => {
    const out: string[] = []
    Object.entries(builderState.baseCounts).forEach(([id, qty]) => {
      for (let i = 0; i < qty; i++) out.push(id)
    })
    Object.entries(builderState.modCounts).forEach(([id, qty]) => {
      for (let i = 0; i < qty; i++) out.push(id)
    })
    // add nulls
    if (builderState.nullCount && nullCard) {
      for (let i = 0; i < builderState.nullCount; i++) out.push(nullCard.id)
    }
    return out
  }

  const shuffleInPlace = (arr: any[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  const generateDeck = (shuffle = true) => {
    const newDeck = buildDeckArray()
    if (shuffle) shuffleInPlace(newDeck)
    setBuilderState((prev) => ({ ...prev, deck: newDeck, hasBuiltDeck: true, hasShuffledDeck: false }))
    setDeckSeed((s) => s + 1)
    setHasBuiltDeck(true)
    setHasShuffledDeck(false)
    setOpsError(null)
  }

  const shuffleDeck = () => {
    setBuilderState((prev) => ({ ...prev, deck: prev.deck ? shuffleInPlace([...prev.deck]) : [], hasShuffledDeck: builderState.isLocked || prev.hasShuffledDeck }))
    setDeckSeed((s) => s + 1)
    if (builderState.isLocked) setHasShuffledDeck(true)
    setOpsError(null)
  }

  // Draw a single card to hand (only allowed when deck is locked)
  const draw = () => {
    setBuilderState((prev) => {
      // disallow drawing when deck isn't locked
      if (!prev.isLocked) return prev
      // disallow drawing when hand is at or above the limit; this prevents
      // returning discard to the deck (which turns a draw into a discard)
      if ((prev.hand ?? []).length >= (prev.handLimit ?? DEFAULT_HAND_LIMIT)) return prev
      let deck = [...(prev.deck ?? [])]
      const hand = [...(prev.hand ?? [])]
      const discard = [...(prev.discard ?? [])]

      // auto-build if deck and discard are empty (simple counter GM mode)
      if (deck.length === 0 && discard.length === 0) {
        deck = shuffleInPlace(buildDeckArray())
      }

      if (deck.length === 0) {
        // shuffle discard back in if deck is empty
        if (discard.length === 0) return { ...prev }
        const ids = discard.map((d) => d.id)
        shuffleInPlace(ids)
        // for LIFO model, append shuffled discard to the end (top)
        deck.push(...ids)
        discard.length = 0
      }
      // LIFO: draw from top-of-deck with pop
      const cardId = deck.pop()
      if (!cardId) return { ...prev, deck, hand, discard }
      // we already checked hand limit above, so adding is safe
      hand.push({ id: cardId, state: 'unspent' })
      return { ...prev, deck, hand, discard }
    })
    setDeckSeed((s) => s + 1)
  }

  // Remove discardFromDeck - deprecated in new UI; keep internal function to support automated flows
  const discardFromDeck = (count = 1) => {
    setBuilderState((prev) => {
      const deck = [...(prev.deck ?? [])]
      const discard = [...(prev.discard ?? [])]
      for (let i = 0; i < count; i++) {
        const cardId = deck.pop()
        if (!cardId) break
        discard.push({ id: cardId, origin: 'discarded' })
      }
      return { ...prev, deck, discard }
    })
    setDeckSeed((s) => s + 1)
  }

  const returnDiscardToDeck = (shuffle = true, toTop = true) => {
    setBuilderState((prev) => {
      const deck = [...(prev.deck ?? [])]
      const discard = [...(prev.discard ?? [])]
      // when returning discard to deck for FIFO, push them to the end (bottom) after shuffling
      const ids = discard.map((d) => d.id)
      if (shuffle) shuffleInPlace(ids)
      // For LIFO model: 'top' is the end of the array
      if (toTop) deck.push(...ids)
      else deck.unshift(...ids)
      if (shuffle) shuffleInPlace(deck)
      return { ...prev, deck, discard: [] }
    })
    setDeckSeed((s) => s + 1)
  }

  const resetDeck = () => {
    const newDeck = buildDeckArray()
    setBuilderState((prev) => ({ ...prev, deck: shuffleInPlace(newDeck), hand: [], discard: [], hasBuiltDeck: true, hasShuffledDeck: true }))
    setDeckSeed((s) => s + 1)
    setHasBuiltDeck(true)
    setHasShuffledDeck(true)
    setOpsError(null)
  }

  // Toggle compact view already exists; ensure HUD page can be navigated
  const needsLock = !builderState.isLocked
  const needsBuild = builderState.isLocked && !hasBuiltDeck
  const needsShuffle = builderState.isLocked && hasBuiltDeck && !hasShuffledDeck

  const handleDraw = () => {
    if (needsLock) {
      setOpsError('Lock the deck before drawing.')
      return
    }
    if (needsBuild) {
      setOpsError('Build the deck before drawing.')
      return
    }
    if (needsShuffle) {
      setOpsError('Shuffle the deck before drawing.')
      return
    }
    setOpsError(null)
    draw()
  }

  // Lock / Unlock the deck (save)
  const toggleLockDeck = () => {
    setBuilderState((prev) => {
      const nextLocked = !prev.isLocked
      if (nextLocked) {
        const built = shuffleInPlace(buildDeckArray())
        setHasBuiltDeck(false)
        setHasShuffledDeck(false)
        setOpsError('Build then shuffle before drawing.')
        return { ...prev, isLocked: nextLocked, deck: built, hand: [], discard: [], hasBuiltDeck: false, hasShuffledDeck: false }
      }
      setHasBuiltDeck(false)
      setHasShuffledDeck(false)
      setOpsError(null)
      return { ...prev, isLocked: nextLocked, hasBuiltDeck: false, hasShuffledDeck: false }
    })
    setDeckSeed((s) => s + 1)
  }

  const loadSavedDeck = (name: string) => {
    setBuilderState((prev) => {
      const sd = prev.savedDecks?.[name]
      if (!sd) return prev
      return {
        ...prev,
        deck: [...sd.deck],
        baseCounts: { ...sd.baseCounts },
        modCounts: { ...sd.modCounts },
        nullCount: sd.nullCount,
        modifierCapacity: sd.modifierCapacity,
        deckName: sd.name,
        isLocked: false,
        hand: [],
        discard: [],
        hasBuiltDeck: false,
        hasShuffledDeck: false,
      }
    })
    setHasBuiltDeck(false)
    setHasShuffledDeck(false)
    setOpsError(null)
  }

  const deleteSavedDeck = (name: string) => {
    setBuilderState((prev) => {
      if (!prev.savedDecks) return prev
      const copy = { ...prev.savedDecks }
      delete copy[name]
      return { ...prev, savedDecks: copy }
    })
  }

  // drawSize removed - we only allow Draw 1

  const adjustBaseCount = (cardId: string, delta: number) => {
    setBuilderState((prev) => {
      const current = prev.baseCounts[cardId] ?? 0
      const next = clamp(current + delta, 0)
      const prevTotal = sumCounts(prev.baseCounts)
      const newTotal = prevTotal - current + next
      if (!simpleCounters && newTotal > baseTarget) return prev
      return {
        ...prev,
        baseCounts: { ...prev.baseCounts, [cardId]: next },
      }
    })
  }

  const adjustPrimaryBaseCount = (delta: number) => {
    if (!primaryBaseId) return
    adjustBaseCount(primaryBaseId, delta)
  }

  const adjustModCount = (cardId: string, delta: number) => {
    setBuilderState((prev) => {
      if (prev.isLocked) return prev
      // use snapshot helper to determine if we can add this mod
      if (delta > 0 && !canAddModCardSnapshot(prev, cardId)) return prev

      return {
        ...prev,
        modCounts: {
          ...prev.modCounts,
          [cardId]: clamp((prev.modCounts[cardId] ?? 0) + delta, 0),
        },
      }
    })
  }

  const adjustPrimaryModCount = (delta: number) => {
    if (!primaryModId) return
    adjustModCount(primaryModId, delta)
  }

  const adjustNullCount = (delta: number) => {
    setBuilderState((prev) => ({
      ...prev,
      nullCount: clamp(prev.nullCount + delta, minNulls),
    }))
  }

  const adjustModifierCapacity = (delta: number) => {
    setBuilderState((prev) => ({
      ...prev,
      modifierCapacity: Math.max((prev.modifierCapacity ?? 0) + delta, 0),
    }))
  }

  const resetBuilder = () => {
    setBuilderState(applyInitialCounts(defaultState(baseCards, modCards, minNulls, modifierCapacityDefault)))
    setModSearch('')
    setHasBuiltDeck(false)
    setHasShuffledDeck(false)
    setOpsError(null)
  }

  // Moves a discard item back to the top of the deck
  const returnDiscardItemToDeck = (idx: number) => {
    setBuilderState((prev) => {
      const d = [...(prev.discard ?? [])]
      const it = d.splice(idx, 1)[0]
      const deck = [...(prev.deck ?? [])]
      deck.push(it.id)
      return { ...prev, discard: d, deck }
    })
  }

  // Moves all or one discard card of a given id back to the deck (top)
  function returnDiscardGroupToDeck(cardId: string, all = true) {
    setBuilderState((prev) => {
      const deck = [...(prev.deck ?? [])]
      const discard = [...(prev.discard ?? [])]
      if (all) {
        const idsToMove = discard.filter((d) => d.id === cardId).map((d) => d.id)
        const remaining = discard.filter((d) => d.id !== cardId)
        // push moved ids to the end (top)
        deck.push(...idsToMove)
        return { ...prev, discard: remaining, deck }
      }
      const idx = discard.findIndex((d) => d.id === cardId)
      if (idx === -1) return prev
      const it = discard.splice(idx, 1)[0]
      deck.push(it.id)
      return { ...prev, discard, deck }
    })
  }

  // Moves a discard item back to the hand (unspent)
  function returnDiscardItemToHand(idx: number) {
    setBuilderState((prev) => {
      const handLimit = prev.handLimit ?? DEFAULT_HAND_LIMIT
      if ((prev.hand ?? []).length >= handLimit) {
        // prevent returns that would exceed hand limit
        return prev
      }
      const d = [...(prev.discard ?? [])]
      const it = d.splice(idx, 1)[0]
      return { ...prev, discard: d, hand: [...(prev.hand ?? []), { id: it.id, state: 'unspent' }] }
    })
  }

  function returnDiscardGroupToHand(cardId: string, all = false) {
    setBuilderState((prev) => {
      const handLimit = prev.handLimit ?? DEFAULT_HAND_LIMIT
      const space = Math.max(0, handLimit - (prev.hand ?? []).length)
      if (space <= 0) return prev
      const discard = [...(prev.discard ?? [])]
      const moved: { id: string; origin: 'played' | 'discarded' }[] = []
      for (let i = discard.length - 1; i >= 0 && (moved.length < space); i--) {
        if (discard[i].id === cardId) {
          moved.push(discard.splice(i, 1)[0])
          if (!all) break
        }
      }
      if (moved.length === 0) return prev
      const newHand = [...(prev.hand ?? []), ...(moved.map((m) => ({ id: m.id, state: 'unspent' })) as { id: string; state: 'unspent' | 'played' }[])]
      return { ...prev, discard, hand: newHand }
    })
  }

  const groupedDiscardElements = useMemo(() => {
    const groups = (builderState.discard ?? []).reduce((acc: Record<string, {count:number, idxs:number[]}>, d, i) => {
      const g = acc[d.id] ?? {count:0, idxs:[]}
      g.count++
      g.idxs.push(i)
      acc[d.id] = g
      return acc
    }, {} as Record<string, {count:number, idxs:number[]}>)
    return Object.entries(groups).map(([id,g]) => {
      const card = getCard(id)
      const lowerType = (card?.type ?? '').toLowerCase()
      const isNullCard = (nullId && id === nullId) || lowerType === 'null'
      const isMod = modIdSet.has(id) && !isNullCard
      const typeLabel = isNullCard ? 'Null' : (isMod ? 'Modifier' : 'Base')
      let modText = ''
      let modTarget: string | null = null
      return (
        <div key={id} className={`hand-card card ${isMod ? 'mod-card' : 'base-card'}`}>
          <div className="card-header hand-card-header" style={{ gap: 12 }}>
            <div className="card-title" style={{ minWidth: 0, flex: '1 1 auto' }}>
              <div className="card-name">{card?.name ?? id} <span className="muted text-section">(x{g.count})</span></div>
              {isMod && <div className="muted text-body">Cost {card?.cost ?? 0}</div>}
              {!isMod && !isNullCard && <div className="muted text-body">Base</div>}
              {isNullCard && <div className="muted text-body">Null</div>}
              {isMod && (
                <div className="hand-subtitle">
                  <span className="hand-type">{typeLabel}</span>
                </div>
              )}
            </div>
            <div className="card-controls">
                          </div>
          </div>
          {isMod && renderDetails(card ?? { id, name: id, type: typeLabel, cost: card?.cost ?? 0, text: '' as any })}
        </div>
      )
    })
  }, [builderState.discard, builderState.hand, builderState.handLimit, getCard, modIdSet, nullId, returnDiscardGroupToDeck, returnDiscardGroupToHand])

  const groupedHandStacks = useMemo(() => {
    const handList = builderState.hand ?? []

    return handList.map((entry, idx) => {
      const id = entry.id
      const card = getCard(id)
      const lowerType = (card?.type ?? '').toLowerCase()
      const isNullCard = (nullId && id === nullId) || lowerType === 'null'
      const isMod = modIdSet.has(id) && !isNullCard
      const isBase = baseIdSet.has(id) || (!isMod && !isNullCard)
      const typeLabel = isNullCard ? 'Null' : (isMod ? 'Modifier' : 'Base')
      const isQueuedModifier = isMod && !!activePlay?.mods?.includes(id)
      const isSelectedBase = isBase && activePlay?.baseId === id
      const canSelectBase = isBase && !isNullCard
      const canAttach = isMod && !!activePlay?.baseId
      let modText = ''
      let modTarget: string | null = null

      const handCount = handList.length || 1
      const center = (handCount - 1) / 2
      const offset = idx - center
      const liftBase = 8
      const liftRange = 14
      const lift = liftBase + Math.max(0, 1 - Math.abs(offset) / Math.max(1, center || 1)) * liftRange

      const cardClass = `${isBase ? 'hand-card card base-card' : 'hand-card card mod-card'}${isSelectedBase ? ' selected-base' : ''}${isQueuedModifier ? ' attached-mod' : ''}`
      const handCardStyle = {
        ['--hand-offset' as any]: offset,
        ['--hand-index' as any]: idx,
        ['--hand-count' as any]: handCount,
        ['--hand-lift' as any]: `${lift}px`,
      } as React.CSSProperties

      return (
        <div key={`${id}-${idx}`} className={cardClass} style={handCardStyle}>
          <div className="card-header" style={{ gap: 12 }}>
            <div className="card-title" style={{ minWidth: 0, flex: '1 1 auto' }}>
              <div className="card-name">{card?.name ?? id}</div>
            </div>
          </div>
          {isNullCard && <div className="hand-hint">Null cards can only be discarded.</div>}
          {!canAttach && isMod && !activePlay && <div className="hand-hint">Select a base before attaching modifiers.</div>}
          {isMod && renderDetails(card ?? { id, name: id, type: typeLabel, cost: card?.cost ?? 0, text: '' as any })}
          <div className="hand-actions hand-actions-inline">
            <div className="hand-actions-right">
              {canSelectBase && (
                <button onClick={() => startPlayBase(id)} disabled={isSelectedBase}>
                  {isSelectedBase ? 'Selected' : 'Play Base'}
                </button>
              )}
              {isMod && (
                <button className="primary-btn" onClick={() => attachModifier(id)} disabled={!canAttach}>
                  {isQueuedModifier ? 'Detach' : 'Attach Mod'}
                </button>
              )}
              <button onClick={() => discardGroupFromHand(id, false, 'discarded')}>Discard</button>
            </div>
          </div>
        </div>
      )
    })
  }, [builderState.hand, activePlay, getCard, baseIdSet, modIdSet, nullId])

  // Move grouped items from hand to discard (single or all)
  function discardGroupFromHand(cardId: string, all = false, origin: 'played' | 'discarded' = 'discarded') {
    setBuilderState((prev) => {
      const hand = [...(prev.hand ?? [])]
      const removed: { id: string; state: 'unspent' | 'played' }[] = []
      if (all) {
        for (let i = hand.length - 1; i >= 0; i--) {
          if (hand[i].id === cardId) removed.push(hand.splice(i, 1)[0])
        }
      } else {
        const idx = hand.findIndex((h) => h.id === cardId)
        if (idx >= 0) removed.push(hand.splice(idx, 1)[0])
      }
      if (removed.length === 0) return prev
      const discard = [...(prev.discard ?? []), ...removed.map(r => ({ id: r.id, origin }))]
      return { ...prev, hand, discard }
    })
  }

  // Play flow handlers (use pure helpers)
  function startPlayBase(cardId: string) {
    if (nullId && cardId === nullId) {
      setOpsError('Null cards can only be discarded.')
      return
    }
    if (modIdSet.has(cardId)) {
      setOpsError('Select a base before playing modifiers.')
      return
    }
    setOpsError(null)
    setActivePlay((prev) => startPlaySelection(prev, cardId))
  }

  function attachModifier(cardId: string) {
    if (nullId && cardId === nullId) {
      setOpsError('Null cards can only be discarded.')
      return
    }
    if (!activePlay?.baseId) {
      setOpsError('Select a base before attaching modifiers.')
      return
    }
    if (!modIdSet.has(cardId)) return
    const handCounts = (builderState.hand ?? []).reduce<Record<string, number>>((acc, it) => {
      acc[it.id] = (acc[it.id] ?? 0) + 1
      return acc
    }, {})
    const cardCosts = Array.from(cardLookup.values()).reduce<Record<string, number>>((acc, c) => { acc[c.id] = c.cost ?? 0; return acc }, {})
    setOpsError(null)
    setActivePlay((prev) => toggleAttach(prev, cardId, handCounts, cardCosts, builderState.modifierCapacity))
  }

  function finalizePlay() {
    const sel = finalizeSelection(activePlay)
    if (!sel) return
    // move base and attached mods from hand into discard as 'played'
    discardGroupFromHand(sel.baseId, false, 'played')
    sel.mods.forEach((m) => discardGroupFromHand(m, false, 'played'))
    setActivePlay(null)
  }

  function cancelPlay() {
    setActivePlay(cancelSelection(activePlay))
  }


  function renderDetails(card: Card) {
    if (!showCardDetails) return null
    if (!card.details || card.details.length === 0) return null
    return (
      <dl className="card-details text-body" style={{marginTop:8,marginBottom:0,width:'100%'}}>
        {card.details.map((detail) => (
          <React.Fragment key={`${card.id}-${detail.label}`}>
            <dt style={{fontWeight:600}}>{detail.label}</dt>
            <dd style={{margin:0}}>{detail.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    )
  }

  const handCount = (builderState.hand ?? []).length
  const handHasSelection = !!activePlay?.baseId || (activePlay?.mods?.length ?? 0) > 0
  const handStackClass = `hand-stack${handHasSelection ? ' hand-has-active' : ''}`

  return (
    <main className="app-shell">

      {showBuilderSections && (
        <div className="page">
          <div className="page-header">
            <div>
              <h1>Engram Deck Builder</h1>
              <p className="muted">Assemble decks with your chosen cards. Decks require {baseTarget} base cards, at least {minNulls} Nulls, and staying within modifier capacity.</p>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <ImportExportJSON filenamePrefix={exportPrefix} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {lockPill}
            </div>
          </div>
          <section className="card-grid base-card-grid">
            <div>
              <div className="muted text-body">Base Cards</div>
              {showBaseCounters && <div className="stat-large">{simpleCounters ? baseTotal : `${baseTotal} / ${baseTarget}`}</div>}
              {!baseValid && !simpleCounters && <div className="status-warning text-body">Deck must contain exactly {baseTarget} base cards.</div>}
              {showBaseAdjusters && (
                <div className="counter-inline" role="group" aria-label="Adjust base cards" style={{ marginTop: 8 }}>
                  <button className="counter-btn" onClick={() => adjustPrimaryBaseCount(-1)} disabled={builderState.isLocked}>-</button>
                  <div className="counter-value counter-pill">{primaryBaseId ? (builderState.baseCounts[primaryBaseId] ?? 0) : baseTotal}</div>
                  <button className="counter-btn" onClick={() => adjustPrimaryBaseCount(1)} disabled={builderState.isLocked || (!simpleCounters && baseTotal >= baseTarget)}>+</button>
                </div>
              )}
            </div>

            <div>
              <div className="muted text-body">Null Cards</div>
              <div className="stat-large">{builderState.nullCount}</div>
              <div className="counter-inline" role="group" aria-label="Adjust null cards" style={{ marginTop: 8 }}>
                <button className="counter-btn" onClick={() => adjustNullCount(-1)} disabled={builderState.nullCount <= minNulls || builderState.isLocked}>-</button>
                <div className="counter-value counter-pill">{builderState.nullCount}</div>
                <button className="counter-btn" onClick={() => adjustNullCount(1)} disabled={builderState.isLocked}>+</button>
              </div>
              {!nullValid && <div className="status-warning text-body">Minimum of {minNulls} Nulls required.</div>}
            </div>
            {showModifierCapacity && (
              <div>
                <div className="muted text-body">Modifier Capacity</div>
                <div className="stat-large">{builderState.modifierCapacity}</div>
                <div className="counter-inline" role="group" aria-label="Adjust modifier capacity" style={{ marginTop: 8 }}>
                  <button className="counter-btn" onClick={() => adjustModifierCapacity(-1)}>-</button>
                  <div className="counter-value counter-pill">{builderState.modifierCapacity}</div>
                  <button className="counter-btn" onClick={() => adjustModifierCapacity(1)}>+</button>
                </div>
              </div>
            )}
            {showModifierCards && showModifierCardCounter && (
              <div>
                <div className="muted text-body">Modifier Cards</div>
                <div className="stat-large">
                  {simpleCounters && modCapacityAsCount ? modCapacityUsed : `${modCapacityUsed} / ${builderState.modifierCapacity}`}
                </div>
                <div className="counter-inline" role="group" aria-label="Adjust modifier cards" style={{ marginTop: 8 }}>
                  <button className="counter-btn" onClick={() => adjustPrimaryModCount(-1)} disabled={builderState.isLocked}>-</button>
                  <div className="counter-value counter-pill">{primaryModId ? (builderState.modCounts[primaryModId] ?? 0) : modCapacityUsed}</div>
                  <button className="counter-btn" onClick={() => adjustPrimaryModCount(1)} disabled={builderState.isLocked || (!simpleCounters && !canAddModCard(primaryModId ?? ''))}>+</button>
                </div>
                <div className="muted text-body" style={{ marginTop: 6 }}>
                  {simpleCounters && modCapacityAsCount ? 'Mod Cards' : 'Mod Cards Used'}
                </div>
                {!modValid && <div className="status-error text-body">Reduce modifier cards or raise capacity.</div>}
              </div>
            )}
            <div>
              <div className="muted text-body">Deck Status</div>
              <div className={`stat-large ${deckIsValid ? 'status-success' : 'status-error'}`}>{deckIsValid ? 'Ready' : 'Needs Attention'}</div>
              <button onClick={resetBuilder} style={{ marginTop: 8 }}>Reset Builder</button>
            </div>
          </section>

          {!simpleCounters && (
            <>
              <section className="compact">
                <div className="page-header" style={{ marginBottom: 6 }}>
                  <div>
                    <h2 style={{ marginBottom: 4 }}>Base Cards</h2>
                    <p className="muted" style={{ marginTop: 0 }}>Add base cards until you reach {baseTarget} total base cards.</p>
                  </div>
                  <div className="muted text-body">Tap a card to adjust counts.</div>
                </div>
                <div className="card-grid base-card-grid">
                  {baseCards.map((card) => {
                    const qty = builderState.baseCounts[card.id] ?? 0
                    const isSelectedBase = activePlay?.baseId === card.id
                    return (
                      <div key={card.id} className={`card base-card ${isSelectedBase ? 'is-selected' : ''}`}>
                        <div className="card-header">
                          <div className="card-title" style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                            <div className="card-name">{card.name}</div>
                            <div className="card-controls card-controls-bottom">
                              <button className="counter-btn" onClick={() => adjustBaseCount(card.id, -1)} disabled={qty === 0 || builderState.isLocked}>-</button>
                              <div className="counter-value">{qty}</div>
                              <button className="counter-btn" onClick={() => adjustBaseCount(card.id, 1)} disabled={baseTotal >= baseTarget || builderState.isLocked}>+</button>
                            </div>
                            {isSelectedBase && <div className="accent text-footnote">Selected Base</div>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {showModifierCards && (
                <section className="compact" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h2 style={{ marginBottom: 4 }}>Modifier Cards</h2>
                      <p className="muted" style={{ marginTop: 0 }}>Each modifier consumes capacity equal to its card cost. Stay within your Engram Modifier Capacity.</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontWeight: 600 }}>Search Mods</label>
                      <input type="text" placeholder="Search name, target, effect" value={modSearch} onChange={(event) => setModSearch(event.target.value)} style={{ minWidth: 0, width: '100%' }} />
                    </div>
                  </div>

                  <div className="card-grid mod-card-grid">
                    {filteredModCards.map((card) => {
                      const qty = builderState.modCounts[card.id] ?? 0
                      const cost = card.cost ?? 0
                      const isAttached = activePlay?.mods?.includes(card.id)
                      const canAddMore = canAddModCard(card.id)
                      let modText = card.text ?? ''
                      let modTarget: string | null = null
                      if (card.text) {
                        const m = card.text.match(/^(.*?)(?:\s*[•·]\s*|\s+)Target:\s*(.*)$/i)
                        if (m) {
                          modText = m[1].trim()
                          modTarget = m[2]?.trim() || null
                        }
                      }
                      return (
                        <div key={card.id} className={`card mod-card ${isAttached ? 'is-selected' : ''}`}>
                          <div className="card-header" style={{ gap: 12 }}>
                            <div className="card-title" style={{ minWidth: 0, flex: '1 1 auto' }}>
                              <div className="card-name">{card.name}</div>
                              <div className="muted text-body">Cost {cost}</div>
                              {isAttached && <div className="accent text-footnote" style={{ marginTop: 4 }}>Attached</div>}
                            </div>
                            <div className="card-controls">
                              <button className="counter-btn" onClick={() => adjustModCount(card.id, -1)} disabled={qty === 0 || builderState.isLocked}>-</button>
                              <div className="counter-value">{qty}</div>
                              <button className="counter-btn" onClick={() => adjustModCount(card.id, 1)} disabled={builderState.isLocked || !canAddMore}>+</button>
                            </div>
                          </div>
                          {!canAddMore && <div className="capacity-reached">Capacity reached</div>}
                          {showCardDetails && (!card.details || card.details.length === 0) && (
                            <div className="text-body card-text" style={{ margin: 0 }}>
                              {modText && <div>{modText}</div>}
                              {modTarget && <div className="target-line">Target: {modTarget}</div>}
                              {!modText && !modTarget && card.text && <div>{card.text}</div>}
                            </div>
                          )}
                          {renderDetails(card)}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {showOpsSections && (
        <div className="page">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section className="card-grid base-card-grid">
              <div style={{ marginBottom: 12 }}>
                <div
                  className={handStackClass}
                  style={{ marginTop: 10, ['--hand-count' as any]: handCount } as React.CSSProperties}
                >
                  {groupedHandStacks.length > 0 ? groupedHandStacks : <div className="muted">No cards in hand</div>}
                </div>
                <div className="text-body hand-count-row" style={{ marginTop: 8 }}>
                  Hand: <strong>{(builderState.hand ?? []).length}</strong> / {builderState.handLimit ?? DEFAULT_HAND_LIMIT}
                </div>
                {activePlay && (
                  <div className="play-overlay" style={{ marginTop: 8 }}>
                    <div className="play-overlay-header">
                      <div>
                        <div className="muted text-body">Current Play</div>
                        <div className="play-overlay-title">{cardLookup.get(activePlay.baseId)?.name ?? activePlay.baseId}</div>
                      </div>
                      <button onClick={() => cancelPlay()}>Clear</button>
                    </div>
                    <div className="play-overlay-body">
                      <div className="play-overlay-list">
                        <div className="muted text-body">Base</div>
                        <div>{cardLookup.get(activePlay.baseId)?.name ?? activePlay.baseId}</div>
                      </div>
                      <div className="play-overlay-list">
                        <div className="muted text-body">Modifiers</div>
                        {activePlay.mods.length === 0 && <div className="muted">None</div>}
                        {activePlay.mods.map((m) => (
                          <div key={m} className="play-overlay-mod">
                            <span className="play-overlay-mod-name">{cardLookup.get(m)?.name ?? m}</span>
                            <span className="play-attach-pill">Attached</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="play-overlay-actions">
                      <button onClick={() => finalizePlay()}>Finalize Play</button>
                      <button onClick={() => cancelPlay()}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Deck Operations directly below the hand */}
            <section className="card-grid base-card-grid">
              <div>
                <h2>Deck Operations</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {lockPill}
                  <button
                    className={needsLock ? 'cta-pulse' : undefined}
                    onClick={() => toggleLockDeck()}
                  >
                    {builderState.isLocked ? 'Unlock Deck' : 'Lock Deck'}
                  </button>
                </div>
                <p className="muted" style={{ marginTop: 0 }}>Shuffle, draw, and discard cards from your deck. Draw uses the top-of-deck (LIFO) model.</p>
                <div className="ops-toolbar">
                  <button
                    className={builderState.isLocked && !hasBuiltDeck ? 'cta-pulse' : undefined}
                    onClick={() => generateDeck(true)}
                  >
                    Build Deck
                  </button>
                  <button
                    className={builderState.isLocked && hasBuiltDeck && !hasShuffledDeck ? 'cta-pulse' : undefined}
                    onClick={() => shuffleDeck()}
                  >
                    Shuffle
                  </button>
                  <button
                    onClick={handleDraw}
                    disabled={(builderState.hand ?? []).length >= (builderState.handLimit ?? DEFAULT_HAND_LIMIT)}
                  >
                    Draw 1
                  </button>
                </div>
                {opsError && <div className="ops-error">{opsError}</div>}
                <div style={{ marginTop: 12 }}>
                  <div className="text-body">Deck Count: <strong>{(builderState.deck ?? []).length}</strong></div>
                  <div className="text-body">Discard Count: <strong>{(builderState.discard ?? []).length}</strong></div>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ fontWeight: 600 }}>Hand Limit</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                      <input
                        type="number"
                        min={0}
                        value={builderState.handLimit ?? DEFAULT_HAND_LIMIT}
                        onChange={(e) => {
                          const next = Number.parseInt(e.target.value, 10)
                          setBuilderState((prev) => ({
                            ...prev,
                            handLimit: Number.isNaN(next) ? prev.handLimit ?? DEFAULT_HAND_LIMIT : clamp(next, 0, DEFAULT_HAND_LIMIT),
                          }))
                        }}
                        style={{ width: 80, maxWidth: '100%', textAlign: 'center' }}
                      />
                      <div className="muted text-body">Active cap for hand cards.</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 600 }}>Saved Decks</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                      {Object.keys(builderState.savedDecks ?? {}).length === 0 && <div className="muted">No saved decks</div>}
                      {Object.entries(builderState.savedDecks ?? {}).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <div style={{ minWidth: 160 }}>{v.name}</div>
                          <button onClick={() => loadSavedDeck(k)}>Load</button>
                          <button onClick={() => deleteSavedDeck(k)}>Delete</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <div>
              <h3>Discard Pile</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <div className="muted text-body">Duplicates stacked</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {groupedDiscardElements}
                {(groupedDiscardElements?.length ?? 0) === 0 && (builderState.discard ?? []).map((item, idx) => {
                  const card = getCard(item.id)
                  const lowerType = (card?.type ?? '').toLowerCase()
                  const isNullCard = (nullId && item.id === nullId) || lowerType === 'null'
                  const isMod = modIdSet.has(item.id) && !isNullCard
                  const typeLabel = isNullCard ? 'Null' : (isMod ? 'Modifier' : 'Base')
                  let modText = card?.text ?? ''
                  let modTarget: string | null = null
                  if (isMod && card?.text) {
                    const m = card.text.match(/^(.*?)(?:\s*[•·]\s*|\s+)Target:\s*(.*)$/i)
                    if (m) {
                      modText = m[1].trim()
                      modTarget = m[2]?.trim() || null
                    }
                  }
                  return (
                    <div key={idx} className={`hand-card card ${isMod ? 'mod-card' : 'base-card'}`}>
                      <div className="card-header" style={{ gap: 12 }}>
                        <div className="card-title" style={{ minWidth: 0, flex: '1 1 auto' }}>
                          <div className="card-name" style={{ fontWeight: 700 }}>{card?.name ?? item.id}</div>
                          {isMod && <div className="muted text-body">Cost {card?.cost ?? 0}</div>}
                          {!isMod && !isNullCard && <div className="muted text-body">Base</div>}
                          {isNullCard && <div className="muted text-body">Null</div>}
                          {isMod && (
                            <div className="hand-subtitle">
                              <span className="hand-type">{typeLabel}</span>
                            </div>
                          )}
                        </div>
                        <div className="card-controls">
                                                  </div>
                      </div>
                      {isMod && (
                        <>
                          <div className="text-body card-text" style={{ margin: '8px 0 0 0' }}>
                            {modText && <div>{modText}</div>}
                            {modTarget && <div className="target-line">Target: {modTarget}</div>}
                            {!modText && !modTarget && card?.text && <div>{card.text}</div>}
                          </div>
                          {renderDetails(card ?? { id: item.id, name: item.id, type: typeLabel, cost: card?.cost ?? 0, text: '' as any })}
                        </>
                      )}
                      <div className="muted text-body">#{idx + 1} • {item.origin === 'played' ? 'Played' : 'Discarded'}</div>
                    </div>
                  )
                })}
                {((builderState.discard ?? []).length === 0) && <div className="muted">Discard pile is empty</div>}
              </div>
            </div>
          </section>
        </div>
      )}

    </main>
  )
}
