import { EventEmitter } from 'node:events';

// In-process pub/sub for cross-module cache maintenance (e.g. a denormalized counter on one
// module kept in sync with a write in another) — not a message queue, not durable, not a
// substitute for a module's own reconciliation query. See CLAUDE.md: "If two modules need the
// same logic, it moves to src/common/ or one module emits an event the other subscribes to."
// A handler throwing must never take down the publisher — event handling is best-effort, and the
// owning module's exported aggregation method is the source of truth a reconciliation job can
// fall back to.
export interface EventBus {
  publish<T>(event: string, payload: T): void;
  subscribe<T>(event: string, handler: (payload: T) => void | Promise<void>): void;
}

export function createEventBus(
  onHandlerError: (event: string, error: unknown) => void = (event, error) =>
    console.error(`event handler failed for "${event}"`, error),
): EventBus {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);

  return {
    publish<T>(event: string, payload: T): void {
      emitter.emit(event, payload);
    },
    subscribe<T>(event: string, handler: (payload: T) => void | Promise<void>): void {
      emitter.on(event, (payload: T) => {
        Promise.resolve(handler(payload)).catch((error) => onHandlerError(event, error));
      });
    },
  };
}
