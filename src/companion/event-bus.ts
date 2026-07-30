/**
 * EventBus - Infrastructure for decoupled module communication
 *
 * Platform-owned service for cross-module event publication and subscription.
 * Modules receive through dependency injection, never create directly.
 */

export type EventName = string;

export interface Event<TData = unknown> {
    readonly name: EventName;
    readonly data: TData;
    readonly timestamp: number;
    readonly sourceModule: string;
}

export type EventHandler<TData = unknown> = (event: Event<TData>) => void | Promise<void>;

export interface Subscription {
    readonly unsubscribe: () => void;
}

export class EventBus {
    private subscribers: Map<EventName, Set<EventHandler>> = new Map();

    /**
     * Subscribe to an event.
     * Returns a Subscription with an idempotent unsubscribe method.
     */
    subscribe<TData = unknown>(eventName: EventName, handler: EventHandler<TData>): Subscription {
        if (!this.subscribers.has(eventName)) {
            this.subscribers.set(eventName, new Set());
        }
        this.subscribers.get(eventName)!.add(handler as EventHandler);

        let unsubscribed = false;
        return {
            unsubscribe: () => {
                if (unsubscribed) return;
                unsubscribed = true;
                this.unsubscribe(eventName, handler);
            }
        };
    }

    /**
     * Unsubscribe from an event. Idempotent — safe to call multiple times.
     */
    unsubscribe<TData = unknown>(eventName: EventName, handler: EventHandler<TData>): void {
        const handlers = this.subscribers.get(eventName);
        if (!handlers) return;
        handlers.delete(handler as EventHandler);
        if (handlers.size === 0) {
            this.subscribers.delete(eventName);
        }
    }

    /**
     * Publish an event to all subscribers.
     * The event object is frozen before dispatch so every subscriber
     * observes the exact same immutable instance.
     * Returns a promise that resolves when all handlers complete.
     */
    async publish<TData = unknown>(
        eventName: EventName,
        data: TData,
        sourceModule: string
    ): Promise<void> {
        const handlers = this.subscribers.get(eventName);
        if (!handlers || handlers.size === 0) return;

        const event: Event<TData> = Object.freeze({
            name: eventName,
            data,
            timestamp: Date.now(),
            sourceModule
        });

        const promises: Promise<void>[] = [];
        for (const handler of handlers) {
            try {
                const result = handler(event);
                if (result instanceof Promise) {
                    promises.push(result);
                }
            } catch (error) {
                console.error(`[EventBus] Handler error for ${eventName}:`, error);
            }
        }

        if (promises.length > 0) {
            const results = await Promise.allSettled(promises);
            for (let i = 0; i < results.length; i++) {
                if (results[i].status === 'rejected') {
                    console.error(`[EventBus] Async handler error for ${eventName}:`, results[i].reason);
                }
            }
        }
    }

    /**
     * Check if there are subscribers for an event.
     */
    hasSubscribers(eventName: EventName): boolean {
        const handlers = this.subscribers.get(eventName);
        return handlers !== undefined && handlers.size > 0;
    }

    /**
     * Get count of subscribers for an event.
     */
    subscriberCount(eventName: EventName): number {
        return this.subscribers.get(eventName)?.size ?? 0;
    }

    /**
     * Clear all subscriptions.
     */
    clear(): void {
        this.subscribers.clear();
    }
}