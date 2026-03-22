type Listener<T = unknown> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  on<T>(event: string, fn: Listener<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn as Listener);
    return () => this.listeners.get(event)?.delete(fn as Listener);
  }

  emit<T>(event: string, data: T): void {
    this.listeners.get(event)?.forEach((fn) => fn(data));
  }
}

export const bus = new EventBus();
