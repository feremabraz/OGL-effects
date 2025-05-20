'use client';

import type * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { atom, useAtom } from 'jotai';

export const pixelLandscapeConfigAtom = atom({
  // Resolution settings
  pixelSize: 4, // Size of each pixel

  // Landscape settings
  scrollSpeed: 0.5, // Horizontal scrolling speed
  timeSpeed: 0.1, // Day/night cycle speed

  // Visual settings
  colorMode: 'classic', // "classic", "pastel", "monochrome", "cyberpunk"

  // Interaction
  enableMouseInteraction: true,
});

interface PixelLandscapeProps {
  className?: string;
}

// Noise function for terrain generation
const noise = (x: number, seed = 0): number => {
  const X = Math.floor(x) + seed * 1000;
  const frac = x - Math.floor(x);

  // Simple hash function
  const h1 = Math.sin(X * 127.1) * 43758.5453;
  const h2 = Math.sin((X + 1) * 127.1) * 43758.5453;

  // Smooth interpolation
  const a = (h1 - Math.floor(h1)) * 2.0 - 1.0;
  const b = (h2 - Math.floor(h2)) * 2.0 - 1.0;

  // Cubic interpolation
  const t = frac * frac * (3.0 - 2.0 * frac);

  return a + (b - a) * t;
};

// Fractal noise for more natural terrain
const fractalNoise = (x: number, octaves: number, seed = 0): number => {
  let value = 0;
  let amplitude = 1.0;
  let frequency = 1.0;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += amplitude * noise(x * frequency, seed + i);
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  return value / maxValue;
};

const PixelLandscape: React.FC<PixelLandscapeProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>(0);
  const [config, setConfig] = useAtom(pixelLandscapeConfigAtom);
  const [colorMode, setColorMode] = useState<string>(config.colorMode);
  const [fps, setFps] = useState<number>(0);
  const fpsValues = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(0);

  // Landscape state
  const scrollOffsetRef = useRef<number>(0);
  const timeOfDayRef = useRef<number>(0); // 0-1 for day/night cycle
  const seedRef = useRef<number>(Math.random() * 1000);

  // Mouse state
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const mouseDownRef = useRef<boolean>(false);

  const { pixelSize, scrollSpeed, timeSpeed, enableMouseInteraction } = config;

  // Handle color mode change
  const handleColorModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newMode = e.target.value;
      setColorMode(newMode);
      setConfig({ ...config, colorMode: newMode });
    },
    [config, setConfig]
  );

  // Generate a new random landscape
  const regenerateLandscape = useCallback(() => {
    seedRef.current = Math.random() * 1000;
  }, []);

  // Get color based on color mode and parameters
  const getColor = useCallback(
    (type: string, height: number, time: number): string => {
      // Time of day affects colors (0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset)
      const isDaytime = time > 0.25 && time < 0.75;
      const isSunrise = time > 0.2 && time < 0.3;
      const isSunset = time > 0.7 && time < 0.8;

      // Base colors for different modes
      if (colorMode === 'classic') {
        // Classic pixel art palette
        switch (type) {
          case 'sky':
            if (isSunrise) {
              return `rgb(${Math.floor(255 * (time - 0.2) * 10)}, ${Math.floor(150 * (time - 0.2) * 10)}, ${Math.floor(100 * (time - 0.2) * 5)})`;
            } else if (isSunset) {
              return `rgb(${Math.floor(255 * (0.8 - time) * 10)}, ${Math.floor(150 * (0.8 - time) * 10)}, ${Math.floor(100 * (0.8 - time) * 5)})`;
            } else if (isDaytime) {
              return `rgb(100, 180, 255)`;
            } else {
              return `rgb(10, 20, ${Math.floor(50 + 50 * Math.sin(time * Math.PI * 2))})`;
            }
          case 'mountain':
            if (isDaytime) {
              return `rgb(${80 + height * 40}, ${90 + height * 40}, ${100 + height * 40})`;
            } else {
              return `rgb(${20 + height * 20}, ${30 + height * 20}, ${50 + height * 30})`;
            }
          case 'hill':
            if (isDaytime) {
              return `rgb(${60 + height * 60}, ${120 + height * 60}, ${40 + height * 30})`;
            } else {
              return `rgb(${20 + height * 20}, ${40 + height * 30}, ${20 + height * 10})`;
            }
          case 'ground':
            if (isDaytime) {
              return `rgb(${100 + height * 50}, ${80 + height * 40}, ${60 + height * 30})`;
            } else {
              return `rgb(${30 + height * 20}, ${25 + height * 15}, ${20 + height * 10})`;
            }
          case 'cloud':
            if (isDaytime) {
              return `rgba(255, 255, 255, ${0.7 + height * 0.3})`;
            } else {
              return `rgba(150, 160, 200, ${0.5 + height * 0.3})`;
            }
          case 'sun':
            if (isSunrise || isSunset) {
              return `rgb(255, ${150 + height * 50}, ${100 + height * 50})`;
            } else {
              return `rgb(255, ${220 + height * 35}, ${150 + height * 50})`;
            }
          case 'moon':
            return `rgb(${220 + height * 35}, ${220 + height * 35}, ${200 + height * 55})`;
          case 'star':
            return `rgb(${200 + height * 55}, ${200 + height * 55}, ${220 + height * 35})`;
          case 'tree':
            if (isDaytime) {
              return `rgb(${30 + height * 40}, ${100 + height * 80}, ${30 + height * 20})`;
            } else {
              return `rgb(${10 + height * 20}, ${30 + height * 40}, ${10 + height * 10})`;
            }
          case 'trunk':
            if (isDaytime) {
              return `rgb(${100 + height * 20}, ${70 + height * 10}, ${40 + height * 10})`;
            } else {
              return `rgb(${40 + height * 10}, ${30 + height * 5}, ${20 + height * 5})`;
            }
          default:
            return '#000';
        }
      } else if (colorMode === 'pastel') {
        // Pastel color palette
        switch (type) {
          case 'sky':
            if (isSunrise) {
              return `rgb(${Math.floor(255 * (time - 0.2) * 10)}, ${Math.floor(200 * (time - 0.2) * 10)}, ${Math.floor(220 * (time - 0.2) * 5)})`;
            } else if (isSunset) {
              return `rgb(${Math.floor(255 * (0.8 - time) * 10)}, ${Math.floor(200 * (0.8 - time) * 10)}, ${Math.floor(220 * (0.8 - time) * 5)})`;
            } else if (isDaytime) {
              return `rgb(180, 220, 250)`;
            } else {
              return `rgb(100, 120, ${Math.floor(170 + 30 * Math.sin(time * Math.PI * 2))})`;
            }
          case 'mountain':
            if (isDaytime) {
              return `rgb(${180 + height * 40}, ${190 + height * 40}, ${210 + height * 40})`;
            } else {
              return `rgb(${100 + height * 20}, ${110 + height * 20}, ${140 + height * 30})`;
            }
          case 'hill':
            if (isDaytime) {
              return `rgb(${150 + height * 60}, ${210 + height * 40}, ${150 + height * 30})`;
            } else {
              return `rgb(${80 + height * 20}, ${120 + height * 30}, ${80 + height * 10})`;
            }
          case 'ground':
            if (isDaytime) {
              return `rgb(${200 + height * 50}, ${180 + height * 40}, ${160 + height * 30})`;
            } else {
              return `rgb(${100 + height * 20}, ${90 + height * 15}, ${80 + height * 10})`;
            }
          case 'cloud':
            if (isDaytime) {
              return `rgba(255, 255, 255, ${0.7 + height * 0.3})`;
            } else {
              return `rgba(200, 210, 230, ${0.5 + height * 0.3})`;
            }
          case 'sun':
            return `rgb(255, ${220 + height * 35}, ${180 + height * 50})`;
          case 'moon':
            return `rgb(${230 + height * 25}, ${230 + height * 25}, ${210 + height * 45})`;
          case 'star':
            return `rgb(${220 + height * 35}, ${220 + height * 35}, ${240 + height * 15})`;
          case 'tree':
            if (isDaytime) {
              return `rgb(${130 + height * 40}, ${200 + height * 55}, ${130 + height * 20})`;
            } else {
              return `rgb(${70 + height * 20}, ${100 + height * 40}, ${70 + height * 10})`;
            }
          case 'trunk':
            if (isDaytime) {
              return `rgb(${180 + height * 20}, ${150 + height * 10}, ${120 + height * 10})`;
            } else {
              return `rgb(${100 + height * 10}, ${90 + height * 5}, ${70 + height * 5})`;
            }
          default:
            return '#000';
        }
      } else if (colorMode === 'monochrome') {
        // Monochrome palette
        const baseValue = isDaytime ? 200 : 100;
        switch (type) {
          case 'sky':
            if (isDaytime) {
              return `rgb(${baseValue + 30}, ${baseValue + 30}, ${baseValue + 30})`;
            } else {
              return `rgb(${baseValue - 80}, ${baseValue - 80}, ${baseValue - 80})`;
            }
          case 'mountain':
            return `rgb(${baseValue - 40 + height * 40}, ${baseValue - 40 + height * 40}, ${baseValue - 40 + height * 40})`;
          case 'hill':
            return `rgb(${baseValue - 20 + height * 40}, ${baseValue - 20 + height * 40}, ${baseValue - 20 + height * 40})`;
          case 'ground':
            return `rgb(${baseValue - 60 + height * 40}, ${baseValue - 60 + height * 40}, ${baseValue - 60 + height * 40})`;
          case 'cloud':
            return `rgba(${baseValue + 55}, ${baseValue + 55}, ${baseValue + 55}, ${0.7 + height * 0.3})`;
          case 'sun':
          case 'moon':
            return `rgb(${baseValue + 55}, ${baseValue + 55}, ${baseValue + 55})`;
          case 'star':
            return `rgb(${baseValue + 55}, ${baseValue + 55}, ${baseValue + 55})`;
          case 'tree':
            return `rgb(${baseValue - 100 + height * 40}, ${baseValue - 100 + height * 40}, ${baseValue - 100 + height * 40})`;
          case 'trunk':
            return `rgb(${baseValue - 120 + height * 40}, ${baseValue - 120 + height * 40}, ${baseValue - 120 + height * 40})`;
          default:
            return '#000';
        }
      } else if (colorMode === 'cyberpunk') {
        // Cyberpunk palette with neon colors
        switch (type) {
          case 'sky':
            if (isDaytime) {
              return `rgb(40, 10, 60)`;
            } else {
              return `rgb(10, 5, 20)`;
            }
          case 'mountain':
            return `rgb(${60 + height * 20}, ${10 + height * 5}, ${80 + height * 40})`;
          case 'hill':
            return `rgb(${20 + height * 10}, ${100 + height * 50}, ${100 + height * 50})`;
          case 'ground':
            return `rgb(${10 + height * 5}, ${20 + height * 10}, ${30 + height * 15})`;
          case 'cloud':
            return `rgba(${100 + height * 50}, ${20 + height * 10}, ${150 + height * 75}, ${0.3 + height * 0.2})`;
          case 'sun':
            return `rgb(${255 - height * 50}, ${50 + height * 25}, ${200 + height * 55})`;
          case 'moon':
            return `rgb(${50 + height * 25}, ${200 + height * 55}, ${255 - height * 50})`;
          case 'star':
            const hue = (height * 360) % 360;
            return `hsl(${hue}, 100%, 70%)`;
          case 'tree':
            return `rgb(${200 + height * 55}, ${50 + height * 25}, ${150 + height * 75})`;
          case 'trunk':
            return `rgb(${30 + height * 15}, ${10 + height * 5}, ${40 + height * 20})`;
          default:
            return '#000';
        }
      } else {
        // Default to classic if unknown mode
        return '#000';
      }
    },
    [colorMode]
  );

  // Draw a pixel
  const drawPixel = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
      size: number = pixelSize
    ) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, size, size);
    },
    [pixelSize]
  );

  // Draw the landscape
  const renderLandscape = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas with a background color
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    // Current scroll offset
    const scrollOffset = scrollOffsetRef.current;

    // Time of day (0-1)
    const timeOfDay = timeOfDayRef.current;

    // Draw sky
    for (let y = 0; y < height / 2; y++) {
      const skyHeight = 1 - y / (height / 2);
      const skyColor = getColor('sky', skyHeight, timeOfDay);
      ctx.fillStyle = skyColor;
      ctx.fillRect(0, y, width, pixelSize);
    }

    // Draw stars (only at night)
    if (timeOfDay < 0.25 || timeOfDay > 0.75) {
      const starDensity = 0.0005; // Adjust for more/fewer stars
      for (let x = 0; x < width; x += pixelSize) {
        for (let y = 0; y < height / 2; y += pixelSize) {
          // Use a hash function to make stars consistent
          const hash = Math.sin(x * 0.1 + y * 0.2 + seedRef.current) * 10000;
          if (hash % 1 < starDensity) {
            const brightness = (hash * 10) % 1;
            const starColor = getColor('star', brightness, timeOfDay);
            drawPixel(ctx, x, y, starColor);
          }
        }
      }
    }

    // Draw sun or moon
    const celestialSize = 20 * pixelSize;
    const celestialX = width * 0.8;
    const celestialY = height * 0.3 - Math.sin(timeOfDay * Math.PI * 2) * height * 0.25;

    if (timeOfDay > 0.25 && timeOfDay < 0.75) {
      // Draw sun
      for (let x = 0; x < celestialSize; x += pixelSize) {
        for (let y = 0; y < celestialSize; y += pixelSize) {
          const dx = x - celestialSize / 2;
          const dy = y - celestialSize / 2;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < celestialSize / 2) {
            const brightness = 1 - distance / (celestialSize / 2);
            const sunColor = getColor('sun', brightness, timeOfDay);
            drawPixel(
              ctx,
              celestialX + x - celestialSize / 2,
              celestialY + y - celestialSize / 2,
              sunColor
            );
          }
        }
      }
    } else {
      // Draw moon
      for (let x = 0; x < celestialSize; x += pixelSize) {
        for (let y = 0; y < celestialSize; y += pixelSize) {
          const dx = x - celestialSize / 2;
          const dy = y - celestialSize / 2;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < celestialSize / 2) {
            // Add some craters
            const craterNoise = noise(x * 0.2 + y * 0.2, seedRef.current + 100);
            const brightness = 1 - distance / (celestialSize / 2) - Math.max(0, craterNoise * 0.2);
            const moonColor = getColor('moon', brightness, timeOfDay);
            drawPixel(
              ctx,
              celestialX + x - celestialSize / 2,
              celestialY + y - celestialSize / 2,
              moonColor
            );
          }
        }
      }
    }

    // Draw clouds with parallax
    const cloudCount = 10;
    for (let i = 0; i < cloudCount; i++) {
      const cloudWidth = 30 + Math.floor(Math.random() * 50);
      const cloudHeight = 10 + Math.floor(Math.random() * 10);
      const cloudX =
        (((i * width) / cloudCount + scrollOffset * 0.3) % (width + cloudWidth)) - cloudWidth;
      const cloudY = 50 + Math.floor(Math.random() * 100);

      // Draw cloud
      for (let x = 0; x < cloudWidth; x += pixelSize) {
        for (let y = 0; y < cloudHeight; y += pixelSize) {
          const dx = x - cloudWidth / 2;
          const dy = y - cloudHeight / 2;
          const distance = Math.sqrt(dx * dx * 4 + dy * dy);
          if (distance < cloudHeight) {
            const cloudNoise = noise(x * 0.1 + y * 0.1 + i * 10, seedRef.current + 200);
            if (cloudNoise > 0.1) {
              const brightness = 0.7 + cloudNoise * 0.3;
              const cloudColor = getColor('cloud', brightness, timeOfDay);
              drawPixel(ctx, cloudX + x, cloudY + y, cloudColor);
            }
          }
        }
      }
    }

    // Draw far mountains with parallax
    const mountainHeight = height * 0.4;
    const mountainSegments = Math.ceil(width / pixelSize) + 1;
    for (let x = 0; x < mountainSegments; x++) {
      const worldX = x + scrollOffset * 0.5;
      const mountainNoise = (fractalNoise(worldX * 0.01, 4, seedRef.current) + 1) * 0.5;
      const mountainY = height * 0.6 - mountainNoise * mountainHeight;

      // Draw mountain column
      for (let y = mountainY; y < height * 0.6; y += pixelSize) {
        const mountainDepth = (y - mountainY) / (height * 0.6 - mountainY);
        const mountainColor = getColor('mountain', mountainDepth, timeOfDay);
        drawPixel(ctx, x * pixelSize, y, mountainColor);
      }
    }

    // Draw hills with parallax
    const hillHeight = height * 0.2;
    const hillSegments = Math.ceil(width / pixelSize) + 1;
    for (let x = 0; x < hillSegments; x++) {
      const worldX = x + scrollOffset * 0.8;
      const hillNoise = (fractalNoise(worldX * 0.02, 3, seedRef.current + 1000) + 1) * 0.5;
      const hillY = height * 0.7 - hillNoise * hillHeight;

      // Draw hill column
      for (let y = hillY; y < height * 0.7; y += pixelSize) {
        const hillDepth = (y - hillY) / (height * 0.7 - hillY);
        const hillColor = getColor('hill', hillDepth, timeOfDay);
        drawPixel(ctx, x * pixelSize, y, hillColor);
      }
    }

    // Draw ground
    for (let y = height * 0.7; y < height; y += pixelSize) {
      const groundDepth = (y - height * 0.7) / (height - height * 0.7);
      const groundColor = getColor('ground', groundDepth, timeOfDay);
      ctx.fillStyle = groundColor;
      ctx.fillRect(0, y, width, pixelSize);
    }

    // Draw trees
    const treeCount = 20;
    for (let i = 0; i < treeCount; i++) {
      const treeHeight = 30 + Math.floor(Math.random() * 30);
      const treeWidth = 20 + Math.floor(Math.random() * 10);
      const treeX =
        (((i * width) / treeCount + scrollOffset * 1.2) % (width + treeWidth)) - treeWidth;
      const treeY = height * 0.7 - treeHeight;

      // Draw trunk
      const trunkWidth = treeWidth / 4;
      for (
        let x = treeX + treeWidth / 2 - trunkWidth / 2;
        x < treeX + treeWidth / 2 + trunkWidth / 2;
        x += pixelSize
      ) {
        for (let y = treeY + treeHeight / 2; y < treeY + treeHeight; y += pixelSize) {
          const trunkDepth = (y - (treeY + treeHeight / 2)) / (treeHeight / 2);
          const trunkColor = getColor('trunk', trunkDepth, timeOfDay);
          drawPixel(ctx, x, y, trunkColor);
        }
      }

      // Draw foliage
      for (let x = 0; x < treeWidth; x += pixelSize) {
        for (let y = 0; y < treeHeight / 2; y += pixelSize) {
          const dx = x - treeWidth / 2;
          const dy = y - treeHeight / 4;
          const distance = Math.sqrt(dx * dx + dy * dy * 4);
          if (distance < treeWidth / 2) {
            const treeNoise = noise(x * 0.2 + y * 0.2 + i * 10, seedRef.current + 300);
            if (treeNoise > -0.2) {
              const foliageDepth = 0.5 + treeNoise * 0.5;
              const treeColor = getColor('tree', foliageDepth, timeOfDay);
              drawPixel(ctx, treeX + x, treeY + y, treeColor);
            }
          }
        }
      }
    }
  }, [drawPixel, getColor, pixelSize]);

  // Update landscape state
  const updateLandscape = useCallback(
    (deltaTime: number) => {
      // Update scroll offset
      scrollOffsetRef.current += scrollSpeed * deltaTime * 60;

      // Update time of day
      timeOfDayRef.current = (timeOfDayRef.current + timeSpeed * deltaTime) % 1;

      // Mouse interaction
      if (enableMouseInteraction && mousePositionRef.current && mouseDownRef.current) {
        // Change time of day based on mouse Y position
        const { y } = mousePositionRef.current;
        const canvas = canvasRef.current;
        if (canvas) {
          timeOfDayRef.current = y / canvas.height;
        }
      }
    },
    [scrollSpeed, timeSpeed, enableMouseInteraction]
  );

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

    // Initialize random seed
    seedRef.current = Math.random() * 1000;

    function resize() {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
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
    let lastTime = 0;
    function update(t: number) {
      // Calculate delta time
      const deltaTime = (t - lastTime) / 1000; // in seconds
      lastTime = t;

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

      // Update landscape
      updateLandscape(deltaTime);

      // Render landscape
      renderLandscape();

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
  }, [updateLandscape, renderLandscape, enableMouseInteraction]);

  return (
    <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`}>
      {/* FPS Counter */}
      <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {fps} FPS
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-3 rounded">
        <h3 className="text-sm font-bold mb-2">Pixel Landscape Controls</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs">Theme:</label>
            <select
              className="bg-black/70 text-white text-xs p-1 rounded"
              value={colorMode}
              onChange={handleColorModeChange}
            >
              <option value="classic">Classic</option>
              <option value="pastel">Pastel</option>
              <option value="monochrome">Monochrome</option>
              <option value="cyberpunk">Cyberpunk</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button className="text-xs px-2 py-1 rounded bg-blue-600" onClick={regenerateLandscape}>
              New Landscape
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-2 rounded text-xs max-w-xs text-right">
        Click and drag vertically to change time of day
      </div>
    </div>
  );
};

export { PixelLandscape };
