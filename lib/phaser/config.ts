import * as Phaser from 'phaser'

export const createPhaserConfig = (parent: string): Phaser.Types.Core.GameConfig => ({
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: parent,
  backgroundColor: '#2c3e50',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  fps: {
    target: 60,
    forceSetTimeOut: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600,
    min: {
      width: 320,
      height: 240
    },
    max: {
      width: 1280,
      height: 720
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
})

function preload(this: Phaser.Scene) {
  // Basic loading
  this.load.on('complete', () => {
    console.log('Phaser assets loaded successfully')
  })
}

function create(this: Phaser.Scene) {
  // Basic scene setup
  this.add.text(400, 300, 'Typing Quest\nGame Engine Ready!', {
    fontSize: '32px',
    color: '#ffffff',
    align: 'center'
  }).setOrigin(0.5)

  this.add.text(400, 400, 'Press any key to start typing...', {
    fontSize: '16px',
    color: '#cccccc',
    align: 'center'
  }).setOrigin(0.5)
}

function update(this: Phaser.Scene) {
  // Game loop
}