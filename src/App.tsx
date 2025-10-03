import { useState, useEffect } from 'react';
import Home from './components/Home';
import Lobby from './components/Lobby';
import GameTable from './components/GameTable';
import { signUpAnonymously, getCurrentUser } from './services/authService';
import { createRoom, joinRoom } from './services/gameService';

function App() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [view, setView] = useState<'home' | 'lobby' | 'game'>('home');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const user = await getCurrentUser();
      if (user) {
        setCurrentUserId(user.id);
      }
      setLoading(false);
    }
    checkAuth();

    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setRoomCode(roomParam);
    }
  }, []);

  const handleCreateRoom = async (playerName: string) => {
    try {
      const authData = await signUpAnonymously(playerName);
      if (!authData.user) throw new Error('Failed to authenticate');

      setCurrentUserId(authData.user.id);

      const { roomId: newRoomId, roomCode: newRoomCode } = await createRoom(playerName, authData.user.id);

      setRoomId(newRoomId);
      setRoomCode(newRoomCode);
      setView('lobby');

      window.history.pushState({}, '', `?room=${newRoomCode}`);
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room. Please try again.');
    }
  };

  const handleJoinRoom = async (roomCodeInput: string, playerName: string) => {
    try {
      let userId = currentUserId;

      if (!userId) {
        const authData = await signUpAnonymously(playerName);
        if (!authData.user) throw new Error('Failed to authenticate');
        userId = authData.user.id;
        setCurrentUserId(userId);
      }

      const { roomId: joinedRoomId } = await joinRoom(roomCodeInput, playerName, userId);

      setRoomId(joinedRoomId);
      setRoomCode(roomCodeInput);
      setView('lobby');

      window.history.pushState({}, '', `?room=${roomCodeInput}`);
    } catch (error: any) {
      console.error('Error joining room:', error);
      alert(error.message || 'Failed to join room. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (view === 'home') {
    return <Home onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
  }

  if (view === 'lobby' && roomId) {
    return (
      <Lobby
        roomId={roomId}
        roomCode={roomCode}
        currentUserId={currentUserId}
        onGameStart={() => setView('game')}
      />
    );
  }

  if (view === 'game' && roomId) {
    return (
      <GameTable
        roomId={roomId}
        currentUserId={currentUserId}
      />
    );
  }

  return <Home onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
}

export default App;
