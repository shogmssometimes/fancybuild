import React, {useEffect, useMemo, useState, useCallback, useRef} from 'react'
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
  hasBuiltDeck: false,
  hasShuffledDeck: false,
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
      hasBuiltDeck: parsed.hasBuiltDeck ?? false,
      hasShuffledDeck: parsed.hasShuffledDeck ?? false,
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
  const [attachWarningId, setAttachWarningId] = useState<string | null>(null)
  const [hasBuiltDeck, setHasBuiltDeck] = useState(initialState.hasBuiltDeck ?? false)
  const [hasShuffledDeck, setHasShuffledDeck] = useState(initialState.hasShuffledDeck ?? false)
  const [opsError, setOpsError] = useState<string | null>(null)
  const handListRef = useRef<HTMLDivElement | null>(null)
  const [handNavState, setHandNavState] = useState({ left: false, right: false })
  const [basePrompt, setBasePrompt] = useState<{ id: string; qty: number; name?: string } | null>(null)
  const [modPrompt, setModPrompt] = useState<{ id: string; qty: number; name?: string } | null>(null)
  const modLongPressTimer = useRef<number | null>(null)
  const modLongPressFired = useRef(false)

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

  // tap-to-add and long-press/right-click to remove (base cards)
  const longPressTimer = useRef<number | null>(null)
  const longPressFired = useRef(false)

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    longPressFired.current = false
  }

  const handleBaseIncrement = (cardId: string) => {
    if (builderState.isLocked) return
    adjustBaseCount(cardId, 1)
  }

  const handleBaseContext = (cardId: string) => {
    const current = builderState.baseCounts[cardId] ?? 0
    if (builderState.isLocked || current <= 0) return
    const cardName = getCard(cardId)?.name ?? cardId
    setBasePrompt({ id: cardId, qty: current, name: cardName })
  }

  const closeBasePrompt = () => setBasePrompt(null)

  const handleBaseRemoveAction = (removeAll: boolean) => {
    if (!basePrompt) return
    const currentQty = builderState.baseCounts[basePrompt.id] ?? 0
    const delta = removeAll ? -currentQty : -1
    if (delta !== 0) adjustBaseCount(basePrompt.id, delta)
    closeBasePrompt()
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

  const handleModIncrement = (cardId: string) => {
    if (builderState.isLocked) return
    adjustModCount(cardId, 1)
  }

  const handleModContext = (cardId: string) => {
    const current = builderState.modCounts[cardId] ?? 0
    if (builderState.isLocked || current <= 0) return
    const cardName = getCard(cardId)?.name ?? cardId
    setModPrompt({ id: cardId, qty: current, name: cardName })
  }

  const closeModPrompt = () => setModPrompt(null)

  const handleModRemoveAction = (removeAll: boolean) => {
    if (!modPrompt) return
    const currentQty = builderState.modCounts[modPrompt.id] ?? 0
    const delta = removeAll ? -currentQty : -1
    if (delta !== 0) adjustModCount(modPrompt.id, delta)
    closeModPrompt()
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
      return (
        <div key={id} className="discard-row">
          <div className="discard-name">{card?.name ?? id}</div>
          <div className="discard-actions">
            <span className="discard-count">x{g.count}</span>
            <button className="counter-btn" onClick={()=>returnDiscardGroupToDeck(id)}>Deck</button>
            <button
              className="counter-btn"
              onClick={()=>returnDiscardGroupToHand(id, true)}
              disabled={(builderState.hand ?? []).length >= (builderState.handLimit ?? DEFAULT_HAND_LIMIT)}
            >
              Hand
            </button>
          </div>
        </div>
      )
    })
  }, [builderState.discard, builderState.hand, builderState.handLimit, getCard, returnDiscardGroupToDeck, returnDiscardGroupToHand])

  const groupedHandStacks = useMemo(() => {
    const handList = builderState.hand ?? []
    return handList.map((entry, index) => {
      const id = entry.id
      const card = getCard(id)
      const typeLabel = card?.type ?? 'Base'
      const isBase = typeLabel.toLowerCase() === 'base'
      const isNull = (card?.type ?? '').toLowerCase() === 'null'
      const isQueuedModifier = !isBase && !!activePlay?.mods?.includes(id)
      const showAttachWarning = !isBase && attachWarningId === id
      const highlight = isBase && activePlay?.baseId === id
        ? 'Selected Base'
        : (isQueuedModifier ? 'Queued' : null)
      const canPlayBase = isBase && !activePlay
      const canAttach = !isBase && !!activePlay
      let modText: string | null = null
      let modTarget: string | null = null
      const details = card?.details ?? []
      if (!isBase && card?.text) {
        const m = card.text.match(/^(.*?)(?:\s*[•·]\s*|\s+)Target:\s*(.*)$/i)
        if (m) {
          modText = m[1]?.trim() || null
          modTarget = m[2]?.trim() || null
        } else {
          modText = card.text
        }
      }
      const effectDetails = !isBase ? details.filter((d: any) => d.label?.toLowerCase() === 'effect') : []
      const metaDetails = !isBase ? details.filter((d: any) => d.label?.toLowerCase() !== 'effect') : []

      const cardStyle: React.CSSProperties = {
        zIndex: 100 - index,
        flex: '0 0 215px',
        minWidth: 185,
        maxWidth: 226,
        scrollSnapAlign: 'start',
      }
      const typeClass = isBase ? 'base-type' : isNull ? 'null-type' : 'mod-type'

      return (
        <div key={`${id}-${index}`} className={`hand-card ${typeClass}`} style={cardStyle}>
          <div className="hand-content">
            <div className="hand-meta">
              <div>
                <div className="hand-title">{card?.name ?? id}</div>
                <div className="hand-subtitle">
                  <span className="hand-type">{typeLabel}</span>
                  {highlight && <span className="hand-pill accent">{highlight}</span>}
                </div>
              </div>
            </div>
            {!isBase && (
              <div className="text-body card-text hand-text">
                {showCardDetails ? (
                  <>
                    {effectDetails.length > 0 && (
                      <div className="effect-block">
                        {effectDetails.map((detail: any) => (
                          <div key={`${card?.id ?? id}-effect-${detail.label}`} className="effect-line">
                            {detail.value}
                          </div>
                        ))}
                      </div>
                    )}
                    {metaDetails.length > 0 && (
                      <dl className="meta-block">
                        {metaDetails.map((detail: any) => (
                          <React.Fragment key={`${card?.id ?? id}-meta-${detail.label}`}>
                            <dt>{detail.label}</dt>
                            <dd>{detail.value}</dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    )}
                  </>
                ) : (
                  <>
                    <div className="effect-block">
                      {modText && <div className="effect-line">{modText}</div>}
                      {!modText && card?.text && <div className="effect-line">{card.text}</div>}
                    </div>
                    <div className="meta-block">
                      {modTarget && <div className="target-line">Target: {modTarget}</div>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="hand-actions">
            {isBase ? (
              <button onClick={() => startPlayBase(id)} disabled={!canPlayBase}>Play Base</button>
            ) : (
              <button onClick={() => attachModifier(id)} disabled={false}>Attach</button>
            )}
            <button onClick={() => discardGroupFromHand(id, false, 'discarded')}>Discard</button>
          </div>
          {showAttachWarning && (
            <div className="hand-warning-overlay" role="status">
              <div className="hand-warning-text">Select a base before attaching modifiers.</div>
              <button className="hand-warning-dismiss" onClick={() => setAttachWarningId(null)} aria-label="Dismiss warning">Got it</button>
            </div>
          )}
        </div>
      )
    })
  }, [activePlay, builderState.hand, getCard, renderDetails, showCardDetails])

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
    setAttachWarningId(null)
    setActivePlay((prev) => startPlaySelection(prev, cardId))
  }

  function attachModifier(cardId: string) {
    if (nullId && cardId === nullId) {
      setOpsError('Null cards can only be discarded.')
      return
    }
    if (!activePlay?.baseId) {
      setOpsError('Select a base before attaching modifiers.')
      setAttachWarningId(cardId)
      return
    }
    if (!modIdSet.has(cardId)) return
    const handCounts = (builderState.hand ?? []).reduce<Record<string, number>>((acc, it) => {
      acc[it.id] = (acc[it.id] ?? 0) + 1
      return acc
    }, {})
    const cardCosts = Array.from(cardLookup.values()).reduce<Record<string, number>>((acc, c) => { acc[c.id] = c.cost ?? 0; return acc }, {})
    setOpsError(null)
    setAttachWarningId(null)
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
      <dl className="card-details text-body" style={{marginTop:15,marginBottom:0,width:'100%'}}>
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

  const updateHandNav = useCallback(() => {
    const el = handListRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setHandNavState({
      left: scrollLeft > 4,
      right: scrollLeft + clientWidth < scrollWidth - 4,
    })
  }, [])

  const scrollHand = useCallback((direction: -1 | 1) => {
    const el = handListRef.current
    if (!el) return
    const amount = Math.max(el.clientWidth * 0.9, 220)
    el.scrollBy({ left: direction * amount, behavior: 'smooth' })
    window.setTimeout(updateHandNav, 220)
  }, [updateHandNav])

  useEffect(() => {
    updateHandNav()
  }, [groupedHandStacks.length, updateHandNav])

  useEffect(() => {
    const onResize = () => updateHandNav()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [updateHandNav])

  const handFanStyle: React.CSSProperties = {
    marginTop: 10,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    width: 'calc(100vw + (var(--hand-bleed, 40px) * 2))',
    minWidth: 'calc(100vw + (var(--hand-bleed, 40px) * 2))',
    marginLeft: 'calc(-1 * var(--hand-bleed, 40px))',
    marginRight: 'calc(-1 * var(--hand-bleed, 40px))',
    boxSizing: 'border-box',
    padding: 'var(--hand-pad-block-start, 12px) calc(var(--hand-pad-inline, 22px) + var(--hand-bleed, 40px)) var(--hand-pad-block-end, 18px)',
    overflowX: 'auto',
    scrollSnapType: 'x mandatory',
    scrollPaddingInline: 'calc(var(--hand-pad-inline, 22px) + var(--hand-bleed, 40px) + 8px)',
    WebkitOverflowScrolling: 'touch',
  }

  const skillGridClass = `card-grid base-card-grid skill-grid${showBuilderSections ? ' deck-builder-skill-grid' : ''}`

  return (
    <>
    <main className="app-shell">

      {showBuilderSections && (
        <div className="page">
          <div className="page-header">
            <div>
              <h1>Engram Deck Builder</h1>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <ImportExportJSON filenamePrefix={exportPrefix} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {lockPill}
            </div>
          </div>
          <section className="summary-stack">
            <div>
              <div className="muted text-body">Base Cards</div>
              {showBaseCounters && <div className="stat-large">{simpleCounters ? baseTotal : `${baseTotal} / ${baseTarget}`}</div>}
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
              <div className="counter-inline" role="group" aria-label="Adjust null cards" style={{ marginTop: 4, justifyContent: 'center' }}>
                <button className="counter-btn" onClick={() => adjustNullCount(-1)} disabled={builderState.nullCount <= minNulls || builderState.isLocked}>-</button>
                <div className="counter-value counter-pill">{builderState.nullCount}</div>
                <button className="counter-btn" onClick={() => adjustNullCount(1)} disabled={builderState.isLocked}>+</button>
              </div>
              {!nullValid && <div className="status-warning text-body">Minimum of {minNulls} Nulls required.</div>}
            </div>
            {showModifierCapacity && (
              <div>
                <div className="muted text-body">Modifier Capacity</div>
                <div className="counter-inline" role="group" aria-label="Adjust modifier capacity" style={{ marginTop: 4, justifyContent: 'center' }}>
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
                <div className={skillGridClass}>
                  {baseCards.map((card) => {
                    const qty = builderState.baseCounts[card.id] ?? 0
                    const isSelectedBase = activePlay?.baseId === card.id
                    const startLongPress = () => {
                      if (builderState.isLocked) return
                      longPressFired.current = false
                      longPressTimer.current = window.setTimeout(() => {
                        longPressFired.current = true
                        handleBaseContext(card.id)
                      }, 600)
                    }
                    const cancelLongPress = () => {
                      if (longPressTimer.current) {
                        window.clearTimeout(longPressTimer.current)
                        longPressTimer.current = null
                      }
                      longPressFired.current = false
                    }
                    const endPress = () => {
                      const fired = longPressFired.current
                      longPressFired.current = false
                      cancelLongPress()
                      if (!fired) {
                        handleBaseIncrement(card.id)
                      }
                    }
                    return (
                      <div
                        key={card.id}
                        className={`card base-card ${isSelectedBase ? 'is-selected' : ''}`}
                        onContextMenu={(e) => { e.preventDefault(); handleBaseContext(card.id) }}
                        onPointerDown={startLongPress}
                        onPointerUp={endPress}
                        onPointerLeave={cancelLongPress}
                      >
                        <div className="card-header">
                          <div className="card-title" style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                            <div className="card-name">{card.name}</div>
                            <div className="counter-value counter-pill">{qty}</div>
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
                      const startModLongPress = () => {
                        if (builderState.isLocked || qty <= 0) return
                        modLongPressFired.current = false
                        modLongPressTimer.current = window.setTimeout(() => {
                          modLongPressFired.current = true
                          handleModContext(card.id)
                        }, 600)
                      }
                      const cancelModLongPress = () => {
                        if (modLongPressTimer.current) {
                          window.clearTimeout(modLongPressTimer.current)
                          modLongPressTimer.current = null
                        }
                        modLongPressFired.current = false
                      }
                      const endModPress = () => {
                        const fired = modLongPressFired.current
                        cancelModLongPress()
                        if (!fired) handleModIncrement(card.id)
                      }
                      return (
                        <div
                          key={card.id}
                          className={`card mod-card ${isAttached ? 'is-selected' : ''}`}
                          onContextMenu={(e) => { e.preventDefault(); handleModContext(card.id) }}
                          onPointerDown={startModLongPress}
                          onPointerUp={endModPress}
                          onPointerLeave={cancelModLongPress}
                        >
                          <div className="card-header" style={{ gap: 12 }}>
                            <div className="card-title" style={{ minWidth: 0, flex: '1 1 auto' }}>
                              <div className="card-name">{card.name}</div>
                              <div className="muted text-body">Cost {cost}</div>
                              {isAttached && <div className="accent text-footnote" style={{ marginTop: 4 }}>Attached</div>}
                            </div>
                            <div className="counter-value counter-pill" style={{ minWidth: 34, textAlign: 'center' }}>{qty}</div>
                          </div>
                          {!canAddMore && <div className="capacity-reached">Capacity reached</div>}
                          {showCardDetails && (!card.details || card.details.length === 0) && (
                            <div className="text-body card-text" style={{ marginTop: 15, marginBottom: 0 }}>
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
            <section className={skillGridClass}>
              <div style={{ marginBottom: 12 }}>
                <div className="hand-carousel">
                  <div
                    className="hand-track"
                    style={handFanStyle}
                    ref={handListRef}
                    onScroll={updateHandNav}
                  >
                    {groupedHandStacks.length > 0 ? groupedHandStacks : <div className="muted">No cards in hand</div>}
                  </div>
                  <div className="hand-nav hand-nav-with-count">
                    <button
                      className="hand-nav-btn"
                      onClick={() => scrollHand(-1)}
                      disabled={!handNavState.left}
                      aria-label="Scroll hand left"
                      type="button"
                    >
                      ‹
                    </button>
                    <div className="hand-count-inline text-body">
                      Hand: <strong>{(builderState.hand ?? []).length}</strong> / {builderState.handLimit ?? DEFAULT_HAND_LIMIT}
                    </div>
                    <button
                      className="hand-nav-btn"
                      onClick={() => scrollHand(1)}
                      disabled={!handNavState.right}
                      aria-label="Scroll hand right"
                      type="button"
                    >
                      ›
                    </button>
                  </div>
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
            <section className={skillGridClass}>
              <div>
                <h2>Deck Operations</h2>
                <div className="ops-toolbar">
                  <button
                    onClick={handleDraw}
                    disabled={(builderState.hand ?? []).length >= (builderState.handLimit ?? DEFAULT_HAND_LIMIT)}
                  >
                    Draw 1
                  </button>
                  <button
                    className={builderState.isLocked && hasBuiltDeck && !hasShuffledDeck ? 'cta-pulse' : undefined}
                    onClick={() => shuffleDeck()}
                  >
                    Shuffle
                  </button>
                  <button
                    className={builderState.isLocked && !hasBuiltDeck ? 'cta-pulse' : undefined}
                    onClick={() => generateDeck(true)}
                  >
                    Build Deck
                  </button>
                  <button
                    className={needsLock ? 'cta-pulse' : undefined}
                    onClick={() => toggleLockDeck()}
                  >
                    {builderState.isLocked ? 'Unlock Deck' : 'Lock Deck'}
                  </button>
                  {lockPill}
                </div>
                {opsError && <div className="ops-error">{opsError}</div>}
                <div style={{ marginTop: 12 }}>
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
                  <div style={{ marginTop: 12 }} className="text-body">
                    Cards Remaining: <strong>{(builderState.deck ?? []).length}</strong>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {/* Saved decks section removed */}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <div>
              <h3>Discard Pile</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                <div className="text-body">Discard Count: <strong>{(builderState.discard ?? []).length}</strong></div>
                <div className="muted text-body">Duplicates stacked</div>
              </div>
              <div className="discard-list">
                {groupedDiscardElements}
                {(groupedDiscardElements?.length ?? 0) === 0 && <div className="muted">Discard pile is empty</div>}
              </div>
            </div>
          </section>
        </div>
      )}

    </main>
      {basePrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#0f1625', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, width: 'min(320px, 90vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', color: '#fff', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Adjust {basePrompt.name ?? basePrompt.id}</div>
            <div style={{ color: 'rgba(255,255,255,0.75)' }}>Current count: {basePrompt.qty}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="counter-btn" style={{ flex: '1 1 120px' }} onClick={() => handleBaseRemoveAction(false)} disabled={builderState.isLocked}>Remove 1</button>
              <button className="counter-btn" style={{ flex: '1 1 120px' }} onClick={() => handleBaseRemoveAction(true)} disabled={builderState.isLocked}>Remove All</button>
              <button className="counter-btn" style={{ flex: '1 1 120px' }} onClick={closeBasePrompt}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {modPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#0f1625', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, width: 'min(320px, 90vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', color: '#fff', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Adjust {modPrompt.name ?? modPrompt.id}</div>
            <div style={{ color: 'rgba(255,255,255,0.75)' }}>Current count: {modPrompt.qty}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="counter-btn" style={{ flex: '1 1 120px' }} onClick={() => handleModRemoveAction(false)} disabled={builderState.isLocked}>Remove 1</button>
              <button className="counter-btn" style={{ flex: '1 1 120px' }} onClick={() => handleModRemoveAction(true)} disabled={builderState.isLocked}>Remove All</button>
              <button className="counter-btn" style={{ flex: '1 1 120px' }} onClick={closeModPrompt}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
