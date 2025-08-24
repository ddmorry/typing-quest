import { GameEvent, GameEventData } from '../types';

/**
 * Advanced event bus system for game events
 * Provides type-safe event handling with additional features like priorities and debugging
 */

export interface EventListener<T extends GameEvent = GameEvent> {
  callback: (data: GameEventData[T]) => void;
  priority: number;
  once: boolean;
  context?: string; // For debugging
}

export interface EventBusOptions {
  enableLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxListeners: number;
}

export class EventBus {
  private listeners: Map<GameEvent, EventListener[]> = new Map();
  private options: EventBusOptions;
  private emissionCount: Map<GameEvent, number> = new Map();
  private errorCount = 0;

  constructor(options: Partial<EventBusOptions> = {}) {
    this.options = {
      enableLogging: process.env.NODE_ENV === 'development',
      logLevel: 'warn',
      maxListeners: 50,
      ...options,
    };
    
    this.initializeEventTypes();
  }

  // =============================================================================
  // CORE EVENT METHODS
  // =============================================================================

  /**
   * Add an event listener with optional priority and context
   */
  on<T extends GameEvent>(
    event: T,
    callback: (data: GameEventData[T]) => void,
    options: {
      priority?: number;
      context?: string;
      once?: boolean;
    } = {}
  ): () => void {
    const listener: EventListener = {
      callback: callback as (data: GameEventData[GameEvent]) => void,
      priority: options.priority || 0,
      once: options.once || false,
      context: options.context,
    };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const eventListeners = this.listeners.get(event)!;
    
    // Check max listeners
    if (eventListeners.length >= this.options.maxListeners) {
      this.log('warn', `Maximum listeners (${this.options.maxListeners}) exceeded for event: ${event}`);
    }

    // Insert listener in priority order (higher priority first)
    const insertIndex = eventListeners.findIndex(l => l.priority < listener.priority);
    if (insertIndex === -1) {
      eventListeners.push(listener);
    } else {
      eventListeners.splice(insertIndex, 0, listener);
    }

    this.log('debug', `Added listener for ${event}`, { 
      priority: listener.priority, 
      context: listener.context 
    });

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Add a one-time event listener
   */
  once<T extends GameEvent>(
    event: T,
    callback: (data: GameEventData[T]) => void,
    options: { priority?: number; context?: string } = {}
  ): () => void {
    return this.on(event, callback, { ...options, once: true });
  }

  /**
   * Remove an event listener
   */
  off<T extends GameEvent>(
    event: T,
    callback: (data: GameEventData[T]) => void
  ): void {
    const listeners = this.listeners.get(event);
    if (!listeners) return;

    const index = listeners.findIndex(l => l.callback === callback);
    if (index !== -1) {
      listeners.splice(index, 1);
      this.log('debug', `Removed listener for ${event}`);
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<T extends GameEvent>(event?: T): void {
    if (event) {
      this.listeners.delete(event);
      this.log('debug', `Removed all listeners for ${event}`);
    } else {
      this.listeners.clear();
      this.log('debug', 'Removed all listeners');
    }
  }

  /**
   * Emit an event to all listeners
   */
  emit<T extends GameEvent>(event: T, data: GameEventData[T]): void {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.length === 0) {
      this.log('debug', `No listeners for event: ${event}`);
      return;
    }

    // Update emission count
    const currentCount = this.emissionCount.get(event) || 0;
    this.emissionCount.set(event, currentCount + 1);

    this.log('debug', `Emitting ${event}`, data);

    // Create a copy to avoid issues if listeners are modified during emission
    const listenersToCall = [...listeners];

    for (const listener of listenersToCall) {
      try {
        listener.callback(data);
        
        // Remove one-time listeners
        if (listener.once) {
          this.off(event, listener.callback);
        }
      } catch (error) {
        this.errorCount++;
        this.log('error', `Error in event listener for ${event}`, {
          error,
          context: listener.context,
        });
        
        // Emit error event (but prevent infinite loops)
        if (event !== 'error') {
          this.emit('error', {
            error: error as Error,
            context: `EventBus listener for ${event} (${listener.context || 'unknown'})`,
          });
        }
      }
    }
  }

  // =============================================================================
  // BATCH OPERATIONS
  // =============================================================================

  /**
   * Emit multiple events in sequence
   */
  emitBatch<T extends GameEvent>(events: Array<{ event: T; data: GameEventData[T] }>): void {
    events.forEach(({ event, data }) => this.emit(event, data));
  }

  /**
   * Subscribe to multiple events with the same callback
   */
  onMultiple<T extends GameEvent>(
    events: T[],
    callback: (event: T, data: GameEventData[T]) => void,
    options?: { priority?: number; context?: string }
  ): () => void {
    const unsubscribers = events.map(event =>
      this.on(event, (data) => callback(event, data), options)
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  // =============================================================================
  // DEBUGGING AND MONITORING
  // =============================================================================

  /**
   * Get statistics about the event bus
   */
  getStats(): {
    totalListeners: number;
    listenersByEvent: Record<string, number>;
    emissionCounts: Record<string, number>;
    errorCount: number;
  } {
    const listenersByEvent: Record<string, number> = {};
    let totalListeners = 0;

    this.listeners.forEach((listeners, event) => {
      listenersByEvent[event] = listeners.length;
      totalListeners += listeners.length;
    });

    const emissionCounts: Record<string, number> = {};
    this.emissionCount.forEach((count, event) => {
      emissionCounts[event] = count;
    });

    return {
      totalListeners,
      listenersByEvent,
      emissionCounts,
      errorCount: this.errorCount,
    };
  }

  /**
   * Get all listeners for an event
   */
  getListeners<T extends GameEvent>(event: T): EventListener<T>[] {
    return (this.listeners.get(event) || []) as EventListener<T>[];
  }

  /**
   * Check if an event has listeners
   */
  hasListeners<T extends GameEvent>(event: T): boolean {
    const listeners = this.listeners.get(event);
    return listeners !== undefined && listeners.length > 0;
  }

  // =============================================================================
  // CONVENIENCE METHODS
  // =============================================================================

  /**
   * Create a namespaced version of the event bus
   */
  namespace(prefix: string): NamespacedEventBus {
    return new NamespacedEventBus(this, prefix);
  }

  /**
   * Create a filtered event bus that only handles certain events
   */
  filter<T extends GameEvent>(events: T[]): FilteredEventBus<T> {
    return new FilteredEventBus(this, events);
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  private initializeEventTypes(): void {
    const events: GameEvent[] = [
      'state-change',
      'word-started',
      'word-completed',
      'word-failed',
      'action-executed',
      'damage-dealt',
      'healing-applied',
      'guard-executed',
      'enemy-attack',
      'combo-changed',
      'game-over',
      'session-ended',
      'error',
    ];

    events.forEach(event => {
      this.listeners.set(event, []);
      this.emissionCount.set(event, 0);
    });
  }

  private log(level: EventBusOptions['logLevel'], message: string, data?: any): void {
    if (!this.options.enableLogging) return;

    const levelPriority = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    if (levelPriority[level] >= levelPriority[this.options.logLevel]) {
      const logMethod = level === 'debug' ? console.debug :
                      level === 'info' ? console.info :
                      level === 'warn' ? console.warn :
                      console.error;

      logMethod(`[EventBus] ${message}`, data || '');
    }
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  /**
   * Clean up all listeners and reset state
   */
  destroy(): void {
    this.listeners.clear();
    this.emissionCount.clear();
    this.errorCount = 0;
    this.log('debug', 'EventBus destroyed');
  }
}

// =============================================================================
// SPECIALIZED EVENT BUS VARIANTS
// =============================================================================

/**
 * Namespaced event bus for modular event handling
 */
export class NamespacedEventBus {
  constructor(private parent: EventBus, private prefix: string) {}

  on<T extends GameEvent>(
    event: T,
    callback: (data: GameEventData[T]) => void,
    options: { priority?: number; once?: boolean; context?: string } = {}
  ): () => void {
    return this.parent.on(event, callback, {
      ...options,
      context: `${this.prefix}:${options.context || 'unnamed'}`,
    });
  }

  emit<T extends GameEvent>(event: T, data: GameEventData[T]): void {
    this.parent.emit(event, data);
  }

  once<T extends GameEvent>(
    event: T,
    callback: (data: GameEventData[T]) => void,
    options: { priority?: number; context?: string } = {}
  ): () => void {
    return this.parent.once(event, callback, {
      ...options,
      context: `${this.prefix}:${options.context || 'unnamed'}`,
    });
  }
}

/**
 * Filtered event bus that only handles specific events
 */
export class FilteredEventBus<T extends GameEvent> {
  constructor(private parent: EventBus, private allowedEvents: T[]) {}

  on(
    event: T,
    callback: (data: GameEventData[T]) => void,
    options?: { priority?: number; once?: boolean; context?: string }
  ): () => void {
    if (!this.allowedEvents.includes(event)) {
      throw new Error(`Event ${event} is not allowed in this filtered bus`);
    }
    return this.parent.on(event, callback, options);
  }

  emit(event: T, data: GameEventData[T]): void {
    if (!this.allowedEvents.includes(event)) {
      throw new Error(`Event ${event} is not allowed in this filtered bus`);
    }
    this.parent.emit(event, data);
  }
}

// =============================================================================
// GLOBAL EVENT BUS INSTANCE
// =============================================================================

export const globalEventBus = new EventBus({
  enableLogging: process.env.NODE_ENV === 'development',
  logLevel: 'warn',
  maxListeners: 100,
});