/* =====================================================================
   SUPABASE CLIENT & AUTH HELPERS (Revelation Fintech)
   ===================================================================== */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cnvolkoclphlmnbnshwy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_M0PKYhSm2SFVQJ4g_n0bog_75TgxOjk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Trigger Google OAuth with Supabase
 */
export async function signInWithGoogle() {
  const redirectOrigin = window.location.origin;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectOrigin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/**
 * Sign up with email, password, and optional full name
 */
export async function signUpWithEmail(email, password, fullName = '') {
  const redirectOrigin = window.location.origin;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: redirectOrigin,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Sign out
 */
export async function signOutSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Get current session user
 */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

