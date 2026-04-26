"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  freeTrialUsed: boolean;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [freeTrialUsed, setFreeTrialUsed] = useState(false);

  async function fetchUserData(uid: string) {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      setFreeTrialUsed(snap.data().freeTrialUsed ?? false);
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) await fetchUserData(u.uid);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function register(email: string, password: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      freeTrialUsed: false,
      createdAt: serverTimestamp(),
    });
    setFreeTrialUsed(false);
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
    setFreeTrialUsed(false);
  }

  async function refreshUserData() {
    if (user) await fetchUserData(user.uid);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, freeTrialUsed, register, login, logout, refreshUserData }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // AuthProvider가 아직 로드되지 않은 경우 (dynamic import 초기화 중)
    return {
      user: null,
      loading: true,
      freeTrialUsed: false,
      register: async () => {},
      login: async () => {},
      logout: async () => {},
      refreshUserData: async () => {},
    };
  }
  return ctx;
}
