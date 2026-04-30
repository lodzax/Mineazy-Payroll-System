import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Session retrieval error:', error);
          if (error.message.includes('Encryption') || error.message.includes('decryption')) {
            // Local storage might be corrupted
            localStorage.removeItem('mineazy-auth-token');
            window.location.reload();
            return;
          }
          throw error;
        }
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
        else setLoading(false);
      } catch (err) {
        console.error('Auth initialization failed:', err);
        setLoading(false);
      }
    };

    initSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, retryCount = 0) => {
    let success = false;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
      success = true;
    } catch (err: any) {
      console.error(`Error fetching profile (attempt ${retryCount + 1}):`, err);
      
      // If it's a network/fetch error, retry up to 3 times
      if (retryCount < 3 && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
        const delay = Math.pow(2, retryCount + 1) * 800; // Faster backoff for better UX
        setTimeout(() => fetchProfile(userId, retryCount + 1), delay);
        return; // Exit here, let the next call handle setLoading(false)
      }
    }
    
    // If we're here, we either succeeded or reached max retries
    setLoading(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isSuperAdmin = user?.email?.toLowerCase() === 'lodzax@gmail.com' || user?.email?.toLowerCase() === 'accounts@mineazy.co.zw' || profile?.role?.toLowerCase() === 'superadmin';
  const isAdmin = isSuperAdmin || profile?.role?.toLowerCase() === 'admin' || profile?.role?.toLowerCase() === 'management';

  // Add uid alias for compatibility with Firebase-era code
  const userCompatibility = user ? { ...user, uid: user.id } : null;

  return (
    <AuthContext.Provider value={{ user: userCompatibility as any, session, profile, loading, isAdmin, isSuperAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
