import { Copy, User, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useGameSubscription } from '../hooks/useGameSubscription';

interface LobbyProps {
  roomId: string;
  roomCode: string;
  currentUserId: string | null;
  onGameStart: () => void;
}

export default function Lobby({ roomId, roomCode, currentUserId, onGameStart }: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const { players, gameState, loading } = useGameSubscription(roomId, currentUserId);

  useEffect(() => {
    if (gameState && gameState.phase !== 'lobby') {
      onGameStart();
    }
  }, [gameState, onGameStart]);

  const handleCopyLink = () => {
    const link = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const playerSlots = [1, 2, 3, 4];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading lobby...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8 w-full max-w-2xl shadow-2xl">
        <h2 className="text-4xl font-bold text-white mb-2 text-center">Game Lobby</h2>
        <p className="text-slate-400 text-center mb-8">Waiting for players to join...</p>

        <div className="bg-slate-900/50 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm mb-1">Room Code</p>
              <p className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 tracking-wider">
                {roomCode}
              </p>
            </div>
            <button
              onClick={handleCopyLink}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-lg transition-all duration-200 font-semibold flex items-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {playerSlots.map((slotNumber) => {
            const player = players.find(p => p.player_number === slotNumber);
            const isCurrentPlayer = player?.user_id === currentUserId;

            return (
              <div
                key={slotNumber}
                className={`bg-slate-900/30 rounded-xl p-6 border-2 transition-all duration-300 ${
                  player
                    ? isCurrentPlayer
                      ? 'border-cyan-500 shadow-lg shadow-cyan-500/20'
                      : 'border-slate-600'
                    : 'border-dashed border-slate-700'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      player
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-500'
                        : 'bg-slate-700'
                    }`}
                  >
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-400 mb-1">
                      Player {slotNumber} {player?.is_host && '(Host)'}
                    </p>
                    <p className="text-white font-semibold">
                      {player ? player.player_name : 'Waiting...'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Team {slotNumber === 1 || slotNumber === 3 ? '1' : '2'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <p className="text-slate-400">
            {players.length < 4 ? (
              <>
                {4 - players.length} more {players.length === 3 ? 'player' : 'players'} needed to start
              </>
            ) : (
              <span className="text-cyan-400 font-semibold">
                Game starting soon...
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
