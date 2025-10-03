import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from '../types/game';

interface Player {
  id: string;
  room_id: string;
  user_id: string;
  player_name: string;
  player_number: number;
  team_number: number;
  is_host: boolean;
  connected: boolean;
}

interface GameStateDB {
  id: string;
  room_id: string;
  phase: string;
  current_player: number;
  dealer: number;
  round_number: number;
  trump_suit: string | null;
  highest_bid: number;
  bid_winner: number | null;
  team1_score: number;
  team2_score: number;
  team1_tricks: number;
  team2_tricks: number;
  last_round_winner: number;
  current_trick_number: number;
  winner: number | null;
}

interface BidDB {
  id: string;
  room_id: string;
  round_number: number;
  player_number: number;
  bid_amount: number | null;
  passed: boolean;
}

interface CurrentTrickDB {
  id: string;
  room_id: string;
  round_number: number;
  trick_number: number;
  player_number: number;
  card: Card;
  leading_suit: string | null;
  sequence: number;
}

export function useGameSubscription(roomId: string | null, currentUserId: string | null) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameStateDB | null>(null);
  const [bids, setBids] = useState<BidDB[]>([]);
  const [currentTrick, setCurrentTrick] = useState<CurrentTrickDB[]>([]);
  const [myHand, setMyHand] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    async function loadInitialData() {
      const [playersRes, gameStateRes, bidsRes, trickRes] = await Promise.all([
        supabase.from('players').select('*').eq('room_id', roomId).order('player_number'),
        supabase.from('game_state').select('*').eq('room_id', roomId).maybeSingle(),
        supabase.from('bids').select('*').eq('room_id', roomId).order('created_at'),
        supabase.from('current_trick').select('*').eq('room_id', roomId).order('sequence')
      ]);

      if (playersRes.data) setPlayers(playersRes.data);
      if (gameStateRes.data) setGameState(gameStateRes.data);
      if (bidsRes.data) setBids(bidsRes.data);
      if (trickRes.data) setCurrentTrick(trickRes.data);

      if (currentUserId) {
        const myPlayer = playersRes.data?.find(p => p.user_id === currentUserId);
        if (myPlayer) {
          const { data: handData } = await supabase
            .from('player_hands')
            .select('cards')
            .eq('room_id', roomId)
            .eq('player_number', myPlayer.player_number)
            .maybeSingle();

          if (handData) setMyHand(handData.cards as Card[]);
        }
      }

      setLoading(false);
    }

    loadInitialData();

    const playersChannel = supabase
      .channel(`players:${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setPlayers(prev => [...prev, payload.new as Player].sort((a, b) => a.player_number - b.player_number));
        } else if (payload.eventType === 'UPDATE') {
          setPlayers(prev => prev.map(p => p.id === payload.new.id ? payload.new as Player : p));
        } else if (payload.eventType === 'DELETE') {
          setPlayers(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();

    const gameStateChannel = supabase
      .channel(`game_state:${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_state',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          setGameState(payload.new as GameStateDB);
        }
      })
      .subscribe();

    const bidsChannel = supabase
      .channel(`bids:${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bids',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setBids(prev => [...prev, payload.new as BidDB]);
        } else if (payload.eventType === 'DELETE') {
          setBids([]);
        }
      })
      .subscribe();

    const trickChannel = supabase
      .channel(`current_trick:${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'current_trick',
        filter: `room_id=eq.${roomId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCurrentTrick(prev => [...prev, payload.new as CurrentTrickDB].sort((a, b) => a.sequence - b.sequence));
        } else if (payload.eventType === 'DELETE') {
          setCurrentTrick([]);
        }
      })
      .subscribe();

    let handsChannel: any = null;
    if (currentUserId) {
      const myPlayer = players.find(p => p.user_id === currentUserId);
      if (myPlayer) {
        handsChannel = supabase
          .channel(`player_hands:${roomId}:${myPlayer.player_number}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'player_hands',
            filter: `room_id=eq.${roomId}`
          }, async (payload) => {
            if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
              const handUpdate = payload.new as any;
              if (handUpdate.player_number === myPlayer.player_number) {
                setMyHand(handUpdate.cards as Card[]);
              }
            }
          })
          .subscribe();
      }
    }

    return () => {
      playersChannel.unsubscribe();
      gameStateChannel.unsubscribe();
      bidsChannel.unsubscribe();
      trickChannel.unsubscribe();
      if (handsChannel) handsChannel.unsubscribe();
    };
  }, [roomId, currentUserId, players.length]);

  return {
    players,
    gameState,
    bids,
    currentTrick,
    myHand,
    loading
  };
}
