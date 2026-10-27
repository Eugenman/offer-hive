"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { MOCK_SEED } from "@/lib/mock-data";
import { MemoryApplicationsRepository } from "./memory";
import type { ApplicationsRepository } from "./types";

const RepositoryContext = createContext<ApplicationsRepository | null>(null);

// One instance per browser tab: it survives client-side navigation between pages.
let instance: ApplicationsRepository | null = null;
function getRepository() {
  instance ??= new MemoryApplicationsRepository(MOCK_SEED);
  return instance;
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
