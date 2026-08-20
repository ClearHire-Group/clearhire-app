import { DestroyRef, Signal, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

export interface Loadable<T> {
  data: Signal<T | undefined>;
  loading: Signal<boolean>;
  error: Signal<boolean>;
}

/**
 * Subscribes to an async data source and exposes it as data/loading/error signals,
 * unsubscribing automatically when the component is destroyed. Must be called from
 * an injection context (a component field initializer or constructor).
 */
export function toLoadable<T>(source$: Observable<T>): Loadable<T> {
  const data = signal<T | undefined>(undefined);
  const loading = signal(true);
  const error = signal(false);
  const destroyRef = inject(DestroyRef);

  const subscription = source$.subscribe({
    next: (value) => {
      data.set(value);
      loading.set(false);
    },
    error: () => {
      error.set(true);
      loading.set(false);
    },
  });
  destroyRef.onDestroy(() => subscription.unsubscribe());

  return { data, loading, error };
}
