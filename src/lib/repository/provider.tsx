"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { syncStorage, type SyncStatus, type SyncStorage } from "@/lib/sync/sync-storage";
import { createApplicationsRepository } from "./repository";
import type { ApplicationsRepository } from "./types";

const RepositoryContext = createContext<ApplicationsRepository | null>(null);

// Server rendering only draws loading states, so it gets an empty store and never reads it.
const serverRepository = createApplicationsRepository();

// One instance per browser tab: it survives client-side navigation between pages.
let instance: ApplicationsRepository | null = null;
let storage: SyncStorage | null = null;

function getStorage() {
  storage ??= syncStorage({
    onRejected: () => toast.error("A change couldn’t be saved. Your data was reloaded."),
    onSignedOut: () => {
      // A full page load, not client navigation: this tab's data must not outlive the session.
      const login = new URL("/login", location.href);
      login.searchParams.set("next", location.pathname + location.search);
      location.assign(login);
    },
  });
  return storage;
}

function getRepository() {
  if (typeof window === "undefined") return serverRepository;
  instance ??= createApplicationsRepository({ storage: getStorage() });
  return instance;
}

/** Whether changes are on their way to the server; "idle" during server rendering. */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => getStorage().subscribeStatus(listener),
    () => getStorage().getStatus(),
    () => "idle",
  );
}

/** Changes of this account that haven't reached the server yet. */
export function countUnsentChanges(): Promise<number> {
  return typeof window === "undefined" ? Promise.resolve(0) : getStorage().pendingCount();
}

/** Drops this account's unsent changes (after the account is deleted). */
export function discardUnsentChanges(): Promise<void> {
  return typeof window === "undefined" ? Promise.resolve() : getStorage().discardPending();
}

export function RepositoryProvider({ children }: { children: ReactNode }) {
  return <RepositoryContext.Provider value={getRepository()}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): ApplicationsRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) throw new Error("useRepository must be used inside <RepositoryProvider>");
  return repository;
}

type QueryState<T> = { data: T | undefined; error: unknown; loading: boolean };

/**
 * Runs an async read against the repository and re-runs it after every change.
 * `key` must change whenever the inputs of `read` change (e.g. a serialized query).
 */
export function useRepositoryQuery<T>(
  key: string,
  read: (repository: ApplicationsRepository) => Promise<T>,
): QueryState<T> {
  const repository = useRepository();
  const [state, setState] = useState<QueryState<T>>({ data: undefined, error: null, loading: true });
  const readRef = useRef(read);
  useEffect(() => {
    readRef.current = read;
  });

  useEffect(() => {
    let current = 0;
    const run = () => {
      const ticket = ++current;
      setState((prev) => ({ ...prev, loading: true }));
      readRef.current(repository).then(
        (data) => ticket === current && setState({ data, error: null, loading: false }),
        (error: unknown) => ticket === current && setState((prev) => ({ ...prev, error, loading: false })),
      );
    };
    run();
    const unsubscribe = repository.subscribe(run);
    return () => {
      current = -1;
      unsubscribe();
    };
  }, [repository, key]);

  return state;
}
