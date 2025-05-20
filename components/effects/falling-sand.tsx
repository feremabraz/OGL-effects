'use client';

import { useEffect, useRef, useState } from 'react';
import { atom, useAtom } from 'jotai';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Settings, Brush, Eraser, Trash2 } from 'lucide-react';

// Define material types
enum Material {
  EMPTY = 0,
  SAND = 1,
  WATER = 2,
  WALL = 3,
  FIRE = 4,
  WOOD = 5,
  PLANT = 6,
  OIL = 7,
  SMOKE = 8,
  SALT = 9,
}

// Define material properties
interface MaterialProps {
  name: string;
  color: string;
  density: number;
  flammable: boolean;
  lifespan: number;
  spreadRate: number;
}

// Material definitions
const MATERIALS: Record<Material, MaterialProps> = {
  [Material.EMPTY]: {
    name: 'Empty',
    color: '#000000',
    density: 0,
    flammable: false,
    lifespan: 0,
    spreadRate: 0,
  },
  [Material.SAND]: {
    name: 'Sand',
    color: '#e6c288',
    density: 3,
    flammable: false,
    lifespan: 0,
    spreadRate: 0,
  },
  [Material.WATER]: {
    name: 'Water',
    color: '#4a80f5',
    density: 2,
    flammable: false,
    lifespan: 0,
    spreadRate: 4,
  },
  [Material.WALL]: {
    name: 'Wall',
    color: '#888888',
    density: 10,
    flammable: false,
    lifespan: 0,
    spreadRate: 0,
  },
  [Material.FIRE]: {
    name: 'Fire',
    color: '#ff4400',
    density: 0.5,
    flammable: false,
    lifespan: 40,
    spreadRate: 2,
  },
  [Material.WOOD]: {
    name: 'Wood',
    color: '#8b4513',
    density: 4,
    flammable: true,
    lifespan: 0,
    spreadRate: 0,
  },
  [Material.PLANT]: {
    name: 'Plant',
    color: '#38a832',
    density: 1,
    flammable: true,
    lifespan: 0,
    spreadRate: 1,
  },
  [Material.OIL]: {
    name: 'Oil',
    color: '#8b572a',
    density: 1.5,
    flammable: true,
    lifespan: 0,
    spreadRate: 3,
  },
  [Material.SMOKE]: {
    name: 'Smoke',
    color: '#aaaaaa',
    density: 0.1,
    flammable: false,
    lifespan: 100,
    spreadRate: 1,
  },
  [Material.SALT]: {
    name: 'Salt',
    color: '#ffffff',
    density: 2.5,
    flammable: false,
    lifespan: 0,
    spreadRate: 0,
  },
};

// Color palettes
const COLOR_PALETTES = {
  default: {
    [Material.EMPTY]: '#000000',
    [Material.SAND]: '#e6c288',
    [Material.WATER]: '#4a80f5',
    [Material.WALL]: '#888888',
    [Material.FIRE]: '#ff4400',
    [Material.WOOD]: '#8b4513',
    [Material.PLANT]: '#38a832',
    [Material.OIL]: '#8b572a',
    [Material.SMOKE]: '#aaaaaa',
    [Material.SALT]: '#ffffff',
  },
  retro: {
    [Material.EMPTY]: '#111111',
    [Material.SAND]: '#ffcc00',
    [Material.WATER]: '#0088ff',
    [Material.WALL]: '#666666',
    [Material.FIRE]: '#ff2200',
    [Material.WOOD]: '#aa5500',
    [Material.PLANT]: '#00cc00',
    [Material.OIL]: '#aa6600',
    [Material.SMOKE]: '#999999',
    [Material.SALT]: '#eeeeee',
  },
  pastel: {
    [Material.EMPTY]: '#222222',
    [Material.SAND]: '#f7d794',
    [Material.WATER]: '#7ed6df',
    [Material.WALL]: '#95afc0',
    [Material.FIRE]: '#ff7979',
    [Material.WOOD]: '#c0a080',
    [Material.PLANT]: '#badc58',
    [Material.OIL]: '#cd9777',
    [Material.SMOKE]: '#dfe6e9',
    [Material.SALT]: '#f5f6fa',
  },
  monochrome: {
    [Material.EMPTY]: '#000000',
    [Material.SAND]: '#dddddd',
    [Material.WATER]: '#aaaaaa',
    [Material.WALL]: '#555555',
    [Material.FIRE]: '#ffffff',
    [Material.WOOD]: '#777777',
    [Material.PLANT]: '#cccccc',
    [Material.OIL]: '#888888',
    [Material.SMOKE]: '#bbbbbb',
    [Material.SALT]: '#eeeeee',
  },
};

// Jotai atoms for state management
const selectedMaterialAtom = atom<Material>(Material.SAND);
const brushSizeAtom = atom<number>(3);
const paletteAtom = atom<keyof typeof COLOR_PALETTES>('default');
const simulationSpeedAtom = atom<number>(1);
const gravityAtom = atom<number>(1);

export function FallingSand() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useAtom(selectedMaterialAtom);
  const [brushSize, setBrushSize] = useAtom(brushSizeAtom);
  const [palette, setPalette] = useAtom(paletteAtom);
  const [simulationSpeed, setSimulationSpeed] = useAtom(simulationSpeedAtom);
  const [gravity, setGravity] = useAtom(gravityAtom);
  const [isErasing, setIsErasing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [fps, setFps] = useState(0);

  // Mouse state
  const mouseRef = useRef({
    isDown: false,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
  });

  // Grid state
  const gridRef = useRef<{
    width: number;
    height: number;
    cells: Uint8Array;
    nextCells: Uint8Array;
    age: Uint16Array;
  } | null>(null);

  // Animation frame reference
  const animationFrameRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(0);

  // Initialize the simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size - lower resolution for better performance
    const pixelRatio = 0.5;
    const width = Math.floor((window.innerWidth * pixelRatio) / 4) * 4;
    const height = Math.floor((window.innerHeight * pixelRatio) / 4) * 4;
    canvas.width = width;
    canvas.height = height;

    // Create offscreen canvas for double buffering
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    offscreenCanvasRef.current = offscreenCanvas;

    // Initialize grid
    gridRef.current = {
      width,
      height,
      cells: new Uint8Array(width * height),
      nextCells: new Uint8Array(width * height),
      age: new Uint16Array(width * height),
    };

    // Add walls around the edges
    const { cells } = gridRef.current;
    for (let x = 0; x < width; x++) {
      cells[x] = Material.WALL; // Top wall
      cells[x + (height - 1) * width] = Material.WALL; // Bottom wall
    }
    for (let y = 0; y < height; y++) {
      cells[0 + y * width] = Material.WALL; // Left wall
      cells[width - 1 + y * width] = Material.WALL; // Right wall
    }

    // Start animation loop
    lastUpdateTimeRef.current = performance.now();
    frameCountRef.current = 0;
    lastFpsUpdateRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !gridRef.current) return;

      // Preserve the current state
      const oldGrid = gridRef.current;
      const oldWidth = oldGrid.width;
      const oldHeight = oldGrid.height;

      // Set new canvas size
      const pixelRatio = 0.5;
      const width = Math.floor((window.innerWidth * pixelRatio) / 4) * 4;
      const height = Math.floor((window.innerHeight * pixelRatio) / 4) * 4;
      canvas.width = width;
      canvas.height = height;

      // Create new offscreen canvas
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      offscreenCanvasRef.current = offscreenCanvas;

      // Create new grid
      const newCells = new Uint8Array(width * height);
      const newNextCells = new Uint8Array(width * height);
      const newAge = new Uint16Array(width * height);

      // Copy old grid data to new grid (as much as fits)
      const copyWidth = Math.min(width, oldWidth);
      const copyHeight = Math.min(height, oldHeight);
      for (let y = 0; y < copyHeight; y++) {
        for (let x = 0; x < copyWidth; x++) {
          const oldIndex = x + y * oldWidth;
          const newIndex = x + y * width;
          newCells[newIndex] = oldGrid.cells[oldIndex];
          newAge[newIndex] = oldGrid.age[oldIndex];
        }
      }

      // Add walls around the edges
      for (let x = 0; x < width; x++) {
        newCells[x] = Material.WALL; // Top wall
        newCells[x + (height - 1) * width] = Material.WALL; // Bottom wall
      }
      for (let y = 0; y < height; y++) {
        newCells[0 + y * width] = Material.WALL; // Left wall
        newCells[width - 1 + y * width] = Material.WALL; // Right wall
      }

      // Update grid reference
      gridRef.current = {
        width,
        height,
        cells: newCells,
        nextCells: newNextCells,
        age: newAge,
      };
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.addEventListener('resize', handleResize);
    };
  }, []);

  // Mouse event handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (e: MouseEvent) => {
      mouseRef.current.isDown = true;
      updateMousePosition(e);
      drawAtCurrentPosition();
    };

    const handleMouseUp = () => {
      mouseRef.current.isDown = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateMousePosition(e);
      if (mouseRef.current.isDown) {
        drawAtCurrentPosition();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseRef.current.isDown = true;
        updateTouchPosition(e.touches[0]);
        drawAtCurrentPosition();
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      mouseRef.current.isDown = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateTouchPosition(e.touches[0]);
        if (mouseRef.current.isDown) {
          drawAtCurrentPosition();
        }
        e.preventDefault();
      }
    };

    const updateMousePosition = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      mouseRef.current.prevX = mouseRef.current.x;
      mouseRef.current.prevY = mouseRef.current.y;
      mouseRef.current.x = Math.floor((e.clientX - rect.left) * scaleX);
      mouseRef.current.y = Math.floor((e.clientY - rect.top) * scaleY);
    };

    const updateTouchPosition = (touch: Touch) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      mouseRef.current.prevX = mouseRef.current.x;
      mouseRef.current.prevY = mouseRef.current.y;
      mouseRef.current.x = Math.floor((touch.clientX - rect.left) * scaleX);
      mouseRef.current.y = Math.floor((touch.clientY - rect.top) * scaleY);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, [brushSize, selectedMaterial, isErasing]);

  // Draw at current mouse position
  const drawAtCurrentPosition = () => {
    if (!gridRef.current) return;

    const { width, cells } = gridRef.current;
    const { x, y, prevX, prevY } = mouseRef.current;

    // Interpolate between previous and current position for smooth drawing
    const points: [number, number][] = [];
    const dx = x - prevX;
    const dy = y - prevY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const pointX = Math.round(prevX + dx * t);
      const pointY = Math.round(prevY + dy * t);
      points.push([pointX, pointY]);
    }

    // Draw at each interpolated point
    for (const [pointX, pointY] of points) {
      // Draw in a circle around the point based on brush size
      for (let by = -brushSize; by <= brushSize; by++) {
        for (let bx = -brushSize; bx <= brushSize; bx++) {
          // Check if point is within brush circle
          if (bx * bx + by * by <= brushSize * brushSize) {
            const drawX = pointX + bx;
            const drawY = pointY + by;

            // Check bounds
            if (
              drawX > 0 &&
              drawX < gridRef.current.width - 1 &&
              drawY > 0 &&
              drawY < gridRef.current.height - 1
            ) {
              const index = drawX + drawY * width;
              // Don't overwrite walls unless explicitly drawing walls
              if (
                cells[index] !== Material.WALL ||
                selectedMaterial === Material.WALL ||
                isErasing
              ) {
                cells[index] = isErasing ? Material.EMPTY : selectedMaterial;
                // Reset age for new particles
                gridRef.current.age[index] = 0;
              }
            }
          }
        }
      }
    }
  };

  // Clear the simulation
  const clearSimulation = () => {
    if (!gridRef.current) return;

    const { width, height, cells, age } = gridRef.current;

    // Clear everything except walls
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = x + y * width;
        if (cells[index] !== Material.WALL) {
          cells[index] = Material.EMPTY;
          age[index] = 0;
        }
      }
    }
  };

  // Update and render the simulation
  const update = (timestamp: number) => {
    if (!gridRef.current || !canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(update);
      return;
    }

    // Calculate delta time
    const deltaTime = timestamp - lastUpdateTimeRef.current;
    lastUpdateTimeRef.current = timestamp;

    // Update FPS counter
    frameCountRef.current++;
    if (timestamp - lastFpsUpdateRef.current >= 1000) {
      setFps(Math.round((frameCountRef.current * 1000) / (timestamp - lastFpsUpdateRef.current)));
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = timestamp;
    }

    // Skip update if paused
    if (!isPaused) {
      // Determine how many simulation steps to take based on simulation speed
      const steps = Math.max(1, Math.floor(simulationSpeed));
      for (let step = 0; step < steps; step++) {
        updateSimulation();
      }
    }

    // Render
    render();

    // Schedule next frame
    animationFrameRef.current = requestAnimationFrame(update);
  };

  // Update the simulation state
  const updateSimulation = () => {
    if (!gridRef.current) return;

    const { width, height, cells, nextCells, age } = gridRef.current;

    // Copy current state to next state
    nextCells.set(cells);

    // Process cells in random order to avoid bias
    const indices = Array.from({ length: width * height }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // Update each cell based on its type and surroundings
    for (const index of indices) {
      const x = index % width;
      const y = Math.floor(index / width);

      // Skip edges
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) continue;

      const material = cells[index];
      if (material === Material.EMPTY) continue;

      // Update age for materials with lifespan
      if (MATERIALS[material as Material].lifespan > 0) {
        age[index]++;
        if (age[index] >= MATERIALS[material as Material].lifespan) {
          // Material expires
          if (material === Material.FIRE) {
            nextCells[index] = Material.SMOKE;
            age[index] = 0;
          } else if (material === Material.SMOKE) {
            nextCells[index] = Material.EMPTY;
            age[index] = 0;
          }
          continue;
        }
      }

      // Handle different materials
      switch (material) {
        case Material.SAND:
        case Material.SALT:
          updateSand(x, y, index, material);
          break;
        case Material.WATER:
        case Material.OIL:
          updateLiquid(x, y, index, material);
          break;
        case Material.FIRE:
          updateFire(x, y, index);
          break;
        case Material.SMOKE:
          updateSmoke(x, y, index);
          break;
        case Material.PLANT:
          updatePlant(x, y, index);
          break;
      }
    }
    // Swap cell buffers
    [gridRef.current.cells, gridRef.current.nextCells] = [
      gridRef.current.nextCells,
      gridRef.current.cells,
    ];
  };

  // Update sand-like materials
  const updateSand = (x: number, y: number, index: number, material: Material) => {
    if (!gridRef.current) return;

    const { width, cells, nextCells } = gridRef.current;
    const density = MATERIALS[material as Material].density;

    // Try to move down
    const belowIndex = index + width;
    if (
      cells[belowIndex] === Material.EMPTY ||
      (MATERIALS[cells[belowIndex] as Material].density < density &&
        cells[belowIndex] !== Material.WALL)
    ) {
      nextCells[belowIndex] = material;
      nextCells[index] = cells[belowIndex];
      return;
    }

    // Try to move diagonally down
    const direction = Math.random() < 0.5 ? 1 : -1;
    const diag1 = index + width + direction;
    const diag2 = index + width - direction;

    if (
      cells[diag1] === Material.EMPTY ||
      (MATERIALS[cells[diag1] as Material].density < density && cells[diag1] !== Material.WALL)
    ) {
      nextCells[diag1] = material;
      nextCells[index] = cells[diag1];
    } else if (
      cells[diag2] === Material.EMPTY ||
      (MATERIALS[cells[diag2] as Material].density < density && cells[diag2] !== Material.WALL)
    ) {
      nextCells[diag2] = material;
      nextCells[index] = cells[diag2];
    }

    // Special case for salt in water
    if (material === Material.SALT && cells[belowIndex] === Material.WATER) {
      // Salt dissolves in water
      if (Math.random() < 0.01) {
        nextCells[index] = Material.WATER;
      }
    }
  };

  // Update liquid materials
  const updateLiquid = (x: number, y: number, index: number, material: Material) => {
    if (!gridRef.current) return;

    const { width, cells, nextCells } = gridRef.current;
    const density = MATERIALS[material as Material].density;
    const spreadRate = MATERIALS[material as Material].spreadRate;

    // Try to move down
    const belowIndex = index + width;
    if (
      cells[belowIndex] === Material.EMPTY ||
      (MATERIALS[cells[belowIndex] as Material].density < density &&
        cells[belowIndex] !== Material.WALL)
    ) {
      nextCells[belowIndex] = material;
      nextCells[index] = cells[belowIndex];
      return;
    }

    // Try to move diagonally down
    const direction = Math.random() < 0.5 ? 1 : -1;
    const diag1 = index + width + direction;
    const diag2 = index + width - direction;

    if (
      cells[diag1] === Material.EMPTY ||
      (MATERIALS[cells[diag1] as Material].density < density && cells[diag1] !== Material.WALL)
    ) {
      nextCells[diag1] = material;
      nextCells[index] = cells[diag1];
      return;
    } else if (
      cells[diag2] === Material.EMPTY ||
      (MATERIALS[cells[diag2] as Material].density < density && cells[diag2] !== Material.WALL)
    ) {
      nextCells[diag2] = material;
      nextCells[index] = cells[diag2];
      return;
    }

    // Try to spread horizontally
    if (Math.random() < spreadRate / 10) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const sideIndex = index + dir;

      if (cells[sideIndex] === Material.EMPTY) {
        nextCells[sideIndex] = material;
        nextCells[index] = Material.EMPTY;
      }
    }

    // Water extinguishes fire
    if (material === Material.WATER) {
      // Check surrounding cells for fire
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const checkIndex = index + dx + dy * width;
          if (cells[checkIndex] === Material.FIRE) {
            nextCells[checkIndex] = Material.SMOKE;
          }
        }
      }
    }
  };

  // Update fire
  const updateFire = (x: number, y: number, index: number) => {
    if (!gridRef.current) return;

    const { width, cells, nextCells, age } = gridRef.current;

    // Fire rises
    const aboveIndex = index - width;
    if (cells[aboveIndex] === Material.EMPTY && Math.random() < 0.8) {
      nextCells[aboveIndex] = Material.FIRE;
      nextCells[index] = Material.EMPTY;
      age[aboveIndex] = age[index];
      return;
    }

    // Fire spreads to flammable materials
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const checkIndex = index + dx + dy * width;
        const checkMaterial = cells[checkIndex];

        if (MATERIALS[checkMaterial as Material].flammable && Math.random() < 0.1) {
          nextCells[checkIndex] = Material.FIRE;
          age[checkIndex] = 0;
        }
      }
    }

    // Chance to create smoke
    if (Math.random() < 0.1) {
      const smokeIndex = index - width;
      if (cells[smokeIndex] === Material.EMPTY) {
        nextCells[smokeIndex] = Material.SMOKE;
        age[smokeIndex] = 0;
      }
    }
  };

  // Update smoke
  const updateSmoke = (x: number, y: number, index: number) => {
    if (!gridRef.current) return;

    const { width, cells, nextCells } = gridRef.current;

    // Smoke rises
    const aboveIndex = index - width;
    if (cells[aboveIndex] === Material.EMPTY && Math.random() < 0.9) {
      nextCells[aboveIndex] = Material.SMOKE;
      nextCells[index] = Material.EMPTY;
      return;
    }

    // Smoke spreads diagonally upward
    const direction = Math.random() < 0.5 ? 1 : -1;
    const diagUp = index - width + direction;
    if (cells[diagUp] === Material.EMPTY && Math.random() < 0.5) {
      nextCells[diagUp] = Material.SMOKE;
      nextCells[index] = Material.EMPTY;
      return;
    }

    // Smoke spreads horizontally
    if (Math.random() < 0.2) {
      const dir = Math.random() < 0.5 ? 1 : -1;
      const sideIndex = index + dir;
      if (cells[sideIndex] === Material.EMPTY) {
        nextCells[sideIndex] = Material.SMOKE;
        nextCells[index] = Material.EMPTY;
      }
    }
  };

  // Update plant
  const updatePlant = (x: number, y: number, index: number) => {
    if (!gridRef.current) return;

    const { width, cells, nextCells } = gridRef.current;

    // Plants grow upward and to the sides occasionally
    if (Math.random() < 0.01) {
      const directions = [
        -width, // up
        -width - 1, // up-left
        -width + 1, // up-right
        -1, // left
        1, // right
      ];

      const dir = directions[Math.floor(Math.random() * directions.length)];
      const growIndex = index + dir;

      if (
        (cells[growIndex] as Material) === Material.EMPTY &&
        // Make sure we're not growing into a wall
        (cells[growIndex] as Material) !== Material.WALL
      ) {
        nextCells[growIndex] = Material.PLANT;
      }
    }

    // Plants need water to thrive
    let hasWaterNearby = false;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const checkIndex = index + dx + dy * width;
        if ((cells[checkIndex] as Material) === Material.WATER) {
          hasWaterNearby = true;
          break;
        }
      }
      if (hasWaterNearby) break;
    }

    // Plants wither without water
    if (!hasWaterNearby && Math.random() < 0.001) {
      nextCells[index] = Material.EMPTY;
    }
  };

  // Render the simulation
  const render = () => {
    if (!gridRef.current || !canvasRef.current || !offscreenCanvasRef.current) return;

    const { width, height, cells, age } = gridRef.current;
    const canvas = canvasRef.current;
    const offscreenCanvas = offscreenCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const offscreenCtx = offscreenCanvas.getContext('2d');

    if (!ctx || !offscreenCtx) return;

    // Clear the offscreen canvas
    offscreenCtx.fillStyle = '#000000';
    offscreenCtx.fillRect(0, 0, width, height);

    // Create image data for direct pixel manipulation
    const imageData = offscreenCtx.createImageData(width, height);
    const data = imageData.data;

    // Fill image data based on cell states
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = x + y * width;
        const material = cells[index];
        const pixelIndex = index * 4;

        if (material !== Material.EMPTY) {
          // Get base color from palette
          const colorHex = COLOR_PALETTES[palette][material as Material];
          const r = Number.parseInt(colorHex.slice(1, 3), 16);
          const g = Number.parseInt(colorHex.slice(3, 5), 16);
          const b = Number.parseInt(colorHex.slice(5, 7), 16);

          // Add some variation based on position and age
          const variation = Math.sin(x * 0.1 + y * 0.1) * 10 + Math.random() * 10 - 5;

          // Special case for fire - make it flicker
          if (material === Material.FIRE) {
            const flicker = Math.sin(Date.now() * 0.01 + index) * 30 + Math.random() * 20;
            data[pixelIndex] = Math.min(255, r + flicker);
            data[pixelIndex + 1] = Math.min(255, g + flicker / 2);
            data[pixelIndex + 2] = Math.min(255, b);
          }
          // Special case for smoke - make it fade
          else if (material === Material.SMOKE) {
            const fade = 1 - age[index] / MATERIALS[Material.SMOKE].lifespan;
            data[pixelIndex] = Math.min(255, r * fade);
            data[pixelIndex + 1] = Math.min(255, g * fade);
            data[pixelIndex + 2] = Math.min(255, b * fade);
          }
          // Special case for water - make it shimmer
          else if (material === Material.WATER) {
            const shimmer = Math.sin(Date.now() * 0.003 + x * 0.2 + y * 0.1) * 15;
            data[pixelIndex] = Math.min(255, Math.max(0, r + shimmer));
            data[pixelIndex + 1] = Math.min(255, Math.max(0, g + shimmer));
            data[pixelIndex + 2] = Math.min(255, Math.max(0, b + shimmer));
          }
          // Default case - add slight variation
          else {
            data[pixelIndex] = Math.min(255, Math.max(0, r + variation));
            data[pixelIndex + 1] = Math.min(255, Math.max(0, g + variation));
            data[pixelIndex + 2] = Math.min(255, Math.max(0, b + variation));
          }

          data[pixelIndex + 3] = 255; // Alpha
        } else {
          // Empty cells are transparent
          data[pixelIndex + 3] = 0;
        }
      }
    }

    // Put the image data on the offscreen canvas
    offscreenCtx.putImageData(imageData, 0, 0);

    // Draw the offscreen canvas to the visible canvas
    ctx.imageSmoothingEnabled = false; // Keep the pixel art look
    ctx.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
        <div className="flex gap-2">
          <Button
            variant={isErasing ? 'destructive' : 'outline'}
            size="icon"
            onClick={() => setIsErasing(!isErasing)}
            title={isErasing ? 'Erasing' : 'Drawing'}
          >
            {isErasing ? <Eraser className="h-4 w-4" /> : <Brush className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsPaused(!isPaused)}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            )}
          </Button>

          <Button variant="outline" size="icon" onClick={clearSimulation} title="Clear">
            <Trash2 className="h-4 w-4" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Settings</h4>
                  <p className="text-sm text-muted-foreground">Adjust simulation parameters</p>
                </div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label htmlFor="speed">Speed</label>
                    <Slider
                      id="speed"
                      min={0.5}
                      max={3}
                      step={0.1}
                      value={[simulationSpeed]}
                      onValueChange={(value) => setSimulationSpeed(value[0])}
                      className="col-span-2"
                    />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label htmlFor="gravity">Gravity</label>
                    <Slider
                      id="gravity"
                      min={0.5}
                      max={2}
                      step={0.1}
                      value={[gravity]}
                      onValueChange={(value) => setGravity(value[0])}
                      className="col-span-2"
                    />
                  </div>
                  <div className="grid grid-cols-3 items-center gap-4">
                    <label htmlFor="palette">Color Theme</label>
                    <Select
                      value={palette}
                      onValueChange={(value) => setPalette(value as keyof typeof COLOR_PALETTES)}
                    >
                      <SelectTrigger id="palette" className="col-span-2">
                        <SelectValue placeholder="Select a palette" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="retro">Retro</SelectItem>
                        <SelectItem value="pastel">Pastel</SelectItem>
                        <SelectItem value="monochrome">Monochrome</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="bg-black/70 backdrop-blur-sm p-2 rounded-lg">
          <div className="grid grid-cols-5 gap-1">
            {Object.entries(MATERIALS)
              .filter(([key]) => key !== '0') // Skip EMPTY
              .map(([key, props]) => (
                <Button
                  key={key}
                  variant={Number.parseInt(key) === selectedMaterial ? 'default' : 'outline'}
                  className="w-10 h-10 p-0"
                  style={{
                    backgroundColor:
                      Number.parseInt(key) === selectedMaterial
                        ? COLOR_PALETTES[palette][Number.parseInt(key) as Material]
                        : undefined,
                    color:
                      Number.parseInt(key) === selectedMaterial
                        ? '#000000'
                        : COLOR_PALETTES[palette][Number.parseInt(key) as Material],
                    borderColor: COLOR_PALETTES[palette][Number.parseInt(key) as Material],
                  }}
                  onClick={() => {
                    setSelectedMaterial(Number.parseInt(key) as Material);
                    setIsErasing(false);
                  }}
                  title={props.name}
                >
                  <span className="sr-only">{props.name}</span>
                </Button>
              ))}
          </div>

          <div className="mt-2">
            <label htmlFor="brush-size" className="text-xs text-white">
              Brush Size: {brushSize}
            </label>
            <Slider
              id="brush-size"
              min={1}
              max={10}
              step={1}
              value={[brushSize]}
              onValueChange={(value) => setBrushSize(value[0])}
            />
          </div>
        </div>
      </div>

      {/* FPS Counter */}
      <div className="absolute bottom-4 right-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
        {fps} FPS
      </div>

      {/* Material Info */}
      <div className="absolute bottom-4 left-4 text-white text-xs bg-black/50 px-2 py-1 rounded">
        {isErasing
          ? 'Eraser'
          : `${MATERIALS[selectedMaterial].name} (${
              MATERIALS[selectedMaterial].flammable ? 'Flammable' : 'Non-flammable'
            })`}
      </div>
    </div>
  );
}
