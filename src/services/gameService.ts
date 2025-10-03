import { supabase } from '../lib/supabase';
import { Card, Suit, Bid } from '../types/game';
import { createDeck, shuffleDeck, dealCards, generateRoomCode } from '../utils/cardUtils';

export async function createRoom(playerName: string, userId: string) {
  const roomCode = generateRoomCode();

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({
      room_code: roomCode,
      host_id: userId,
      status: 'waiting'
    })
    .select()
    .single();

  if (roomError) throw roomError;

  const { error: playerError } = await supabase
    .from('players')
    .insert({
      room_id: room.id,
      user_id: userId,
      player_name: playerName,
      player_number: 1,
      team_number: 1,
      is_host: true
    });

  if (playerError) throw playerError;

  const { error: gameStateError } = await supabase
    .from('game_state')
    .insert({
      room_id: room.id,
      phase: 'lobby'
    });

  if (gameStateError) throw gameStateError;

  return { roomId: room.id, roomCode };
}

export async function joinRoom(roomCode: string, playerName: string, userId: string) {
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id')
    .eq('room_code', roomCode)
    .maybeSingle();

  if (roomError) throw roomError;
  if (!room) throw new Error('Room not found');

  const { data: existingPlayers, error: playersError } = await supabase
    .from('players')
    .select('player_number')
    .eq('room_id', room.id)
    .order('player_number');

  if (playersError) throw playersError;

  if (existingPlayers.length >= 4) {
    throw new Error('Room is full');
  }

  const playerNumber = (existingPlayers.length + 1) as 1 | 2 | 3 | 4;
  const teamNumber = (playerNumber === 1 || playerNumber === 3 ? 1 : 2) as 1 | 2;

  const { error: insertError } = await supabase
    .from('players')
    .insert({
      room_id: room.id,
      user_id: userId,
      player_name: playerName,
      player_number: playerNumber,
      team_number: teamNumber,
      is_host: false
    });

  if (insertError) throw insertError;

  if (playerNumber === 4) {
    setTimeout(() => {
      startGame(room.id);
    }, 2000);
  }

  return { roomId: room.id, playerNumber };
}

export async function startGame(roomId: string) {
  const deck = shuffleDeck(createDeck());
  const hands = dealCards(deck);

  await supabase
    .from('rooms')
    .update({ status: 'playing' })
    .eq('id', roomId);

  await supabase
    .from('game_state')
    .update({ phase: 'dealing' })
    .eq('room_id', roomId);

  for (let playerNumber = 1; playerNumber <= 4; playerNumber++) {
    await supabase
      .from('player_hands')
      .insert({
        room_id: roomId,
        player_number: playerNumber,
        cards: hands[playerNumber]
      });
  }

  setTimeout(async () => {
    const { data: gameState } = await supabase
      .from('game_state')
      .select('last_round_winner')
      .eq('room_id', roomId)
      .single();

    await supabase
      .from('game_state')
      .update({
        phase: 'bidding',
        current_player: gameState?.last_round_winner || 1
      })
      .eq('room_id', roomId);
  }, 3000);
}

export async function placeBid(roomId: string, playerNumber: number, amount: number | null, roundNumber: number) {
  const { error } = await supabase
    .from('bids')
    .insert({
      room_id: roomId,
      round_number: roundNumber,
      player_number: playerNumber,
      bid_amount: amount,
      passed: amount === null
    });

  if (error) throw error;

  const { data: allBids } = await supabase
    .from('bids')
    .select('*')
    .eq('room_id', roomId)
    .eq('round_number', roundNumber)
    .order('created_at');

  if (!allBids) return;

  const highestBidData = allBids
    .filter(b => !b.passed && b.bid_amount !== null)
    .reduce((max, bid) => (bid.bid_amount || 0) > (max?.bid_amount || 0) ? bid : max, null as any);

  const highestBid = highestBidData?.bid_amount || 0;

  const lastThreeBids = allBids.slice(-3);
  const hasActiveBid = allBids.some(b => !b.passed && b.bid_amount !== null);
  const biddingComplete = hasActiveBid && lastThreeBids.every(b => b.passed);

  if (biddingComplete && highestBidData) {
    await supabase
      .from('game_state')
      .update({
        highest_bid: highestBid,
        bid_winner: highestBidData.player_number,
        phase: 'trump_selection'
      })
      .eq('room_id', roomId);
  } else {
    const nextPlayer = playerNumber === 4 ? 1 : playerNumber + 1;
    await supabase
      .from('game_state')
      .update({
        highest_bid: highestBid,
        current_player: nextPlayer
      })
      .eq('room_id', roomId);
  }
}

export async function selectTrump(roomId: string, suit: Suit, bidWinner: number) {
  const { error } = await supabase
    .from('game_state')
    .update({
      trump_suit: suit,
      phase: 'playing',
      current_player: bidWinner
    })
    .eq('room_id', roomId);

  if (error) throw error;
}

export async function playCard(roomId: string, playerNumber: number, card: Card, roundNumber: number, trickNumber: number) {
  const { data: existingCards } = await supabase
    .from('current_trick')
    .select('*')
    .eq('room_id', roomId)
    .eq('round_number', roundNumber)
    .eq('trick_number', trickNumber);

  const sequence = (existingCards?.length || 0) + 1;
  const leadingSuit = sequence === 1 ? card.suit : existingCards?.[0]?.leading_suit;

  await supabase
    .from('current_trick')
    .insert({
      room_id: roomId,
      round_number: roundNumber,
      trick_number: trickNumber,
      player_number: playerNumber,
      card: card,
      leading_suit: leadingSuit,
      sequence: sequence
    });

  const { data: hand } = await supabase
    .from('player_hands')
    .select('cards')
    .eq('room_id', roomId)
    .eq('player_number', playerNumber)
    .single();

  if (hand) {
    const updatedCards = (hand.cards as Card[]).filter(c => c.id !== card.id);
    await supabase
      .from('player_hands')
      .update({ cards: updatedCards })
      .eq('room_id', roomId)
      .eq('player_number', playerNumber);
  }

  if (sequence === 4) {
    await completeTrick(roomId, roundNumber, trickNumber);
  } else {
    const nextPlayer = playerNumber === 4 ? 1 : playerNumber + 1;
    await supabase
      .from('game_state')
      .update({ current_player: nextPlayer })
      .eq('room_id', roomId);
  }
}

async function completeTrick(roomId: string, roundNumber: number, trickNumber: number) {
  const { data: trickCards } = await supabase
    .from('current_trick')
    .select('*')
    .eq('room_id', roomId)
    .eq('round_number', roundNumber)
    .eq('trick_number', trickNumber)
    .order('sequence');

  if (!trickCards || trickCards.length !== 4) return;

  const { data: gameState } = await supabase
    .from('game_state')
    .select('trump_suit, team1_tricks, team2_tricks')
    .eq('room_id', roomId)
    .single();

  if (!gameState || !gameState.trump_suit) return;

  const leadingSuit = trickCards[0].leading_suit as Suit;
  const trumpSuit = gameState.trump_suit as Suit;

  const winner = determineWinner(
    trickCards.map(tc => ({ playerNumber: tc.player_number, card: tc.card as Card })),
    leadingSuit,
    trumpSuit
  );

  const winnerTeam = winner === 1 || winner === 3 ? 1 : 2;
  const newTeam1Tricks = winnerTeam === 1 ? gameState.team1_tricks + 1 : gameState.team1_tricks;
  const newTeam2Tricks = winnerTeam === 2 ? gameState.team2_tricks + 1 : gameState.team2_tricks;

  await supabase
    .from('completed_tricks')
    .insert({
      room_id: roomId,
      round_number: roundNumber,
      trick_number: trickNumber,
      cards_played: trickCards.map(tc => ({ player_number: tc.player_number, card: tc.card })),
      winner: winner,
      leading_suit: leadingSuit
    });

  await supabase
    .from('current_trick')
    .delete()
    .eq('room_id', roomId)
    .eq('round_number', roundNumber)
    .eq('trick_number', trickNumber);

  if (trickNumber === 13) {
    await endRound(roomId, roundNumber);
  } else {
    await supabase
      .from('game_state')
      .update({
        current_player: winner,
        current_trick_number: trickNumber + 1,
        team1_tricks: newTeam1Tricks,
        team2_tricks: newTeam2Tricks
      })
      .eq('room_id', roomId);
  }
}

function determineWinner(cardsPlayed: { playerNumber: number; card: Card }[], leadingSuit: Suit, trumpSuit: Suit): number {
  const rankValues: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

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

async function endRound(roomId: string, roundNumber: number) {
  const { data: gameState } = await supabase
    .from('game_state')
    .select('*')
    .eq('room_id', roomId)
    .single();

  if (!gameState) return;

  const bidderTeam = gameState.bid_winner === 1 || gameState.bid_winner === 3 ? 1 : 2;
  const bidderTeamTricks = bidderTeam === 1 ? gameState.team1_tricks : gameState.team2_tricks;
  const opponentTeamTricks = bidderTeam === 1 ? gameState.team2_tricks : gameState.team1_tricks;

  const bidderTeamScore = bidderTeamTricks >= gameState.highest_bid
    ? gameState.highest_bid
    : -gameState.highest_bid * 2;
  const opponentTeamScore = opponentTeamTricks;

  const newTeam1Score = bidderTeam === 1
    ? gameState.team1_score + bidderTeamScore
    : gameState.team1_score + opponentTeamScore;

  const newTeam2Score = bidderTeam === 2
    ? gameState.team2_score + bidderTeamScore
    : gameState.team2_score + opponentTeamScore;

  const gameWinner = newTeam1Score <= -52 ? 2 : newTeam2Score <= -52 ? 1 : null;

  if (gameWinner) {
    await supabase
      .from('game_state')
      .update({
        phase: 'game_over',
        team1_score: newTeam1Score,
        team2_score: newTeam2Score,
        winner: gameWinner
      })
      .eq('room_id', roomId);

    await supabase
      .from('rooms')
      .update({ status: 'finished' })
      .eq('id', roomId);
  } else {
    const roundWinner = bidderTeamScore > opponentTeamScore ? bidderTeam : (bidderTeam === 1 ? 2 : 1);

    await supabase
      .from('game_state')
      .update({
        phase: 'round_end',
        team1_score: newTeam1Score,
        team2_score: newTeam2Score,
        last_round_winner: roundWinner
      })
      .eq('room_id', roomId);

    await supabase
      .from('bids')
      .delete()
      .eq('room_id', roomId)
      .eq('round_number', roundNumber);

    setTimeout(() => {
      startNewRound(roomId, roundNumber + 1, roundWinner);
    }, 3000);
  }
}

async function startNewRound(roomId: string, newRoundNumber: number, startingPlayer: number) {
  const deck = shuffleDeck(createDeck());
  const hands = dealCards(deck);

  await supabase
    .from('game_state')
    .update({ phase: 'dealing' })
    .eq('room_id', roomId);

  for (let playerNumber = 1; playerNumber <= 4; playerNumber++) {
    await supabase
      .from('player_hands')
      .update({ cards: hands[playerNumber] })
      .eq('room_id', roomId)
      .eq('player_number', playerNumber);
  }

  setTimeout(async () => {
    await supabase
      .from('game_state')
      .update({
        phase: 'bidding',
        round_number: newRoundNumber,
        current_player: startingPlayer,
        trump_suit: null,
        highest_bid: 0,
        bid_winner: null,
        team1_tricks: 0,
        team2_tricks: 0,
        current_trick_number: 1
      })
      .eq('room_id', roomId);
  }, 3000);
}
