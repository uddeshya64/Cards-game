import { Card, Suit, Rank } from '../types/game';

const suits: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const rankValues: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        suit,
        rank,
        id: `${suit}-${rank}`
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function dealCards(deck: Card[]): Record<number, Card[]> {
  const hands: Record<number, Card[]> = { 1: [], 2: [], 3: [], 4: [] };
  deck.forEach((card, index) => {
    const playerNumber = (index % 4) + 1;
    hands[playerNumber].push(card);
  });

  Object.keys(hands).forEach(key => {
    hands[Number(key)].sort((a, b) => {
      if (a.suit !== b.suit) {
        return suits.indexOf(a.suit) - suits.indexOf(b.suit);
      }
      return rankValues[a.rank] - rankValues[b.rank];
    });
  });

  return hands;
}

export function canPlayCard(card: Card, hand: Card[], leadingSuit: Suit | null): boolean {
  if (!leadingSuit) return true;

  const hasLeadingSuit = hand.some(c => c.suit === leadingSuit);
  if (!hasLeadingSuit) return true;

  return card.suit === leadingSuit;
}

export function determineWinner(
  cardsPlayed: { playerNumber: number; card: Card }[],
  leadingSuit: Suit,
  trumpSuit: Suit
): number {
  const trumpCards = cardsPlayed.filter(cp => cp.card.suit === trumpSuit);

  if (trumpCards.length > 0) {
    return trumpCards.reduce((highest, current) => {
      return rankValues[current.card.rank] > rankValues[highest.card.rank] ? current : highest;
    }).playerNumber;
  }

  const leadingSuitCards = cardsPlayed.filter(cp => cp.card.suit === leadingSuit);
  return leadingSuitCards.reduce((highest, current) => {
    return rankValues[current.card.rank] > rankValues[highest.card.rank] ? current : highest;
  }).playerNumber;
}

export function getSuitSymbol(suit: Suit): string {
  const symbols: Record<Suit, string> = {
    spades: '♠',
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣'
  };
  return symbols[suit];
}

export function getSuitColor(suit: Suit): string {
  return suit === 'hearts' || suit === 'diamonds' ? '#ef4444' : '#000000';
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
