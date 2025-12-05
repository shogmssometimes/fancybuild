import React, {useEffect, useMemo, useState, useCallback, useRef} from 'react'
import Pager from '../components/Pager'
import ImportExportJSON from '../components/ImportExportJSON'
import { startPlaySelection, toggleAttach, finalizeSelection, cancelSelection, ActivePlay } from '../utils/playFlow'
import { getModCapacityUsed, canAddModCardFrom } from '../utils/modCapacity'
import { validateImportedDeck } from '../utils/deckExportImport'
import Handbook from '../data/handbook'
import { Card } from '../domain/decks/DeckEngine'

const DEFAULT_BASE_TARGET = 26
const DEFAULT_MIN_NULLS = 5
const MAX_PAGE_INDEX = 1
const DEFAULT_STORAGE_KEY = 'collapse.deck-builder.v2'
const DEFAULT_MODIFIER_CAPACITY = 10

type CountMap = Record<string, number>

type DeckBuilderState = {
  baseCounts: CountMap
  modCounts: CountMap
  nullCount: number
  modifierCapacity: number
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
  handLimit: 5,
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
      handLimit: parsed.handLimit ?? 5,
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

  const [builderState, setBuilderState] = useState(() =>
    applyInitialCounts(loadState(baseCards, modCards, storageKey, minNulls, modifierCapacityDefault))
  )
  const [modSearch, setModSearch] = useState('')
  const [deckSeed, setDeckSeed] = useState(0)
  const [activePlay, setActivePlay] = useState<ActivePlay>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [compactView, setCompactView] = useState(true)
  const [dragOffset, setDragOffset] = useState(0)
  const [dockOpen, setDockOpen] = useState(false)
  const [dockView, setDockView] = useState<'deck' | 'hand' | 'discard'>('deck')
  const dragStartRef = useRef<number | null>(null)
  const pointerDownRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, JSON.stringify(builderState))
  }, [builderState, storageKey])

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

  // Mouse move/up handlers attached to window for desktop drag support
  function onWindowMouseMove(e: MouseEvent) {
    if (!pointerDownRef.current || dragStartRef.current === null) return
    const delta = e.clientX - (dragStartRef.current ?? 0)
    setDragOffset(delta)
  }

  function onWindowMouseUp(e: MouseEvent) {
    if (!pointerDownRef.current) return
    const delta = dragOffset
    pointerDownRef.current = false
    dragStartRef.current = null
    setDragOffset(0)
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
    if (Math.abs(delta) > 60) {
      if (delta < 0) setPageIndex((p) => Math.min(MAX_PAGE_INDEX, p + 1))
      else setPageIndex((p) => Math.max(0, p - 1))
    }
  }

  // keyboard left/right navigation for pager
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') setPageIndex((p) => Math.min(MAX_PAGE_INDEX, p + 1))
      if (e.key === 'ArrowLeft') setPageIndex((p) => Math.max(0, p - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
    setBuilderState((prev) => ({ ...prev, deck: newDeck }))
    setDeckSeed((s) => s + 1)
  }

  const shuffleDeck = () => {
    setBuilderState((prev) => ({ ...prev, deck: prev.deck ? shuffleInPlace([...prev.deck]) : [] }))
    setDeckSeed((s) => s + 1)
  }

  // Draw a single card to hand (only allowed when deck is locked)
  const draw = () => {
    setBuilderState((prev) => {
      // disallow drawing when deck isn't locked
      if (!prev.isLocked) return prev
      // disallow drawing when hand is at or above the limit; this prevents
      // returning discard to the deck (which turns a draw into a discard)
      if ((prev.hand ?? []).length >= (prev.handLimit ?? 5)) return prev
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
    setBuilderState((prev) => ({ ...prev, deck: shuffleInPlace(newDeck), hand: [], discard: [] }))
    setDeckSeed((s) => s + 1)
  }

  // Toggle compact view already exists; ensure HUD page can be navigated

  // Lock / Unlock the deck (save)
  const toggleLockDeck = () => {
    setBuilderState((prev) => {
      const nextLocked = !prev.isLocked
      if (nextLocked) {
        const built = shuffleInPlace(buildDeckArray())
        return { ...prev, isLocked: nextLocked, deck: built, hand: [], discard: [] }
      }
      return { ...prev, isLocked: nextLocked }
    })
    setDeckSeed((s) => s + 1)
  }
  const toggleDock = () => setDockOpen((v) => !v)
  const openChud = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('chud-open'))
    }
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
      }
    })
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
      const handLimit = prev.handLimit ?? 5
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
      const handLimit = prev.handLimit ?? 5
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
        <div key={id} className={`card base-card small-card compact`}>
          <div className="card-header">
            <div className="card-title"><div className="card-name">{card?.name ?? id} <span className="muted text-section">(x{g.count})</span></div></div>
            <div className="card-controls">
              <button className="counter-btn" onClick={()=>returnDiscardGroupToDeck(id)}>Deck</button>
              <button className="counter-btn" onClick={()=>returnDiscardGroupToHand(id, true)} disabled={(builderState.hand ?? []).length >= (builderState.handLimit ?? 5)}>Hand</button>
            </div>
          </div>
          <div className="muted text-body">Stacked</div>
          <div style={{marginTop:8}}>{renderDetails(card ?? {id, name:id, type:'', cost:0, text:'' as any})}</div>
          
        </div>
      )
    })
  }, [builderState.discard, builderState.hand, builderState.handLimit])

  const groupedHandStacks = (() => {
    const groups = (builderState.hand ?? []).reduce((acc: Record<string, {count:number}>, entry) => {
      const g = acc[entry.id] ?? { count: 0 }
      g.count += 1
      acc[entry.id] = g
      return acc
    }, {} as Record<string, {count:number}>)

    return Object.entries(groups).map(([id, group]) => {
      const card = getCard(id)
      const typeLabel = card?.type ?? 'Base'
      const isBase = typeLabel.toLowerCase() === 'base'
      const isQueuedModifier = !isBase && !!activePlay?.mods?.includes(id)
      const highlight = isBase && activePlay?.baseId === id
        ? 'Selected Base'
        : (isQueuedModifier ? 'Queued' : null)
      const canPlayBase = isBase && !activePlay
      const canAttach = !isBase && !!activePlay

      return (
        <div key={id} className="hand-card">
          <div className="hand-meta">
            <div>
              <div className="hand-title">{card?.name ?? id}</div>
              <div className="hand-subtitle">
                <span className="hand-type">{typeLabel}</span>
                <span className="hand-count">x{group.count}</span>
                {highlight && <span className="hand-pill accent">{highlight}</span>}
              </div>
            </div>
          </div>
          <div className="hand-actions">
            {isBase ? (
              <button onClick={() => startPlayBase(id)} disabled={!canPlayBase}>Play Base</button>
            ) : (
              <button onClick={() => attachModifier(id)} disabled={!canAttach}>Attach</button>
            )}
            <button onClick={() => playSingleFromHand(id)}>Play</button>
            <button onClick={() => discardGroupFromHand(id, false, 'discarded')}>Discard One</button>
            {group.count > 1 && (
              <button onClick={() => discardGroupFromHand(id, true, 'discarded')}>Discard Stack</button>
            )}
          </div>
          {!isBase && !activePlay && (
            <div className="hand-hint">Select a base before attaching modifiers.</div>
          )}
        </div>
      )
    })
  })()

  const dockDeckGroups = useMemo(() => {
    const groups = (builderState.deck ?? []).reduce((acc: Record<string, number>, id) => {
      acc[id] = (acc[id] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(groups)
  }, [builderState.deck])

  const dockHandGroups = useMemo(() => {
    const groups = (builderState.hand ?? []).reduce((acc: Record<string, number>, h) => {
      acc[h.id] = (acc[h.id] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(groups)
  }, [builderState.hand])

  const dockDiscardGroups = useMemo(() => {
    const groups = (builderState.discard ?? []).reduce((acc: Record<string, number>, d) => {
      acc[d.id] = (acc[d.id] ?? 0) + 1
      return acc
    }, {})
    return Object.entries(groups)
  }, [builderState.discard])

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

  function playSingleFromHand(cardId: string) {
    setBuilderState((prev): DeckBuilderState => {
      const hand = [...(prev.hand ?? [])]
      const idx = hand.findIndex((h) => h.id === cardId)
      if (idx === -1) return prev
      const item = hand.splice(idx, 1)[0]
      const discardEntry: { id: string; origin: 'played' | 'discarded' } = { id: item.id, origin: 'played' }
      const discard = [...(prev.discard ?? []), discardEntry]
      return { ...prev, hand, discard }
    })
  }

  // Play flow handlers (use pure helpers)
  function startPlayBase(cardId: string) {
    setActivePlay((prev) => startPlaySelection(prev, cardId))
  }

  function attachModifier(cardId: string) {
    const handCounts = (builderState.hand ?? []).reduce<Record<string, number>>((acc, it) => {
      acc[it.id] = (acc[it.id] ?? 0) + 1
      return acc
    }, {})
    const cardCosts = Array.from(cardLookup.values()).reduce<Record<string, number>>((acc, c) => { acc[c.id] = c.cost ?? 0; return acc }, {})
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

  return (
    <main className="app-shell">

      <Pager pageIndex={pageIndex} onPageIndexChange={setPageIndex}>
          {/* Page 1: main builder UI (everything except Discard + Deck Operations) */}
          <div className="page">
            <div className="page-header">
                <div>
                  <h1>Engram Deck Builder</h1>
                  <p className="muted">Assemble decks with your chosen cards. Decks require {baseTarget} base cards, at least {minNulls} Nulls, and staying within modifier capacity.</p>
                  {/* Move export/import controls under the flavor text so they don't get squashed */}
                  <div style={{marginTop:8, display:'flex', gap:8, alignItems:'center'}}>
                      <ImportExportJSON filenamePrefix={exportPrefix} />
                      <button onClick={()=>setCompactView((c)=>!c)} aria-pressed={compactView} aria-label="Toggle compact view">{compactView ? 'Compact View' : 'Default View'}</button>
                    </div>
                </div>
              </div>
            <section className={`card-grid base-card-grid ${compactView ? 'compact' : ''}`}>
              <div>
                <div className="muted text-body">Base Cards</div>
                <div className="stat-large">
                  {simpleCounters ? baseTotal : `${baseTotal} / ${baseTarget}`}
                </div>
                {!baseValid && !simpleCounters && <div className="status-warning text-body">Deck must contain exactly {baseTarget} base cards.</div>}
                <div className="counter-inline" role="group" aria-label="Adjust base cards" style={{marginTop:8}}>
                  <button
                    className="counter-btn"
                    onClick={() => adjustPrimaryBaseCount(-1)}
                    disabled={builderState.isLocked}
                  >
                    -
                  </button>
                  <div className="counter-value counter-pill">{primaryBaseId ? (builderState.baseCounts[primaryBaseId] ?? 0) : baseTotal}</div>
                  <button
                    className="counter-btn"
                    onClick={() => adjustPrimaryBaseCount(1)}
                    disabled={builderState.isLocked || (!simpleCounters && baseTotal >= baseTarget)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <div className="muted text-body">Null Cards</div>
                <div className="stat-large">{builderState.nullCount}</div>
                <div className="counter-inline" role="group" aria-label="Adjust null cards" style={{marginTop:8}}>
                  <button
                    className="counter-btn"
                    onClick={() => adjustNullCount(-1)}
                    disabled={builderState.nullCount <= minNulls || builderState.isLocked}
                  >
                    -
                  </button>
                  <div className="counter-value counter-pill">{builderState.nullCount}</div>
                  <button
                    className="counter-btn"
                    onClick={() => adjustNullCount(1)}
                    disabled={builderState.isLocked}
                  >
                    +
                  </button>
                </div>
                {!nullValid && <div className="status-warning text-body">Minimum of {minNulls} Nulls required.</div>}
              </div>
              <div>
                <div className="muted text-body">Modifier Cards</div>
                <div className="stat-large">
                  {simpleCounters && modCapacityAsCount ? modCapacityUsed : `${modCapacityUsed} / ${builderState.modifierCapacity}`}
                </div>
                <div className="counter-inline" role="group" aria-label="Adjust modifier cards" style={{marginTop:8}}>
                  <button
                    className="counter-btn"
                    onClick={() => adjustPrimaryModCount(-1)}
                    disabled={builderState.isLocked}
                  >
                    -
                  </button>
                  <div className="counter-value counter-pill">{primaryModId ? (builderState.modCounts[primaryModId] ?? 0) : modCapacityUsed}</div>
                  <button
                    className="counter-btn"
                    onClick={() => adjustPrimaryModCount(1)}
                    disabled={builderState.isLocked || (!simpleCounters && !canAddModCard(primaryModId ?? ''))}
                  >
                    +
                  </button>
                </div>
                <div className="muted text-body" style={{marginTop:6}}>
                  {simpleCounters && modCapacityAsCount ? 'Mod Cards' : 'Mod Cards Used'}
                </div>
                {!modValid && <div className="status-error text-body">Reduce modifier cards or raise capacity.</div>}
              </div>
              <div>
                <div className="muted text-body">Deck Status</div>
                <div className={`stat-large ${deckIsValid ? 'status-success' : 'status-error'}`}>{deckIsValid ? 'Ready' : 'Needs Attention'}</div>
                <button onClick={resetBuilder} style={{marginTop:8}}>Reset Builder</button>
              </div>
            </section>
            

            <section className="compact">
              <h2>Base Cards</h2>
              <p className="muted" style={{ marginTop: 0 }}>Add base cards until you reach {baseTarget} total base cards.</p>
              <div className={`card-grid base-card-grid ${compactView ? 'compact' : ''} carousel`}>
                {baseCards.map((card) => {
                  const qty = builderState.baseCounts[card.id] ?? 0
                  const isSelectedBase = activePlay?.baseId === card.id
                  return (
                    <div key={card.id} className={`card base-card ${compactView ? 'compact' : ''} ${isSelectedBase ? 'is-selected' : ''}`}>
                      <div className="card-header">
                        <div className="card-title" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div className="card-name">{card.name}</div>
                          {isSelectedBase && <div className="accent text-footnote">Selected Base</div>}
                        </div>
                        <div className="card-controls">
                          <button className="counter-btn" onClick={() => adjustBaseCount(card.id, -1)} disabled={qty === 0 || builderState.isLocked}>-</button>
                          <div className="counter-value">{qty}</div>
                          <button className="counter-btn" onClick={() => adjustBaseCount(card.id, 1)} disabled={!simpleCounters && (baseTotal >= baseTarget || builderState.isLocked)}>+</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="compact" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ marginBottom: 4 }}>Modifier Cards</h2>
                  <p className="muted" style={{ marginTop: 0 }}>Each modifier consumes capacity equal to its card cost. Stay within your Engram Modifier Capacity.</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontWeight: 600 }}>Modifier Capacity</label>
                  <div className="counter-inline" role="group" aria-label="Adjust modifier capacity">
                    <button className="counter-btn" onClick={() => adjustModifierCapacity(-1)}>-</button>
                    <div className="counter-value counter-pill">{builderState.modifierCapacity}</div>
                    <button className="counter-btn" onClick={() => adjustModifierCapacity(1)}>+</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontWeight: 600 }}>Search Mods</label>
                  <input type="text" placeholder="Search name, target, effect" value={modSearch} onChange={(event) => setModSearch(event.target.value)} style={{ minWidth: 0, width: '100%' }} />
                </div>
              </div>

              <div className={`card-grid mod-card-grid ${compactView ? 'compact' : ''} carousel`}>
                {filteredModCards.map((card) => {
                  const qty = builderState.modCounts[card.id] ?? 0
                  const cost = card.cost ?? 0
                  const isAttached = activePlay?.mods?.includes(card.id)
                  return (
                    <div key={card.id} className={`card mod-card ${compactView ? 'compact' : ''} ${isAttached ? 'is-selected' : ''}`}>
                      <div className="card-header" style={{ gap: 12 }}>
                        <div className="card-title" style={{ minWidth: 0, flex: '1 1 auto' }}>
                          <div className="card-name">{card.name}</div>
                          <div className="muted text-body">Cost {cost}</div>
                          {isAttached && <div className="accent text-footnote" style={{ marginTop: 4 }}>Attached</div>}
                        </div>
                        <div className="card-controls">
                          <button className="counter-btn" onClick={() => adjustModCount(card.id, -1)} disabled={qty === 0 || builderState.isLocked}>-</button>
                          <div className="counter-value">{qty}</div>
                          <button className="counter-btn" onClick={() => adjustModCount(card.id, 1)} disabled={builderState.isLocked || (!simpleCounters && !canAddModCard(card.id))}>+</button>
                        </div>
                      </div>
                      {showCardDetails && card.text && <p className="text-body" style={{ margin: 0 }}>{card.text}</p>}
                      {renderDetails(card)}
                    </div>
                  )
                })}
              </div>
            </section>

          </div>

          {/* Page 2: Deck Operations + Discard Pile */}
          <div className="page">
            <section style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
              <div>
                <label style={{fontWeight:600}}>Hand Draw</label>
                <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
                  <button onClick={()=>draw()} disabled={!builderState.isLocked || ((builderState.hand ?? []).length >= (builderState.handLimit ?? 5))}>Draw 1</button>
                </div>

              </div>
            </section>

            <section className={`card-grid base-card-grid ${compactView ? 'compact' : ''}`}>
              <div>
                <h3>Hand</h3>
                <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
                  <div className="muted text-body">Duplicates stacked</div>
                </div>
                <div className="hand-stack">
                  {groupedHandStacks.length > 0 ? groupedHandStacks : <div className="muted">No cards in hand</div>}
                </div>
              </div>
            </section>

            {/* Discard Pile will be added after Deck Operations */}

            <section className={`card-grid base-card-grid ${compactView ? 'compact' : ''}`}>
              <div>
                <h2>Deck Operations</h2>
                <p className="muted" style={{marginTop:0}}>Shuffle, draw, and discard cards from your deck. Draw uses the top-of-deck (LIFO) model.</p>
                <div className="ops-toolbar">
                  <button onClick={()=>generateDeck(true)}>Build Deck</button>
                  <button onClick={()=>shuffleDeck()}>Shuffle</button>
                  <button onClick={()=>toggleLockDeck()}>{builderState.isLocked ? 'Unlock Deck' : 'Lock Deck'}</button>
                </div>
                <div style={{marginTop:12}}>
                  <div className="text-body">Deck Count: <strong>{(builderState.deck ?? []).length}</strong></div>
                  <div className="text-body">Discard Count: <strong>{(builderState.discard ?? []).length}</strong></div>
                    {activePlay && (
                    <div style={{marginTop:12,border:'1px solid #444',padding:8,borderRadius:8,background:'#0a0a0a'}}>
                      <div style={{fontWeight:700}}>Active Play</div>
                      <div className="muted text-section" style={{marginTop:6}}>Base: {cardLookup.get(activePlay.baseId)?.name ?? activePlay.baseId}</div>
                      <div className="muted text-body" style={{marginTop:6}}>Modifiers: {activePlay.mods.length}</div>
                      <div style={{display:'flex',gap:8,marginTop:8}}>
                        <button onClick={()=>finalizePlay()}>Finalize Play</button>
                        <button onClick={()=>cancelPlay()}>Cancel Play</button>
                      </div>
                    </div>
                  )}
                  <div style={{marginTop:8}}>
                    <label style={{fontWeight:600}}>Hand Limit</label>
                    <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
                      <input
                        type="number"
                        min={0}
                        value={builderState.handLimit ?? 5}
                        onChange={(e)=>{
                          const next = Number.parseInt(e.target.value, 10)
                          setBuilderState((prev)=> ({
                            ...prev,
                            handLimit: Number.isNaN(next) ? prev.handLimit ?? 5 : clamp(next, 0),
                          }))
                        }}
                        style={{width:80,maxWidth:'100%',textAlign:'center'}}
                      />
                      <div className="muted text-body">Active cap for hand cards.</div>
                    </div>
                  </div>
                  <div style={{marginTop:8}}>
                    <div style={{fontWeight:600}}>Saved Decks</div>
                    <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:6}}>
                      {Object.keys(builderState.savedDecks ?? {}).length === 0 && <div className="muted">No saved decks</div>}
                      {Object.entries(builderState.savedDecks ?? {}).map(([k,v])=> (
                        <div key={k} style={{display:'flex',gap:8,alignItems:'center'}}>
                          <div style={{minWidth:160}}>{v.name}</div>
                          <button onClick={()=>loadSavedDeck(k)}>Load</button>
                          <button onClick={()=>deleteSavedDeck(k)}>Delete</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
              <div>
                <h3>Discard Pile</h3>
                <div style={{display:'flex',gap:8,alignItems:'center',marginTop:8}}>
                  <div className="muted text-body">Duplicates stacked</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {groupedDiscardElements}
                  {(groupedDiscardElements?.length ?? 0) === 0 && (builderState.discard ?? []).map((item, idx) => {
            const card = getCard(item.id)
                    return (
                      <div key={idx} className={`card base-card small-card ${compactView ? 'compact' : ''}`}>
                        <div className="card-header">
                          <div className="card-title"><div className="card-name" style={{fontWeight:700}}>{card?.name ?? item.id}</div></div>
                          <div className="card-controls">
                            <button className="counter-btn" onClick={() => returnDiscardItemToDeck(idx)}>Deck</button>
                            <button className="counter-btn" onClick={() => returnDiscardItemToHand(idx)} disabled={(builderState.hand ?? []).length >= (builderState.handLimit ?? 5)}>Hand</button>
                          </div>
                        </div>
                        <div className="muted text-body">#{idx+1} • {item.origin === 'played' ? 'Played' : 'Discarded'}</div>
                        <div style={{marginTop:8}}>{renderDetails(card ?? {id:item.id,name:item.id,type:'',cost:0,text:'' as any})}</div>
                      </div>
                    )
                  })}
                  {((builderState.discard ?? []).length === 0) && <div className="muted">Discard pile is empty</div>}
                </div>
              </div>
            </section>
              </div>

          </Pager>

      <div className={`deck-dock ${dockOpen ? 'open' : ''}`} role="group" aria-label="Deck dock">
        <div className="deck-dock-top">
          <div className="deck-dock-handle" onClick={toggleDock} />
          <div className="deck-dock-stats">
            <span>Deck {builderState.deck?.length ?? 0}</span>
            <span>Hand {builderState.hand?.length ?? 0}</span>
            <span>Discard {builderState.discard?.length ?? 0}</span>
          </div>
          <div className="deck-dock-actions">
            <button onClick={toggleLockDeck}>{builderState.isLocked ? 'Unlock' : 'Build/Lock'}</button>
            <button onClick={shuffleDeck}>Shuffle</button>
            <button onClick={draw}>Draw 1</button>
            <button onClick={openChud}>cHUD</button>
          </div>
        </div>
        {dockOpen && (
          <div className="deck-dock-sheet">
            <div className="dock-tabs">
              {['deck','hand','discard'].map((tab) => (
                <button
                  key={tab}
                  className={`dock-tab ${dockView === tab ? 'active' : ''}`}
                  onClick={() => setDockView(tab as typeof dockView)}
                >
                  {tab === 'deck' ? 'Deck' : tab === 'hand' ? 'Hand' : 'Discard'}
                </button>
              ))}
            </div>
            <div className="dock-list">
              {dockView === 'deck' && (
                <div className="dock-chips">
                  {dockDeckGroups.map(([id, count]) => (
                    <div key={id} className="deck-chip row">
                      <span>{getCard(id)?.name ?? id}</span>
                      <span className="pill">x{count}</span>
                    </div>
                  ))}
                  {dockDeckGroups.length === 0 && <div className="muted">Deck is empty</div>}
                </div>
              )}
              {dockView === 'hand' && (
                <div className="dock-chips">
                  {dockHandGroups.map(([id, count]) => (
                    <div key={id} className="deck-chip row">
                      <span>{getCard(id)?.name ?? id}</span>
                      <span className="pill">x{count}</span>
                      <div className="chip-actions">
                        <button onClick={() => playSingleFromHand(id)}>Play</button>
                        <button onClick={() => discardGroupFromHand(id, false, 'discarded')}>Discard</button>
                      </div>
                    </div>
                  ))}
                  {dockHandGroups.length === 0 && <div className="muted">Hand is empty</div>}
                </div>
              )}
              {dockView === 'discard' && (
                <div className="dock-chips">
                  {dockDiscardGroups.map(([id, count]) => (
                    <div key={id} className="deck-chip row">
                      <span>{getCard(id)?.name ?? id}</span>
                      <span className="pill">x{count}</span>
                      <div className="chip-actions">
                        <button onClick={() => returnDiscardGroupToDeck(id, true)}>To Deck</button>
                        <button onClick={() => returnDiscardGroupToHand(id, true)} disabled={(builderState.hand ?? []).length >= (builderState.handLimit ?? 5)}>To Hand</button>
                      </div>
                    </div>
                  ))}
                  {dockDiscardGroups.length === 0 && <div className="muted">Discard is empty</div>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pager-nav" style={{display:'flex',justifyContent:'center',marginTop:12,gap:8}}>
          {[{i:0,label:'Builder'},{i:1,label:'Deck Ops'}].map(({i,label}) => (
            <div key={i} className={`pager-item`} aria-current={pageIndex === i} onClick={()=>setPageIndex(i)} style={{cursor:'pointer'}} role="button" aria-label={`Navigate to ${label}`}>
              <div className={`pager-dot ${pageIndex === i ? 'active' : ''}`} />
              <div className="pager-label">{label}</div>
            </div>
          ))}
        </div>
    </main>
  )
}
