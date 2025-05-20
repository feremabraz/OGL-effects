'use client';

import type * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { atom, useAtom } from 'jotai';

export const pixelFireConfigAtom = atom({
  // Resolution settings
  cellSize: 4, // Size of each pixel in the fire

  // Fire settings
  cooling: 0.3, // How quickly the fire cools down (0-1)
  spreadFactor: 0.8, // How much the fire spreads (0-1)

  // Visual settings
  colorMode: 'classic', // "classic", "blue", "green", "rainbow"

  // Interaction
  enableMouseInteraction: true,
  mouseHeatIntensity: 3.0, // How much heat the mouse adds
});

interface PixelFireProps {
  className?: string;
}

const PixelFire: React.FC<PixelFireProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>(0);
  const [config, setConfig] = useAtom(pixelFireConfigAtom);
  const [colorMode, setColorMode] = useState<string>(config.colorMode);
  const [fps, setFps] = useState<number>(0);
  const fpsValues = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(0);

  // Fire simulation state
  const firePixelsRef = useRef<Uint8Array | null>(null);
  const fireWidthRef = useRef<number>(0);
  const fireHeightRef = useRef<number>(0);

  // Mouse state
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const mouseDownRef = useRef<boolean>(false);

  const { cellSize, cooling, spreadFactor, enableMouseInteraction, mouseHeatIntensity } = config;

  // Handle color mode change
  const handleColorModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newMode = e.target.value;
      setColorMode(newMode);
      setConfig({ ...config, colorMode: newMode });
    },
    [config, setConfig]
  );

  // Create color palettes
  const createFirePalette = useCallback((mode: string): Uint8ClampedArray => {
    const palette = new Uint8ClampedArray(256 * 4);

    for (let i = 0; i < 256; i++) {
      let r, g, b;

      if (mode === 'classic') {
        // Classic fire palette (red to yellow)
        if (i === 0) {
          r = 0;
          g = 0;
          b = 0; // Black for no fire
        } else if (i < 64) {
          r = Math.floor(i * 3);
          g = 0;
          b = 0;
        } else if (i < 128) {
          r = Math.floor(255 - (128 - i) * 2);
          g = Math.floor((i - 64) * 3);
          b = 0;
        } else if (i < 192) {
          r = 255;
          g = Math.floor(128 + (i - 128) * 2);
          b = 0;
        } else {
          r = 255;
          g = 255;
          b = Math.floor((i - 192) * 4);
        }
      } else if (mode === 'blue') {
        // Blue fire palette
        if (i === 0) {
          r = 0;
          g = 0;
          b = 0; // Black for no fire
        } else if (i < 64) {
          r = 0;
          g = 0;
          b = Math.floor(i * 3);
        } else if (i < 128) {
          r = 0;
          g = Math.floor((i - 64) * 3);
          b = Math.floor(255 - (128 - i) * 2);
        } else if (i < 192) {
          r = Math.floor((i - 128) * 3);
          g = Math.floor(128 + (i - 128) * 2);
          b = 255;
        } else {
          r = Math.floor(192 + (i - 192) * 1);
          g = 255;
          b = 255;
        }
      } else if (mode === 'green') {
        // Green fire palette
        if (i === 0) {
          r = 0;
          g = 0;
          b = 0; // Black for no fire
        } else if (i < 64) {
          r = 0;
          g = Math.floor(i * 3);
          b = 0;
        } else if (i < 128) {
          r = 0;
          g = Math.floor(255 - (128 - i) * 2);
          b = Math.floor((i - 64) * 3);
        } else if (i < 192) {
          r = Math.floor((i - 128) * 3);
          g = 255;
          b = Math.floor(128 + (i - 128) * 2);
        } else {
          r = Math.floor(192 + (i - 192) * 1);
          g = 255;
          b = 255;
        }
      } else if (mode === 'rainbow') {
        // Rainbow fire palette
        if (i === 0) {
          r = 0;
          g = 0;
          b = 0; // Black for no fire
        } else {
          // HSV to RGB conversion with hue based on intensity
          const h = (i / 256) * 360;
          const s = 1.0;
          const v = Math.min(1.0, i / 200);

          const c = v * s;
          const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
          const m = v - c;

          let r1, g1, b1;
          if (h < 60) {
            r1 = c;
            g1 = x;
            b1 = 0;
          } else if (h < 120) {
            r1 = x;
            g1 = c;
            b1 = 0;
          } else if (h < 180) {
            r1 = 0;
            g1 = c;
            b1 = x;
          } else if (h < 240) {
            r1 = 0;
            g1 = x;
            b1 = c;
          } else if (h < 300) {
            r1 = x;
            g1 = 0;
            b1 = c;
          } else {
            r1 = c;
            g1 = 0;
            b1 = x;
          }

          r = Math.floor((r1 + m) * 255);
          g = Math.floor((g1 + m) * 255);
          b = Math.floor((b1 + m) * 255);
        }
      } else {
        // Default to classic if unknown mode
        if (i === 0) {
          r = 0;
          g = 0;
          b = 0; // Black for no fire
        } else if (i < 64) {
          r = Math.floor(i * 3);
          g = 0;
          b = 0;
        } else if (i < 128) {
          r = Math.floor(255 - (128 - i) * 2);
          g = Math.floor((i - 64) * 3);
          b = 0;
        } else if (i < 192) {
          r = 255;
          g = Math.floor(128 + (i - 128) * 2);
          b = 0;
        } else {
          r = 255;
          g = 255;
          b = Math.floor((i - 192) * 4);
        }
      }

      const idx = i * 4;
      palette[idx] = r;
      palette[idx + 1] = g;
      palette[idx + 2] = b;
      palette[idx + 3] = 255; // Full alpha
    }

    return palette;
  }, []);

  // Initialize fire simulation
  const initFire = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const width = Math.ceil(canvas.width / cellSize);
    const height = Math.ceil(canvas.height / cellSize);

    fireWidthRef.current = width;
    fireHeightRef.current = height;

    // Create fire pixels array
    const firePixels = new Uint8Array(width * height);

    // Initialize with zeros (no fire)
    firePixels.fill(0);

    // Set bottom row to maximum heat
    for (let x = 0; x < width; x++) {
      firePixels[(height - 1) * width + x] = 255;
    }

    firePixelsRef.current = firePixels;
  }, [cellSize]);

  // Update fire simulation
  const updateFire = useCallback(() => {
    if (!firePixelsRef.current) return;

    const width = fireWidthRef.current;
    const height = fireHeightRef.current;
    const firePixels = firePixelsRef.current;

    // Process each pixel except the bottom row
    for (let y = 0; y < height - 1; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        // Apply cooling
        const coolAmount = Math.random() * cooling * 3;

        // Get pixel below
        const belowIdx = (y + 1) * width + x;
        let value = firePixels[belowIdx];

        // Apply cooling
        if (value > coolAmount) {
          value -= coolAmount;
        } else {
          value = 0;
        }

        // Apply spread
        if (value > 0 && Math.random() < spreadFactor) {
          const spreadX = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1

          // Ensure we don't go out of bounds
          const newX = (x + spreadX + width) % width;
          const newIdx = y * width + newX;

          // Update pixel with spread value
          firePixels[newIdx] = value;
        } else {
          // Update pixel with cooled value
          firePixels[idx] = value;
        }
      }
    }

    // Apply mouse heat if mouse is down
    if (enableMouseInteraction && mousePositionRef.current && mouseDownRef.current) {
      const { x, y } = mousePositionRef.current;

      // Convert mouse position to fire grid coordinates
      const fireX = Math.floor(x / cellSize);
      const fireY = Math.floor(y / cellSize);

      // Add heat in a small radius around the mouse
      const radius = 3;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance <= radius) {
            const fx = (fireX + dx + width) % width;
            const fy = fireY + dy;

            // Ensure we're within bounds
            if (fy >= 0 && fy < height) {
              const idx = fy * width + fx;
              const heatAmount = Math.floor((1 - distance / radius) * 255 * mouseHeatIntensity);
              firePixels[idx] = Math.min(255, firePixels[idx] + heatAmount);
            }
          }
        }
      }
    }
  }, [cooling, spreadFactor, enableMouseInteraction, cellSize, mouseHeatIntensity]);

  // Render fire to canvas
  const renderFire = useCallback((palette: Uint8ClampedArray) => {
    if (!canvasRef.current || !firePixelsRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = fireWidthRef.current;
    const height = fireHeightRef.current;
    const firePixels = firePixelsRef.current;

    // Create image data
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Fill image data from fire pixels using palette
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const value = firePixels[idx];

        // Get color from palette
        const colorIdx = value * 4;
        const r = palette[colorIdx];
        const g = palette[colorIdx + 1];
        const b = palette[colorIdx + 2];

        // Set pixel in image data
        const imgIdx = idx * 4;
        data[imgIdx] = r;
        data[imgIdx + 1] = g;
        data[imgIdx + 2] = b;
        data[imgIdx + 3] = 255; // Full alpha
      }
    }

    // Create a temporary canvas for the low-res fire
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Put the image data on the temporary canvas
    tempCtx.putImageData(imageData, 0, 0);

    // Clear the main canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the temporary canvas to the main canvas with nearest-neighbor scaling
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, canvas.width, canvas.height);
  }, []);

  // Main effect setup
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.imageRendering = 'pixelated'; // Ensure crisp pixel rendering

    container.appendChild(canvas);
    canvasRef.current = canvas;

    // Initialize fire simulation
    initFire();

    // Create color palette
    const palette = createFirePalette(colorMode);

    function resize() {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Reinitialize fire with new dimensions
      initFire();
    }

    window.addEventListener('resize', resize);

    // Mouse interaction
    function handleMouseMove(e: MouseEvent) {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      mousePositionRef.current = { x, y };
    }

    function handleMouseDown() {
      mouseDownRef.current = true;
    }

    function handleMouseUp() {
      mouseDownRef.current = false;
    }

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      mouseDownRef.current = true;
      if (e.touches.length > 0) {
        const rect = container.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const y = e.touches[0].clientY - rect.top;
        mousePositionRef.current = { x, y };
      }
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length > 0) {
        const rect = container.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left;
        const y = e.touches[0].clientY - rect.top;
        mousePositionRef.current = { x, y };
      }
    }

    function handleTouchEnd() {
      mouseDownRef.current = false;
    }

    if (enableMouseInteraction) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mousedown', handleMouseDown);
      container.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('mouseup', handleMouseUp);
    }

    // Animation loop with FPS calculation
    function update(t: number) {
      // Calculate FPS
      if (lastFrameTime.current) {
        const frameTime = t - lastFrameTime.current;
        const currentFps = 1000 / frameTime;

        // Store last 10 FPS values for averaging
        fpsValues.current.push(currentFps);
        if (fpsValues.current.length > 10) {
          fpsValues.current.shift();
        }

        // Update FPS display every 10 frames
        if (t % 10 < 1) {
          const avgFps =
            fpsValues.current.reduce((sum, fps) => sum + fps, 0) / fpsValues.current.length;
          setFps(Math.round(avgFps));
        }
      }
      lastFrameTime.current = t;

      // Update fire simulation
      updateFire();

      // Render fire
      renderFire(palette);

      animationFrameId.current = requestAnimationFrame(update);
    }

    animationFrameId.current = requestAnimationFrame(update);

    // Cleanup
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', resize);

      if (enableMouseInteraction) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mousedown', handleMouseDown);
        container.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('mouseup', handleMouseUp);
      }

      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [initFire, updateFire, renderFire, colorMode, enableMouseInteraction, createFirePalette]);

  // Update palette when color mode changes
  useEffect(() => {
    // This will trigger a re-render with the new palette
  }, [colorMode]);

  return (
    <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`}>
      {/* FPS Counter */}
      <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {fps} FPS
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-3 rounded">
        <h3 className="text-sm font-bold mb-2">Pixel Fire Controls</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs">Color Mode:</label>
            <select
              className="bg-black/70 text-white text-xs p-1 rounded"
              value={colorMode}
              onChange={handleColorModeChange}
            >
              <option value="classic">Classic</option>
              <option value="blue">Blue</option>
              <option value="green">Green</option>
              <option value="rainbow">Rainbow</option>
            </select>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-2 rounded text-xs max-w-xs text-right">
        Click and drag to add fire
      </div>
    </div>
  );
};

export { PixelFire };
