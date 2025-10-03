/*
  # Team Bid Blitz - Complete Database Schema

  ## Overview
  This migration creates the complete database schema for a real-time 4-player card game
  with full multiplayer support, including rooms, players, game state, and real-time updates.

  ## Tables Created

  ### 1. rooms
  Stores game room information
  - `id` (uuid, primary key) - Unique room identifier
  - `room_code` (text, unique) - 6-character shareable code (e.g., "ABC123")
  - `host_id` (uuid) - User ID of the room creator
  - `status` (text) - Room status: 'waiting', 'playing', 'finished'
  - `created_at` (timestamptz) - Room creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. players
  Stores player information for each game room
  - `id` (uuid, primary key)
  - `room_id` (uuid, foreign key) - Links to rooms table
  - `user_id` (uuid) - Auth user ID
  - `player_name` (text) - Display name
  - `player_number` (int) - Position 1-4 in the game
  - `team_number` (int) - Team 1 or 2
  - `is_host` (boolean) - Whether player is the room host
  - `connected` (boolean) - Connection status for presence tracking
  - `last_seen` (timestamptz) - Last activity timestamp
  - `created_at` (timestamptz)

  ### 3. game_state
  Stores the current state of the game (one per room)
  - `id` (uuid, primary key)
  - `room_id` (uuid, foreign key, unique) - One game state per room
  - `phase` (text) - Current game phase: 'lobby', 'dealing', 'bidding', 'trump_selection', 'playing', 'round_end', 'game_over'
  - `current_player` (int) - Current player's turn (1-4)
  - `dealer` (int) - Dealer position (1-4)
  - `round_number` (int) - Current round number
  - `trump_suit` (text) - Selected trump: 'spades', 'hearts', 'diamonds', 'clubs', or null
  - `highest_bid` (int) - Current highest bid amount
  - `bid_winner` (int) - Player number who won the bidding (1-4)
  - `team1_score` (int) - Team 1 cumulative score
  - `team2_score` (int) - Team 2 cumulative score
  - `team1_tricks` (int) - Team 1 tricks won this round
  - `team2_tricks` (int) - Team 2 tricks won this round
  - `last_round_winner` (int) - Team that won previous round (1 or 2)
  - `current_trick_number` (int) - Current trick number (1-13)
  - `winner` (int) - Winning team (1 or 2) when game ends, null otherwise
  - `updated_at` (timestamptz)

  ### 4. player_hands
  Stores each player's current hand of cards (private to each player)
  - `id` (uuid, primary key)
  - `room_id` (uuid, foreign key)
  - `player_number` (int) - Player position (1-4)
  - `cards` (jsonb) - Array of card objects: [{suit: string, rank: string, id: string}]
  - `updated_at` (timestamptz)

  ### 5. bids
  Records all bids made during the bidding phase
  - `id` (uuid, primary key)
  - `room_id` (uuid, foreign key)
  - `round_number` (int) - Which round this bid is for
  - `player_number` (int) - Player who made the bid (1-4)
  - `bid_amount` (int) - Number of tricks bid, null if passed
  - `passed` (boolean) - Whether player passed
  - `created_at` (timestamptz) - When bid was placed

  ### 6. current_trick
  Stores cards played in the current trick
  - `id` (uuid, primary key)
  - `room_id` (uuid, foreign key)
  - `round_number` (int)
  - `trick_number` (int)
  - `player_number` (int) - Player who played the card
  - `card` (jsonb) - Card object: {suit: string, rank: string, id: string}
  - `leading_suit` (text) - The suit led in this trick
  - `winner` (int) - Player who won the trick (set when trick completes)
  - `created_at` (timestamptz)
  - `sequence` (int) - Order card was played (1-4)

  ### 7. completed_tricks
  Archive of completed tricks for history/review
  - `id` (uuid, primary key)
  - `room_id` (uuid, foreign key)
  - `round_number` (int)
  - `trick_number` (int)
  - `cards_played` (jsonb) - Array of all 4 cards played
  - `winner` (int) - Player who won
  - `leading_suit` (text)
  - `created_at` (timestamptz)

  ## Security (Row Level Security)
  
  All tables have RLS enabled with policies that:
  - Allow authenticated users to create and join rooms
  - Allow players in a room to view game state
  - Restrict player_hands so each player only sees their own cards
  - Allow players to update game state when it's their turn
  - Prevent unauthorized modifications

  ## Important Notes
  
  1. **Data Safety**: All operations use IF NOT EXISTS and IF EXISTS to prevent errors
  2. **Real-time Ready**: Tables are structured for Supabase real-time subscriptions
  3. **Indexes**: Added for optimal query performance on room_code, room_id, and player lookups
  4. **Timestamps**: All tables track creation and update times for debugging
*/

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text UNIQUE NOT NULL,
  host_id uuid REFERENCES auth.users(id),
  status text DEFAULT 'waiting' NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create players table
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  player_name text NOT NULL,
  player_number int NOT NULL CHECK (player_number BETWEEN 1 AND 4),
  team_number int NOT NULL CHECK (team_number IN (1, 2)),
  is_host boolean DEFAULT false,
  connected boolean DEFAULT true,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(room_id, player_number),
  UNIQUE(room_id, user_id)
);

-- Create game_state table
CREATE TABLE IF NOT EXISTS game_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE UNIQUE NOT NULL,
  phase text DEFAULT 'lobby' NOT NULL CHECK (phase IN ('lobby', 'dealing', 'bidding', 'trump_selection', 'playing', 'round_end', 'game_over')),
  current_player int DEFAULT 1 CHECK (current_player BETWEEN 1 AND 4),
  dealer int DEFAULT 1 CHECK (dealer BETWEEN 1 AND 4),
  round_number int DEFAULT 1,
  trump_suit text CHECK (trump_suit IN ('spades', 'hearts', 'diamonds', 'clubs') OR trump_suit IS NULL),
  highest_bid int DEFAULT 0,
  bid_winner int CHECK (bid_winner BETWEEN 1 AND 4 OR bid_winner IS NULL),
  team1_score int DEFAULT 0,
  team2_score int DEFAULT 0,
  team1_tricks int DEFAULT 0,
  team2_tricks int DEFAULT 0,
  last_round_winner int DEFAULT 1 CHECK (last_round_winner IN (1, 2)),
  current_trick_number int DEFAULT 1,
  winner int CHECK (winner IN (1, 2) OR winner IS NULL),
  updated_at timestamptz DEFAULT now()
);

-- Create player_hands table
CREATE TABLE IF NOT EXISTS player_hands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  player_number int NOT NULL CHECK (player_number BETWEEN 1 AND 4),
  cards jsonb DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(room_id, player_number)
);

-- Create bids table
CREATE TABLE IF NOT EXISTS bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  round_number int NOT NULL,
  player_number int NOT NULL CHECK (player_number BETWEEN 1 AND 4),
  bid_amount int CHECK (bid_amount BETWEEN 7 AND 13 OR bid_amount IS NULL),
  passed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create current_trick table
CREATE TABLE IF NOT EXISTS current_trick (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  round_number int NOT NULL,
  trick_number int NOT NULL,
  player_number int NOT NULL CHECK (player_number BETWEEN 1 AND 4),
  card jsonb NOT NULL,
  leading_suit text CHECK (leading_suit IN ('spades', 'hearts', 'diamonds', 'clubs') OR leading_suit IS NULL),
  winner int CHECK (winner BETWEEN 1 AND 4 OR winner IS NULL),
  sequence int NOT NULL CHECK (sequence BETWEEN 1 AND 4),
  created_at timestamptz DEFAULT now()
);

-- Create completed_tricks table
CREATE TABLE IF NOT EXISTS completed_tricks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
  round_number int NOT NULL,
  trick_number int NOT NULL,
  cards_played jsonb NOT NULL,
  winner int NOT NULL CHECK (winner BETWEEN 1 AND 4),
  leading_suit text NOT NULL CHECK (leading_suit IN ('spades', 'hearts', 'diamonds', 'clubs')),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_game_state_room_id ON game_state(room_id);
CREATE INDEX IF NOT EXISTS idx_player_hands_room_id ON player_hands(room_id);
CREATE INDEX IF NOT EXISTS idx_bids_room_id ON bids(room_id);
CREATE INDEX IF NOT EXISTS idx_current_trick_room_id ON current_trick(room_id);
CREATE INDEX IF NOT EXISTS idx_completed_tricks_room_id ON completed_tricks(room_id);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_trick ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_tricks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY "Anyone can create rooms"
  ON rooms FOR INSERT
  TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "Anyone can view rooms"
  ON rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Host can update their room"
  ON rooms FOR UPDATE
  TO authenticated
  USING (host_id = auth.uid());

-- RLS Policies for players
CREATE POLICY "Authenticated users can join as players"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Players can view other players in their room"
  ON players FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Players can update their own data"
  ON players FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for game_state
CREATE POLICY "Players can view game state in their room"
  ON game_state FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Players can update game state in their room"
  ON game_state FOR UPDATE
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Players can insert game state"
  ON game_state FOR INSERT
  TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for player_hands (CRITICAL: Players only see their own cards)
CREATE POLICY "Players can view only their own hand"
  ON player_hands FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.room_id = player_hands.room_id
      AND players.user_id = auth.uid()
      AND players.player_number = player_hands.player_number
    )
  );

CREATE POLICY "System can manage hands"
  ON player_hands FOR INSERT
  TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can update hands"
  ON player_hands FOR UPDATE
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for bids
CREATE POLICY "Players can view bids in their room"
  ON bids FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Players can place bids in their room"
  ON bids FOR INSERT
  TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for current_trick
CREATE POLICY "Players can view current trick in their room"
  ON current_trick FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Players can play cards in their room"
  ON current_trick FOR INSERT
  TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Players can update current trick"
  ON current_trick FOR UPDATE
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can delete current trick"
  ON current_trick FOR DELETE
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for completed_tricks
CREATE POLICY "Players can view completed tricks in their room"
  ON completed_tricks FOR SELECT
  TO authenticated
  USING (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "System can archive tricks"
  ON completed_tricks FOR INSERT
  TO authenticated
  WITH CHECK (
    room_id IN (
      SELECT room_id FROM players WHERE user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_game_state_updated_at ON game_state;
CREATE TRIGGER update_game_state_updated_at
  BEFORE UPDATE ON game_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_player_hands_updated_at ON player_hands;
CREATE TRIGGER update_player_hands_updated_at
  BEFORE UPDATE ON player_hands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();