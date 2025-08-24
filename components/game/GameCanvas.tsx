'use client'

import { useEffect, useRef, useState } from 'react'

interface GameCanvasProps {
  className?: string
}

export default function GameCanvas({ className = '' }: GameCanvasProps) {
  const gameRef = useRef<HTMLDivElement>(null)
  const phaserGameRef = useRef<any>(null)
  const [gameReady, setGameReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const initializePhaser = async () => {
      try {
        // Dynamic import of Phaser - this ensures it only loads on the /game page
        const Phaser = await import('phaser')
        const { createPhaserConfig } = await import('@/lib/phaser/config')

        if (!mounted || !gameRef.current) return

        // Create Phaser game instance
        const config = createPhaserConfig('game-canvas')
        phaserGameRef.current = new Phaser.Game(config)

        setGameReady(true)
        console.log('Phaser game initialized successfully')
      } catch (error) {
        console.error('Failed to initialize Phaser:', error)
      }
    }

    initializePhaser()

    return () => {
      mounted = false
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true)
        phaserGameRef.current = null
      }
    }
  }, [])

  return (
    <div className={`flex items-center justify-center min-h-screen p-4 ${className}`}>
      <div className="relative w-full max-w-4xl">
        <div
          id="game-canvas"
          ref={gameRef}
          className="border border-gray-600 rounded-lg shadow-2xl w-full"
          style={{ aspectRatio: '4/3', maxWidth: '800px', margin: '0 auto' }}
        />
        {!gameReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 rounded-lg">
            <div className="text-white text-xl">
              Initializing Phaser...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}