import { Card, Suit } from '../types/game';
import PlayingCard from './PlayingCard';
import { User } from 'lucide-react';
import { getSuitSymbol, canPlayCard } from '../utils/cardUtils';
import { useGameSubscription } from '../hooks/useGameSubscription';
import { placeBid, selectTrump, playCard } from '../services/gameService';

interface GameTableProps {
  roomId: string;
  currentUserId: string | null;
}

export default function GameTable({ roomId, currentUserId }: GameTableProps) {
  const { players, gameState, bids, currentTrick, myHand, loading } = useGameSubscription(roomId, currentUserId);

  if (loading || !gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  const currentPlayer = players.find(p => p.user_id === currentUserId);
  if (!currentPlayer) return null;

  const isMyTurn = gameState.current_player === currentPlayer.player_number;

  const getPlayerPosition = (playerNumber: number) => {
    const positions: Record<number, string> = {
      1: 'bottom-4 left-1/2 -translate-x-1/2',
      2: 'left-4 top-1/2 -translate-y-1/2',
      3: 'top-4 left-1/2 -translate-x-1/2',
      4: 'right-4 top-1/2 -translate-y-1/2'
    };
    return positions[playerNumber];
  };

  const getCardPosition = (playerNumber: number) => {
    const positions: Record<number, string> = {
      1: 'bottom-32 left-1/2 -translate-x-1/2',
      2: 'left-32 top-1/2 -translate-y-1/2',
      3: 'top-32 left-1/2 -translate-x-1/2',
      4: 'right-32 top-1/2 -translate-y-1/2'
    };
    return positions[playerNumber];
  };

  const renderPlayer = (playerNumber: number) => {
    const player = players.find(p => p.player_number === playerNumber);
    if (!player) return null;

    const isCurrentTurn = gameState.current_player === playerNumber;
    const playedCard = currentTrick.find(tc => tc.player_number === playerNumber);

    return (
      <>
        <div
          key={`player-${playerNumber}`}
          className={`absolute ${getPlayerPosition(playerNumber)} z-10`}
        >
          <div
            className={`bg-slate-800/90 backdrop-blur-sm rounded-xl p-3 border-2 transition-all duration-300 ${
              isCurrentTurn ? 'border-cyan-400 shadow-lg shadow-cyan-400/50' : 'border-slate-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCurrentTurn
                    ? 'bg-gradient-to-br from-cyan-500 to-blue-500 animate-pulse'
                    : 'bg-slate-700'
                }`}
              >
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{player.player_name}</p>
                <p className="text-slate-400 text-xs">
                  Team {player.team_number}
                </p>
              </div>
            </div>
          </div>
        </div>

        {playedCard && (
          <div
            key={`card-${playerNumber}`}
            className={`absolute ${getCardPosition(playerNumber)} z-20 animate-slide-in`}
          >
            <PlayingCard card={playedCard.card} size="md" />
          </div>
        )}
      </>
    );
  };

  const handleBid = async (amount: number | null) => {
    try {
      await placeBid(roomId, currentPlayer.player_number, amount, gameState.round_number);
    } catch (error) {
      console.error('Error placing bid:', error);
    }
  };

  const handleSelectTrump = async (suit: Suit) => {
    if (!gameState.bid_winner) return;
    try {
      await selectTrump(roomId, suit, gameState.bid_winner);
    } catch (error) {
      console.error('Error selecting trump:', error);
    }
  };

  const handlePlayCard = async (card: Card) => {
    try {
      await playCard(
        roomId,
        currentPlayer.player_number,
        card,
        gameState.round_number,
        gameState.current_trick_number
      );
    } catch (error) {
      console.error('Error playing card:', error);
    }
  };

  const renderBiddingUI = () => {
    if (gameState.phase !== 'bidding' || !isMyTurn) return null;

    const minBid = gameState.highest_bid === 0 ? 7 : gameState.highest_bid + 1;
    const bidOptions = [];
    for (let i = minBid; i <= 13; i++) {
      bidOptions.push(i);
    }

    return (
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-2xl p-8 border-2 border-cyan-500 shadow-2xl max-w-md w-full mx-4">
          <h3 className="text-2xl font-bold text-white mb-4 text-center">Your Bid</h3>
          {gameState.highest_bid > 0 && (
            <p className="text-slate-300 text-center mb-4">
              Current highest bid: <span className="font-bold text-cyan-400">{gameState.highest_bid}</span>
            </p>
          )}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {bidOptions.map(bid => (
              <button
                key={bid}
                onClick={() => handleBid(bid)}
                className="px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-lg font-bold transition-all duration-200 hover:scale-105"
              >
                {bid}
              </button>
            ))}
          </div>
          <button
            onClick={() => handleBid(null)}
            className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all duration-200"
          >
            Pass
          </button>
        </div>
      </div>
    );
  };

  const renderTrumpSelection = () => {
    if (gameState.phase !== 'trump_selection' || gameState.bid_winner !== currentPlayer.player_number) {
      return null;
    }

    const suits: Array<{ name: Suit; symbol: string; color: string }> = [
      { name: 'spades', symbol: '♠', color: 'text-slate-900' },
      { name: 'hearts', symbol: '♥', color: 'text-red-500' },
      { name: 'diamonds', symbol: '♦', color: 'text-red-500' },
      { name: 'clubs', symbol: '♣', color: 'text-slate-900' }
    ];

    return (
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-slate-800 rounded-2xl p-8 border-2 border-cyan-500 shadow-2xl max-w-md w-full mx-4">
          <h3 className="text-2xl font-bold text-white mb-2 text-center">Select Trump Suit</h3>
          <p className="text-slate-300 text-center mb-6">
            You won the bid with <span className="font-bold text-cyan-400">{gameState.highest_bid}</span> tricks
          </p>
          <div className="grid grid-cols-2 gap-4">
            {suits.map(suit => (
              <button
                key={suit.name}
                onClick={() => handleSelectTrump(suit.name)}
                className="p-8 bg-white hover:bg-slate-100 rounded-xl transition-all duration-200 hover:scale-105 shadow-lg"
              >
                <div className={`text-6xl ${suit.color}`}>{suit.symbol}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const leadingSuit = currentTrick.length > 0 ? (currentTrick[0].leading_suit as Suit | null) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-700/20 via-slate-900/50 to-slate-900"></div>

      <div className="absolute top-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 border border-slate-700 z-10">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Team 1</p>
            <p className="text-white font-bold text-xl">{gameState.team1_score}</p>
            <p className="text-slate-400 text-xs">Tricks: {gameState.team1_tricks}</p>
          </div>
          <div>
            <p className="text-slate-400">Team 2</p>
            <p className="text-white font-bold text-xl">{gameState.team2_score}</p>
            <p className="text-slate-400 text-xs">Tricks: {gameState.team2_tricks}</p>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-xl p-4 border border-slate-700 z-10">
        <p className="text-slate-400 text-sm">Round {gameState.round_number}</p>
        {gameState.trump_suit && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-slate-400 text-sm">Trump:</span>
            <span className="text-2xl">{getSuitSymbol(gameState.trump_suit as Suit)}</span>
          </div>
        )}
        {gameState.highest_bid > 0 && gameState.bid_winner && (
          <p className="text-slate-400 text-sm mt-2">
            Bid: <span className="text-white font-bold">{gameState.highest_bid}</span>
          </p>
        )}
      </div>

      <div className="relative w-full h-screen flex items-center justify-center">
        <div className="relative w-[800px] h-[600px]">
          {[1, 2, 3, 4].map(renderPlayer)}

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 rounded-full bg-slate-800/30 border-2 border-slate-700 shadow-inner"></div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
        <div className="flex justify-center gap-2 flex-wrap max-w-6xl mx-auto">
          {myHand.map((card) => {
            const isPlayable = isMyTurn &&
              gameState.phase === 'playing' &&
              canPlayCard(card, myHand, leadingSuit);

            return (
              <PlayingCard
                key={card.id}
                card={card}
                size="lg"
                onClick={isPlayable ? () => handlePlayCard(card) : undefined}
                playable={isPlayable}
              />
            );
          })}
        </div>
      </div>

      {renderBiddingUI()}
      {renderTrumpSelection()}
    </div>
  );
}
