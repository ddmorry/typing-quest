import { PerformanceMetrics } from '../types';

/**
 * Performance monitoring utility for Phaser game
 * Tracks FPS, memory usage, and render performance
 */
export class PerformanceMonitor {
  private fpsHistory: number[] = [];
  private readonly maxHistorySize = 60; // Track last 60 frames
  private lastFrameTime = 0;
  private frameCount = 0;
  private startTime = Date.now();

  // Memory tracking (if available)
  private memorySupported: boolean;

  constructor() {
    this.memorySupported = !!(
      performance as Performance & { memory?: { usedJSHeapSize: number } }
    ).memory;
    this.reset();
  }

  /**
   * Update performance metrics - call this once per frame
   */
  update(): void {
    const currentTime = Date.now();

    // Calculate current FPS
    const deltaTime = currentTime - this.lastFrameTime;
    const currentFPS = deltaTime > 0 ? 1000 / deltaTime : 0;

    // Add to history
    this.fpsHistory.push(currentFPS);
    if (this.fpsHistory.length > this.maxHistorySize) {
      this.fpsHistory.shift();
    }

    this.lastFrameTime = currentTime;
    this.frameCount++;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const currentFPS =
      this.fpsHistory.length > 0
        ? this.fpsHistory[this.fpsHistory.length - 1]
        : 0;

    const averageFPS =
      this.fpsHistory.length > 0
        ? this.fpsHistory.reduce((sum, fps) => sum + fps, 0) /
          this.fpsHistory.length
        : 0;

    const memoryUsage = this.memorySupported
      ? ((performance as Performance & { memory?: { usedJSHeapSize: number } })
          .memory?.usedJSHeapSize || 0) /
        (1024 * 1024) // Convert to MB
      : 0;

    return {
      fps: Math.round(currentFPS),
      averageFPS: Math.round(averageFPS),
      memoryUsage: Math.round(memoryUsage * 100) / 100, // Round to 2 decimal places
      renderTime: 0, // Will be updated by game loop
      updateTime: 0, // Will be updated by game loop
    };
  }

  /**
   * Check if performance is within acceptable ranges
   */
  isPerformanceGood(): boolean {
    const metrics = this.getMetrics();
    return metrics.fps >= 30 && metrics.averageFPS >= 45;
  }

  /**
   * Get performance warnings
   */
  getWarnings(): string[] {
    const warnings: string[] = [];
    const metrics = this.getMetrics();

    if (metrics.fps < 30) {
      warnings.push('Low FPS detected (< 30fps)');
    }

    if (metrics.averageFPS < 45) {
      warnings.push('Poor average FPS (< 45fps)');
    }

    if (metrics.memoryUsage > 100) {
      warnings.push('High memory usage (> 100MB)');
    }

    return warnings;
  }

  /**
   * Get FPS statistics
   */
  getFPSStats(): {
    current: number;
    average: number;
    min: number;
    max: number;
    stability: number; // 0-100, higher is more stable
  } {
    if (this.fpsHistory.length === 0) {
      return { current: 0, average: 0, min: 0, max: 0, stability: 0 };
    }

    const current = this.fpsHistory[this.fpsHistory.length - 1];
    const average =
      this.fpsHistory.reduce((sum, fps) => sum + fps, 0) /
      this.fpsHistory.length;
    const min = Math.min(...this.fpsHistory);
    const max = Math.max(...this.fpsHistory);

    // Calculate stability as inverse of coefficient of variation
    const variance =
      this.fpsHistory.reduce(
        (sum, fps) => sum + Math.pow(fps - average, 2),
        0
      ) / this.fpsHistory.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation =
      average > 0 ? standardDeviation / average : 1;
    const stability = Math.max(
      0,
      Math.min(100, 100 - coefficientOfVariation * 100)
    );

    return {
      current: Math.round(current),
      average: Math.round(average),
      min: Math.round(min),
      max: Math.round(max),
      stability: Math.round(stability),
    };
  }

  /**
   * Log performance summary to console
   */
  logPerformanceSummary(): void {
    const metrics = this.getMetrics();
    const stats = this.getFPSStats();
    const warnings = this.getWarnings();

    console.group('🚀 Performance Monitor Summary');
    console.log(`Current FPS: ${stats.current}`);
    console.log(`Average FPS: ${stats.average}`);
    console.log(`FPS Range: ${stats.min}-${stats.max}`);
    console.log(`FPS Stability: ${stats.stability}%`);
    console.log(`Memory Usage: ${metrics.memoryUsage}MB`);

    if (warnings.length > 0) {
      console.warn('⚠️ Performance Warnings:', warnings);
    } else {
      console.log('✅ Performance is good');
    }
    console.groupEnd();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.fpsHistory = [];
    this.frameCount = 0;
    this.startTime = Date.now();
    this.lastFrameTime = Date.now();
  }

  /**
   * Create a simple performance overlay for debugging
   */
  createDebugOverlay(scene: Phaser.Scene): Phaser.GameObjects.Text {
    const overlay = scene.add
      .text(10, 10, '', {
        fontSize: '12px',
        color: '#00ff00',
        backgroundColor: '#000000',
        padding: { x: 5, y: 5 },
      })
      .setDepth(1000)
      .setScrollFactor(0);

    // Update overlay text every frame
    scene.events.on('postupdate', () => {
      const stats = this.getFPSStats();
      const metrics = this.getMetrics();

      overlay.setText(
        [
          `FPS: ${stats.current} (avg: ${stats.average})`,
          `Memory: ${metrics.memoryUsage}MB`,
          `Stability: ${stats.stability}%`,
        ].join('\n')
      );

      // Change color based on performance
      if (stats.current < 30) {
        overlay.setColor('#ff0000'); // Red for poor performance
      } else if (stats.current < 50) {
        overlay.setColor('#ffff00'); // Yellow for moderate performance
      } else {
        overlay.setColor('#00ff00'); // Green for good performance
      }
    });

    return overlay;
  }
}

/**
 * Global performance monitor instance
 * Can be shared across the application
 */
export const globalPerformanceMonitor = new PerformanceMonitor();
