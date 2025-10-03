export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export interface Player {
  id: string;
  name: string;
  playerNumber: 1 | 2 | 3 | 4;
  teamNumber: 1 | 2;
  isHost: boolean;
  connected: boolean;
}

export interface Bid {
  playerNumber: number;
  amount: number | null;
  passed: boolean;
}

export interface PlayedCard {
  playerNumber: number;
  card: Card;
}

export interface Trick {
  trickNumber: number;
  cardsPlayed: PlayedCard[];
  winner: number | null;
  leadingSuit: Suit | null;
}

export type GamePhase = 'lobby' | 'dealing' | 'bidding' | 'trump_selection' | 'playing' | 'round_end' | 'game_over';

export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  currentPlayer: number;
  dealer: number;
  roundNumber: number;
  trumpSuit: Suit | null;
  highestBid: number;
  bidWinner: number | null;
  bids: Bid[];
  team1Score: number;
  team2Score: number;
  team1Tricks: number;
  team2Tricks: number;
  lastRoundWinner: number;
  currentTrick: Trick;
  tricks: Trick[];
  playerHands: Record<number, Card[]>;
  winner: number | null;
}
