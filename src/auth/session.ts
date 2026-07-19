import { useSyncExternalStore } from 'react';

export type AccountType = 'tenant' | 'platform';

export type Session = {
  version: 1;
  accountType: AccountType;
  token: string;
  expiresAt: string;
  userId: string;
  tenantId?: string;
  tenantSlug?: string;
  email: string;
  displayName: string;
  role: string;
};

const STORAGE_KEY = 'surprising-wallet.session.v1';
const listeners = new Set<() => void>();
let snapshot = readSession();

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Session;
    if (
      value.version !== 1 ||
      !value.token ||
      !value.expiresAt ||
      new Date(value.expiresAt).getTime() <= Date.now()
    ) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return value;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function emit() {
  snapshot = readSession();
  listeners.forEach((listener) => listener());
}

export function saveSession(session: Session) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  emit();
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEY);
  emit();
}

export function getSession() {
  return snapshot;
}

export function useSession() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => null,
  );
}
