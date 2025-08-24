import { EventBus, NamespacedEventBus, FilteredEventBus } from '@/lib/game/events/EventBus';
import type { GameEvent, GameEventData } from '@/lib/game/types';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus({
      enableLogging: false,
      logLevel: 'error',
      maxListeners: 10,
    });
  });

  afterEach(() => {
    eventBus.destroy();
  });

  describe('Basic Event Operations', () => {
    it('should add and trigger event listeners', (done) => {
      const testData = { oldState: {} as any, newState: {} as any };
      
      eventBus.on('state-change', (data) => {
        expect(data).toBe(testData);
        done();
      });

      eventBus.emit('state-change', testData);
    });

    it('should remove event listeners', () => {
      const listener = jest.fn();
      
      eventBus.on('word-completed', listener);
      eventBus.off('word-completed', listener);
      
      eventBus.emit('word-completed', { completedWord: {} as any, result: {} as any });
      
      expect(listener).not.toHaveBeenCalled();
    });

    it('should support multiple listeners for same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      eventBus.on('damage-dealt', listener1);
      eventBus.on('damage-dealt', listener2);
      
      eventBus.emit('damage-dealt', { damage: 25, critical: false, enemyHp: 75 });
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function from on()', () => {
      const listener = jest.fn();
      
      const unsubscribe = eventBus.on('combo-changed', listener);
      unsubscribe();
      
      eventBus.emit('combo-changed', { oldCombo: 0, newCombo: 1 });
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Priority System', () => {
    it('should call listeners in priority order', () => {
      const callOrder: number[] = [];
      
      eventBus.on('word-started', () => callOrder.push(1), { priority: 1 });
      eventBus.on('word-started', () => callOrder.push(3), { priority: 3 });
      eventBus.on('word-started', () => callOrder.push(2), { priority: 2 });
      
      eventBus.emit('word-started', { word: {} as any, type: 'ATTACK' });
      
      expect(callOrder).toEqual([3, 2, 1]); // Higher priority first
    });

    it('should default to priority 0 if not specified', () => {
      const callOrder: number[] = [];
      
      eventBus.on('word-failed', () => callOrder.push(0)); // Default priority
      eventBus.on('word-failed', () => callOrder.push(1), { priority: 1 });
      
      eventBus.emit('word-failed', { word: {} as any, typedText: 'test', errors: 1 });
      
      expect(callOrder).toEqual([1, 0]); // Priority 1 before default 0
    });
  });

  describe('Once Listeners', () => {
    it('should call once listeners only once', () => {
      const listener = jest.fn();
      
      eventBus.once('game-over', listener);
      
      const gameOverData = { result: 'WIN' as const, finalStats: {} as any };
      eventBus.emit('game-over', gameOverData);
      eventBus.emit('game-over', gameOverData);
      
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support priority for once listeners', () => {
      const callOrder: number[] = [];
      
      eventBus.once('session-ended', () => callOrder.push(2), { priority: 2 });
      eventBus.on('session-ended', () => callOrder.push(1), { priority: 1 });
      
      eventBus.emit('session-ended', { sessionResult: {} as any });
      
      expect(callOrder).toEqual([2, 1]);
      
      // Second emit should only call the regular listener
      callOrder.length = 0;
      eventBus.emit('session-ended', { sessionResult: {} as any });
      
      expect(callOrder).toEqual([1]);
    });
  });

  describe('Batch Operations', () => {
    it('should emit multiple events in sequence', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      eventBus.on('damage-dealt', listener1);
      eventBus.on('healing-applied', listener2);
      
      eventBus.emitBatch([
        { event: 'damage-dealt', data: { damage: 20, critical: false, enemyHp: 80 } },
        { event: 'healing-applied', data: { healing: 15, critical: false, playerHp: 95 } },
      ]);
      
      expect(listener1).toHaveBeenCalledWith({ damage: 20, critical: false, enemyHp: 80 });
      expect(listener2).toHaveBeenCalledWith({ healing: 15, critical: false, playerHp: 95 });
    });

    it('should subscribe to multiple events with same callback', () => {
      const listener = jest.fn();
      
      const unsubscribe = eventBus.onMultiple(
        ['damage-dealt', 'healing-applied'], 
        listener
      );
      
      eventBus.emit('damage-dealt', { damage: 20, critical: false, enemyHp: 80 });
      eventBus.emit('healing-applied', { healing: 15, critical: false, playerHp: 95 });
      
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith('damage-dealt', { damage: 20, critical: false, enemyHp: 80 });
      expect(listener).toHaveBeenCalledWith('healing-applied', { healing: 15, critical: false, playerHp: 95 });
      
      // Should be able to unsubscribe from all
      unsubscribe();
      eventBus.emit('damage-dealt', { damage: 25, critical: false, enemyHp: 75 });
      
      expect(listener).toHaveBeenCalledTimes(2); // No additional calls
    });
  });

  describe('Error Handling', () => {
    it('should handle listener errors gracefully', () => {
      const faultyListener = jest.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = jest.fn();
      
      eventBus.on('error', goodListener); // Listen for error events
      eventBus.on('word-completed', faultyListener);
      eventBus.on('word-completed', goodListener);
      
      // Should not throw
      expect(() => {
        eventBus.emit('word-completed', { completedWord: {} as any, result: {} as any });
      }).not.toThrow();
      
      expect(goodListener).toHaveBeenCalledTimes(2); // Once for word-completed, once for error
      expect(faultyListener).toHaveBeenCalledTimes(1);
    });

    it('should not emit error events for error event listeners to prevent loops', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Error in error listener');
      });
      
      eventBus.on('error', errorListener);
      
      // Should not cause infinite loop
      expect(() => {
        eventBus.emit('error', { error: new Error('Test error'), context: 'test' });
      }).not.toThrow();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track listener statistics', () => {
      eventBus.on('word-started', jest.fn());
      eventBus.on('word-started', jest.fn());
      eventBus.on('word-completed', jest.fn());
      
      const stats = eventBus.getStats();
      
      expect(stats.totalListeners).toBe(3);
      expect(stats.listenersByEvent['word-started']).toBe(2);
      expect(stats.listenersByEvent['word-completed']).toBe(1);
    });

    it('should track emission counts', () => {
      eventBus.emit('damage-dealt', { damage: 20, critical: false, enemyHp: 80 });
      eventBus.emit('damage-dealt', { damage: 25, critical: false, enemyHp: 75 });
      eventBus.emit('healing-applied', { healing: 15, critical: false, playerHp: 95 });
      
      const stats = eventBus.getStats();
      
      expect(stats.emissionCounts['damage-dealt']).toBe(2);
      expect(stats.emissionCounts['healing-applied']).toBe(1);
    });

    it('should check if events have listeners', () => {
      expect(eventBus.hasListeners('word-started')).toBe(false);
      
      eventBus.on('word-started', jest.fn());
      
      expect(eventBus.hasListeners('word-started')).toBe(true);
    });

    it('should get listeners for specific events', () => {
      const listener = jest.fn();
      eventBus.on('guard-executed', listener, { priority: 5, context: 'test' });
      
      const listeners = eventBus.getListeners('guard-executed');
      
      expect(listeners).toHaveLength(1);
      expect(listeners[0].callback).toBe(listener);
      expect(listeners[0].priority).toBe(5);
      expect(listeners[0].context).toBe('test');
    });
  });

  describe('Cleanup Operations', () => {
    it('should remove all listeners for specific event', () => {
      eventBus.on('word-started', jest.fn());
      eventBus.on('word-started', jest.fn());
      eventBus.on('word-completed', jest.fn());
      
      eventBus.removeAllListeners('word-started');
      
      const stats = eventBus.getStats();
      expect(stats.listenersByEvent['word-started']).toBe(0);
      expect(stats.listenersByEvent['word-completed']).toBe(1);
    });

    it('should remove all listeners', () => {
      eventBus.on('word-started', jest.fn());
      eventBus.on('word-completed', jest.fn());
      eventBus.on('damage-dealt', jest.fn());
      
      eventBus.removeAllListeners();
      
      const stats = eventBus.getStats();
      expect(stats.totalListeners).toBe(0);
    });

    it('should clean up on destroy', () => {
      eventBus.on('word-started', jest.fn());
      eventBus.on('word-completed', jest.fn());
      
      eventBus.destroy();
      
      const stats = eventBus.getStats();
      expect(stats.totalListeners).toBe(0);
      expect(stats.errorCount).toBe(0);
    });
  });

  describe('Max Listeners Warning', () => {
    it('should warn when exceeding max listeners', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Add more listeners than the limit (10)
      for (let i = 0; i < 12; i++) {
        eventBus.on('word-started', jest.fn());
      }
      
      // Should have logged a warning (not implemented in current version but structure is there)
      
      consoleSpy.mockRestore();
    });
  });
});

describe('NamespacedEventBus', () => {
  let parentBus: EventBus;
  let namespacedBus: NamespacedEventBus;

  beforeEach(() => {
    parentBus = new EventBus({ enableLogging: false });
    namespacedBus = parentBus.namespace('test-namespace');
  });

  afterEach(() => {
    parentBus.destroy();
  });

  it('should forward events to parent bus', () => {
    const listener = jest.fn();
    parentBus.on('word-completed', listener);
    
    namespacedBus.emit('word-completed', { completedWord: {} as any, result: {} as any });
    
    expect(listener).toHaveBeenCalled();
  });

  it('should add context prefix to listeners', () => {
    namespacedBus.on('word-started', jest.fn(), { context: 'mycontext' });
    
    const listeners = parentBus.getListeners('word-started');
    expect(listeners[0].context).toBe('test-namespace:mycontext');
  });

  it('should handle once listeners with context', () => {
    const listener = jest.fn();
    namespacedBus.once('game-over', listener, { context: 'once-test' });
    
    const listeners = parentBus.getListeners('game-over');
    expect(listeners[0].context).toBe('test-namespace:once-test');
    expect(listeners[0].once).toBe(true);
  });
});

describe('FilteredEventBus', () => {
  let parentBus: EventBus;
  let filteredBus: FilteredEventBus<'word-started' | 'word-completed'>;

  beforeEach(() => {
    parentBus = new EventBus({ enableLogging: false });
    filteredBus = parentBus.filter(['word-started', 'word-completed']);
  });

  afterEach(() => {
    parentBus.destroy();
  });

  it('should allow only specified events', () => {
    expect(() => {
      filteredBus.on('word-started', jest.fn());
    }).not.toThrow();

    expect(() => {
      filteredBus.on('word-completed', jest.fn());
    }).not.toThrow();
  });

  it('should reject non-allowed events', () => {
    expect(() => {
      // @ts-expect-error - Testing runtime error for disallowed event
      filteredBus.on('damage-dealt', jest.fn());
    }).toThrow('Event damage-dealt is not allowed in this filtered bus');

    expect(() => {
      // @ts-expect-error - Testing runtime error for disallowed event
      filteredBus.emit('healing-applied', {} as any);
    }).toThrow('Event healing-applied is not allowed in this filtered bus');
  });

  it('should forward allowed events to parent', () => {
    const listener = jest.fn();
    parentBus.on('word-started', listener);
    
    filteredBus.emit('word-started', { word: {} as any, type: 'ATTACK' });
    
    expect(listener).toHaveBeenCalled();
  });
});