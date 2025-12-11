export type CardDetail = {
  label: string;
  value: string;
};

export type Card = {
  id: string;
  name: string;
  cost?: number;
  type?: string;
  text?: string;
  details?: CardDetail[];
};

export type DeckState = {
  library: Card[];
  hand: Card[];
  discard: Card[];
};

export class DeckEngine {
  private library: Card[] = [];
  private hand: Card[] = [];
  private discard: Card[] = [];

  constructor(initial: Card[] = []) {
    this.setLibrary(initial);
  }

  setLibrary(cards: Card[]) {
    this.library = [...cards];
    this.hand = [];
    this.discard = [];
  }

  getState(): DeckState {
    return { library: [...this.library], hand: [...this.hand], discard: [...this.discard] };
  }

  shuffle(seed?: number) {
    // Fisher-Yates
    for (let i = this.library.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.library[i], this.library[j]] = [this.library[j], this.library[i]];
    }
  }

  draw(count = 1): Card[] {
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      if (this.library.length === 0) break;
      // LIFO: draw from the top (end of array)
      const c = this.library.pop()!;
      this.hand.push(c);
      drawn.push(c);
    }
    return drawn;
  }

  drawToHandUntil(count: number) {
    while (this.hand.length < count && this.library.length) {
      this.draw(1);
    }
  }

  discardFromHand(index: number) {
    const [c] = this.hand.splice(index, 1);
    if (c) this.discard.push(c);
    return c;
  }

  playFromHand(index: number) {
    // For now, playing a card just moves it to discard
    return this.discardFromHand(index);
  }

  moveToTop(card: Card) {
    // For LIFO model, top is at the end -> push
    this.library.push(card);
  }

  returnDiscardToLibrary(shuffleBack = true) {
    // append discard to the end (top)
    this.library.push(...this.discard.splice(0));
    if (shuffleBack) this.shuffle();
  }

  addCardToLibrary(card: Card) {
    this.library.push(card);
  }

  removeCardFromLibraryById(id: string) {
    const idx = this.library.findIndex(c => c.id === id);
    if (idx >= 0) this.library.splice(idx, 1);
  }

  reset() {
    this.library = [];
    this.hand = [];
    this.discard = [];
  }
}

export default DeckEngine;
