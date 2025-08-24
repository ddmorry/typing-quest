'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameAdapter } from '@/lib/game/GameAdapter';
import type { GameState, GameConfig, SessionSeed, Word } from '@/lib/game/types';

interface GameCanvasProps {
  className?: string;
  // Optional props for configuration
  difficulty?: 'EASY' | 'NORMAL' | 'HARD';
  packId?: string;
  sessionId?: string;
  onGameOver?: (result: 'WIN' | 'LOSE', stats: any) => void;
}

interface GameStatus {
  status: 'LOADING' | 'READY' | 'PLAYING' | 'PAUSED' | 'ENDED' | 'ERROR';
  message?: string;
  error?: Error;
}

export default function GameCanvas({ 
  className = '',
  difficulty = 'NORMAL',
  packId = 'default-pack',
  sessionId = 'default-session',
  onGameOver
}: GameCanvasProps) {
  const gameRef = useRef<HTMLDivElement>(null);
  const adapterRef = useRef<GameAdapter | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>({ status: 'LOADING' });
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentInput, setCurrentInput] = useState('');

  // =============================================================================
  // GAME ADAPTER INITIALIZATION
  // =============================================================================

  const initializeGameAdapter = useCallback(async () => {
    if (!gameRef.current) {
      setGameStatus({ status: 'ERROR', error: new Error('Game container not available') });
      return;
    }

    try {
      setGameStatus({ status: 'LOADING', message: 'Loading game engine...' });

      // Dynamic import of PhaserAdapter - ensures it only loads when needed
      const { PhaserAdapter } = await import('@/lib/game/PhaserAdapter');
      
      if (!gameRef.current) return; // Component might have unmounted

      // Create game adapter instance
      const adapter = new PhaserAdapter();
      adapterRef.current = adapter;

      // Set up event listeners
      setupGameEventListeners(adapter);

      // Create game configuration
      const gameConfig: GameConfig = {
        width: 800,
        height: 600,
        difficulty,
        packId,
        sessionId,
        durationSec: 300, // 5 minutes
        settings: {
          a11y: {
            highContrast: false,
            openDyslexic: false,
            reduceMotion: false,
            fontSize: 'medium',
            letterSpacing: 'normal',
            soundEnabled: true,
            voiceEnabled: false,
          },
          sound: {
            enabled: true,
            volume: 0.7,
            effects: true,
            music: true,
          },
        },
      };

      setGameStatus({ status: 'LOADING', message: 'Mounting game...' });

      // Mount the game adapter
      await adapter.mount(gameRef.current, gameConfig);

      setGameStatus({ status: 'READY', message: 'Game ready - Click to start!' });

      console.log('GameAdapter initialized successfully');
    } catch (error) {
      console.error('Failed to initialize GameAdapter:', error);
      setGameStatus({ 
        status: 'ERROR', 
        error: error as Error,
        message: 'Failed to initialize game engine'
      });
    }
  }, [difficulty, packId, sessionId]);

  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================

  const setupGameEventListeners = (adapter: GameAdapter) => {
    // State change listener
    const unsubscribeState = adapter.subscribe((state: GameState) => {
      setGameState(state);
      
      // Handle game over
      if (state.status === 'ENDED') {
        const result = state.hp.enemy <= 0 ? 'WIN' : 'LOSE';
        onGameOver?.(result, state.stats);
      }
    });

    // Game event listeners
    adapter.on('word-started', (data) => {
      console.log('Word started:', data);
    });

    adapter.on('word-completed', (data) => {
      console.log('Word completed:', data);
      setCurrentInput(''); // Clear input display
    });

    adapter.on('word-failed', (data) => {
      console.log('Word failed:', data);
      setCurrentInput(''); // Clear input display
    });

    adapter.on('error', (data) => {
      console.error('Game error:', data);
      setGameStatus({ 
        status: 'ERROR', 
        error: data.error,
        message: `Game error: ${data.error.message}`
      });
    });

    // Store cleanup functions
    (adapter as any)._cleanupListeners = () => {
      unsubscribeState();
    };
  };

  const startGame = async () => {
    if (!adapterRef.current || gameStatus.status !== 'READY') return;

    try {
      setGameStatus({ status: 'LOADING', message: 'Starting game...' });

      // Create mock session seed (in real app, this would come from API)
      const sessionSeed: SessionSeed = {
        sessionId,
        packId,
        difficulty,
        words: generateMockWords(), // Mock words for demo
      };

      await adapterRef.current.start(sessionSeed);
      setGameStatus({ status: 'PLAYING' });
    } catch (error) {
      console.error('Failed to start game:', error);
      setGameStatus({ 
        status: 'ERROR', 
        error: error as Error,
        message: 'Failed to start game'
      });
    }
  };

  const pauseGame = () => {
    if (adapterRef.current && gameStatus.status === 'PLAYING') {
      adapterRef.current.pause();
      setGameStatus({ status: 'PAUSED' });
    }
  };

  const resumeGame = () => {
    if (adapterRef.current && gameStatus.status === 'PAUSED') {
      adapterRef.current.resume();
      setGameStatus({ status: 'PLAYING' });
    }
  };

  // =============================================================================
  // KEYBOARD INPUT HANDLING
  // =============================================================================

  useEffect(() => {
    if (gameStatus.status !== 'PLAYING' || !adapterRef.current) return;

    const handleKeyDown = async (event: KeyboardEvent) => {
      // Prevent default browser behavior for game keys
      if (event.key !== 'Tab' && event.key !== 'F5') {
        event.preventDefault();
      }

      try {
        await adapterRef.current!.processKeystroke(event.key);
        
        // Update current input for display (simplified)
        if (event.key === 'Backspace') {
          setCurrentInput(prev => prev.slice(0, -1));
        } else if (event.key.length === 1) {
          setCurrentInput(prev => prev + event.key);
        } else if (event.key === 'Enter') {
          setCurrentInput('');
        }
      } catch (error) {
        console.error('Error processing keystroke:', error);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameStatus.status]);

  // =============================================================================
  // LIFECYCLE
  // =============================================================================

  useEffect(() => {
    initializeGameAdapter();

    return () => {
      // Cleanup
      if (adapterRef.current) {
        // Call cleanup function if it exists
        if ((adapterRef.current as any)._cleanupListeners) {
          (adapterRef.current as any)._cleanupListeners();
        }
        
        adapterRef.current.destroy();
        adapterRef.current = null;
      }
    };
  }, [initializeGameAdapter]);

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const renderGameStatus = () => {
    switch (gameStatus.status) {
      case 'LOADING':
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 rounded-lg">
            <div className="text-center">
              <div className="text-white text-xl mb-2">Loading...</div>
              {gameStatus.message && (
                <div className="text-gray-300 text-sm">{gameStatus.message}</div>
              )}
            </div>
          </div>
        );

      case 'READY':
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 rounded-lg">
            <div className="text-center">
              <div className="text-white text-2xl mb-4">Game Ready!</div>
              <button
                onClick={startGame}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Start Game
              </button>
            </div>
          </div>
        );

      case 'PAUSED':
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 rounded-lg">
            <div className="text-center">
              <div className="text-white text-2xl mb-4">Game Paused</div>
              <div className="space-x-4">
                <button
                  onClick={resumeGame}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Resume
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Restart
                </button>
              </div>
            </div>
          </div>
        );

      case 'ENDED':
        const result = gameState?.hp.enemy === 0 ? 'Victory!' : 'Game Over';
        const resultColor = result === 'Victory!' ? 'text-green-400' : 'text-red-400';
        
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 rounded-lg">
            <div className="text-center">
              <div className={`text-3xl mb-2 ${resultColor}`}>{result}</div>
              {gameState && (
                <div className="text-white text-sm mb-4">
                  <div>Final Score: {gameState.stats.totalDamage + gameState.stats.totalHealing}</div>
                  <div>Accuracy: {(gameState.stats.accuracy * 100).toFixed(1)}%</div>
                  <div>WPM: {gameState.stats.wpm}</div>
                  <div>Max Combo: {gameState.stats.maxCombo}</div>
                </div>
              )}
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Play Again
              </button>
            </div>
          </div>
        );

      case 'ERROR':
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-90 rounded-lg">
            <div className="text-center max-w-md">
              <div className="text-red-300 text-xl mb-2">Error</div>
              <div className="text-red-200 text-sm mb-4">
                {gameStatus.message || gameStatus.error?.message || 'Unknown error occurred'}
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Reload
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderGameControls = () => {
    if (gameStatus.status !== 'PLAYING') return null;

    return (
      <div className="absolute top-1 right-1 sm:top-2 sm:right-2 z-10">
        <button
          onClick={pauseGame}
          className="px-2 py-1 sm:px-4 sm:py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-lg border border-yellow-500"
        >
          Pause
        </button>
      </div>
    );
  };

  const renderCurrentInput = () => {
    if (gameStatus.status !== 'PLAYING' || !currentInput) return null;

    return (
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 bg-opacity-90 px-4 py-2 rounded">
        <div className="text-white text-lg font-mono">{currentInput}</div>
      </div>
    );
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  return (
    <div className={`flex items-center justify-center min-h-screen p-2 sm:p-4 ${className}`}>
      <div className="relative w-full max-w-4xl">
        <div
          id="game-canvas"
          ref={gameRef}
          className="border border-gray-600 rounded-lg shadow-2xl w-full bg-gray-900 relative mx-auto"
          style={{ 
            aspectRatio: '4/3', 
            maxWidth: '800px', 
            width: '100%',
            maxHeight: 'calc(100vh - 100px)'
          }}
        >
          {renderGameControls()}
        </div>
        
        {renderGameStatus()}
        {renderCurrentInput()}
      </div>
    </div>
  );
}

// =============================================================================
// MOCK DATA HELPERS (TODO: Replace with real API calls)
// =============================================================================

function generateMockWords(): Word[] {
  const mockWords: Word[] = [
    { id: '1', text: 'hello', level: 1, length: 5, category: 'basic' },
    { id: '2', text: 'world', level: 1, length: 5, category: 'basic' },
    { id: '3', text: 'typing', level: 2, length: 6, category: 'common' },
    { id: '4', text: 'adventure', level: 3, length: 9, category: 'intermediate' },
    { id: '5', text: 'challenge', level: 3, length: 9, category: 'intermediate' },
    { id: '6', text: 'victory', level: 2, length: 7, category: 'common' },
    { id: '7', text: 'quest', level: 2, length: 5, category: 'common' },
    { id: '8', text: 'battle', level: 2, length: 6, category: 'action' },
    { id: '9', text: 'healing', level: 2, length: 7, category: 'medical' },
    { id: '10', text: 'defend', level: 2, length: 6, category: 'defense' },
    // Add more words as needed
  ];

  // Shuffle and return
  return mockWords.sort(() => Math.random() - 0.5);
}
