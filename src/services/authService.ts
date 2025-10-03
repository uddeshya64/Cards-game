import { supabase } from '../lib/supabase';

export async function signUpAnonymously(playerName: string) {
  const email = `player_${Date.now()}_${Math.random().toString(36).substring(7)}@temp.com`;
  const password = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        player_name: playerName
      }
    }
  });

  if (error) throw error;
  return data;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
