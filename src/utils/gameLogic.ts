import { GameState, Bid } from '../types/game';

export function calculateScore(
  bidAmount: number,
  tricksWon: number,
  isBiddingTeam: boolean
): number {
  if (isBiddingTeam) {
    if (tricksWon >= bidAmount) {
      return bidAmount;
    } else {
      return -bidAmount * 2;
    }
  } else {
    return tricksWon;
  }
}

export function isGameOver(team1Score: number, team2Score: number): number | null {
  if (team1Score <= -52) return 2;
  if (team2Score <= -52) return 1;
  return null;
}

export function getNextPlayer(currentPlayer: number): number {
  return currentPlayer === 4 ? 1 : currentPlayer + 1;
}

export function getTeamFromPlayer(playerNumber: number): number {
  return playerNumber === 1 || playerNumber === 3 ? 1 : 2;
}

export function isBiddingComplete(bids: Bid[]): boolean {
  if (bids.length < 4) return false;

  const lastThreeBids = bids.slice(-3);
  const hasActiveBid = bids.some(b => !b.passed && b.amount !== null);

  return hasActiveBid && lastThreeBids.every(b => b.passed);
}

export function getHighestBid(bids: Bid[]): { amount: number; playerNumber: number } | null {
  const validBids = bids.filter(b => !b.passed && b.amount !== null);
  if (validBids.length === 0) return null;

  return validBids.reduce((highest, current) => {
    return (current.amount || 0) > (highest.amount || 0) ? current : highest;
  });
}

export function getMinimumBid(currentHighest: number): number {
  return currentHighest === 0 ? 7 : currentHighest + 1;
}

export function canBid(playerNumber: number, gameState: GameState): boolean {
  if (gameState.phase !== 'bidding') return false;
  if (gameState.currentPlayer !== playerNumber) return false;

  const playerBids = gameState.bids.filter(b => b.playerNumber === playerNumber);
  return playerBids.length === 0 || !playerBids[playerBids.length - 1].passed;
}
