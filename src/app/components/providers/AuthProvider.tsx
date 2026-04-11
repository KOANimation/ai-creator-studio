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

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<number | null>(null);

  const mountedRef = useRef(false);
  const authRefreshInFlightRef = useRef(false);
  const walletRequestIdRef = useRef(0);

  const applySignedOutState = useCallback(() => {
    if (!mountedRef.current) return;
    setSession(null);
    setUser(null);
    setCredits(null);
  }, []);

  const loadCredits = useCallback(
    async (userId?: string | null) => {
      const targetUserId = userId ?? user?.id ?? null;

      if (!targetUserId) {
        if (mountedRef.current) {
          setCredits(null);
        }
        return;
      }

      const requestId = ++walletRequestIdRef.current;

      try {
        const { data, error } = await supabase
          .from("credit_wallets")
          .select("balance")
          .eq("user_id", targetUserId)
          .maybeSingle();

        if (!mountedRef.current) return;
        if (requestId !== walletRequestIdRef.current) return;

        if (error) {
          console.error("[AuthProvider] Failed to load credits:", error);
          setCredits(0);
          return;
        }

        setCredits(typeof data?.balance === "number" ? data.balance : 0);
      } catch (err) {
        if (!mountedRef.current) return;
        if (requestId !== walletRequestIdRef.current) return;

        console.error("[AuthProvider] Credit load crashed:", err);
        setCredits(0);
      }
    },
    [supabase, user?.id]
  );

  const refreshAuth = useCallback(async () => {
    if (!mountedRef.current) return;

    if (authRefreshInFlightRef.current) return;
    authRefreshInFlightRef.current = true;

    if (mountedRef.current) {
      setLoading(true);
    }

    try {
      const {
        data: { session: sessionFromSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("[AuthProvider] getSession failed:", sessionError);
      }

      const {
        data: { user: userFromUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("[AuthProvider] getUser failed:", userError);
      }

      if (!mountedRef.current) return;

      const resolvedUser = userFromUser ?? sessionFromSession?.user ?? null;
      const resolvedSession = sessionFromSession ?? null;

      setSession(resolvedSession);
      setUser(resolvedUser);

      if (resolvedUser) {
        await loadCredits(resolvedUser.id);
      } else {
        setCredits(null);
      }
    } catch (err) {
      console.error("[AuthProvider] refreshAuth crashed:", err);
      applySignedOutState();
    } finally {
      authRefreshInFlightRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [supabase, loadCredits, applySignedOutState]);

  const refreshCredits = useCallback(async () => {
    if (!mountedRef.current) return;
    await loadCredits();
  }, [loadCredits]);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("[AuthProvider] Sign out failed:", error);
      }
    } catch (err) {
      console.error("[AuthProvider] Sign out crashed:", err);
    } finally {
      applySignedOutState();

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [supabase, applySignedOutState]);

  useEffect(() => {
    mountedRef.current = true;

    void refreshAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mountedRef.current) return;

      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await loadCredits(nextSession.user.id);
      } else {
        setCredits(null);
      }

      if (mountedRef.current) {
        setLoading(false);
      }

      console.log("[AuthProvider] onAuthStateChange:", event);
    });

    const onFocus = () => {
      void refreshAuth();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshAuth();
      }
    };

    const onPageShow = () => {
      void refreshAuth();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
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