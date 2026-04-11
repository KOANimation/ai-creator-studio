"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "@/app/lib/supabase/client";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  credits: number | null;
  refreshAuth: () => Promise<void>;
  refreshCredits: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef(false);

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const safelySetState = useCallback((fn: () => void) => {
    if (mountedRef.current) fn();
  }, []);

  const loadCredits = useCallback(
    async (userId?: string | null) => {
      const targetUserId = userId ?? user?.id ?? null;

      if (!targetUserId) {
        safelySetState(() => setCredits(null));
        return;
      }

      const { data, error } = await supabase
        .from("credit_wallets")
        .select("balance")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (!mountedRef.current) return;

      if (error) {
        console.error("[AuthProvider] Failed to load credits:", error);
        setCredits(0);
        return;
      }

      setCredits(typeof data?.balance === "number" ? data.balance : 0);
    },
    [supabase, user?.id, safelySetState]
  );

  const refreshAuth = useCallback(async () => {
    safelySetState(() => setLoading(true));

    try {
      const [
        {
          data: { session: sessionResult },
          error: sessionError,
        },
        {
          data: { user: userResult },
          error: userError,
        },
      ] = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()]);

      if (!mountedRef.current) return;

      if (sessionError) {
        console.error("[AuthProvider] getSession error:", sessionError);
      }

      if (userError) {
        console.error("[AuthProvider] getUser error:", userError);
      }

      const resolvedUser = userResult ?? sessionResult?.user ?? null;

      setSession(sessionResult ?? null);
      setUser(resolvedUser);

      if (resolvedUser) {
        await loadCredits(resolvedUser.id);
      } else {
        setCredits(null);
      }
    } catch (err) {
      console.error("[AuthProvider] refreshAuth failed:", err);

      if (!mountedRef.current) return;

      setSession(null);
      setUser(null);
      setCredits(null);
    } finally {
      safelySetState(() => setLoading(false));
    }
  }, [supabase, loadCredits, safelySetState]);

  const refreshCredits = useCallback(async () => {
    const targetUserId = user?.id ?? session?.user?.id ?? null;

    if (!targetUserId) {
      safelySetState(() => setCredits(null));
      return;
    }

    await loadCredits(targetUserId);
  }, [user?.id, session?.user?.id, loadCredits, safelySetState]);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("[AuthProvider] Sign out failed:", error);
      }
    } finally {
      if (!mountedRef.current) return;

      setSession(null);
      setUser(null);
      setCredits(null);
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    mountedRef.current = true;

    void refreshAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mountedRef.current) return;

      const nextUser = nextSession?.user ?? null;

      setSession(nextSession ?? null);
      setUser(nextUser);

      if (nextUser) {
        await loadCredits(nextUser.id);
      } else {
        setCredits(null);
      }

      if (mountedRef.current) {
        setLoading(false);
      }
    });

    const handlePageShow = () => {
      void refreshAuth();
    };

    const handleFocus = () => {
      void refreshAuth();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshAuth();
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [supabase, refreshAuth, loadCredits]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      loading,
      credits,
      refreshAuth,
      refreshCredits,
      signOut,
    }),
    [user, session, loading, credits, refreshAuth, refreshCredits, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}