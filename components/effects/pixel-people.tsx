'use client';

import type * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { atom, useAtom } from 'jotai';

export const pixelPeopleConfigAtom = atom({
  // Resolution settings
  pixelSize: 4, // Size of each pixel

  // People settings
  peopleCount: 20, // Number of stick figures
  speed: 0.5, // Movement speed

  // Visual settings
  colorMode: 'retro', // "retro", "grayscale", "colorful"

  // Interaction
  enableMouseInteraction: true,
});

interface PixelPeopleProps {
  className?: string;
}

// Define a stick figure person
interface Person {
  x: number;
  y: number;
  direction: number; // -1 for left, 1 for right
  speed: number;
  animFrame: number;
  animTimer: number;
  color: string;
  state: 'walking' | 'idle' | 'jumping';
  jumpHeight: number;
  jumpTimer: number;
  scale: number;
}

const PixelPeople: React.FC<PixelPeopleProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>(0);
  const [config, setConfig] = useAtom(pixelPeopleConfigAtom);
  const [colorMode, setColorMode] = useState<string>(config.colorMode);
  const [fps, setFps] = useState<number>(0);
  const fpsValues = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(0);

  // People state
  const peopleRef = useRef<Person[]>([]);

  // Mouse state
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const mouseDownRef = useRef<boolean>(false);

  const { pixelSize, peopleCount, speed, enableMouseInteraction } = config;

  // Handle color mode change
  const handleColorModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newMode = e.target.value;
      setColorMode(newMode);
      setConfig({ ...config, colorMode: newMode });

      // Update colors of existing people
      if (peopleRef.current) {
        peopleRef.current.forEach((person) => {
          person.color = getRandomColor(newMode);
        });
      }
    },
    [config, setConfig]
  );

  // Get random color based on color mode
  const getRandomColor = useCallback((mode: string): string => {
    if (mode === 'retro') {
      // Retro color palette
      const retroColors = [
        '#5f574f', // dark brown
        '#c2c3c7', // light gray
        '#fff1e8', // off-white
        '#ff004d', // red
        '#ffa300', // orange
        '#ffec27', // yellow
        '#00e436', // green
        '#29adff', // blue
        '#83769c', // lavender
        '#ff77a8', // pink
      ];
      return retroColors[Math.floor(Math.random() * retroColors.length)];
    } else if (mode === 'grayscale') {
      // Grayscale
      const value = Math.floor(Math.random() * 200) + 55; // 55-255
      return `rgb(${value}, ${value}, ${value})`;
    } else {
      // Colorful
      return `hsl(${Math.random() * 360}, 70%, 60%)`;
    }
  }, []);

  // Initialize people
  const initPeople = useCallback(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const people: Person[] = [];

    for (let i = 0; i < peopleCount; i++) {
      people.push({
        x: Math.random() * canvas.width,
        y: canvas.height - 40 - Math.random() * 60, // Vary the y position a bit
        direction: Math.random() > 0.5 ? 1 : -1,
        speed: (Math.random() * 0.5 + 0.5) * speed,
        animFrame: Math.floor(Math.random() * 4),
        animTimer: Math.random() * 10,
        color: getRandomColor(colorMode),
        state: Math.random() > 0.8 ? 'idle' : 'walking',
        jumpHeight: 0,
        jumpTimer: 0,
        scale: 0.8 + Math.random() * 0.4, // Vary the size a bit
      });
    }

    peopleRef.current = people;
  }, [peopleCount, speed, colorMode, getRandomColor]);

  // Update people
  const updatePeople = useCallback(
    (deltaTime: number) => {
      if (!canvasRef.current || !peopleRef.current) return;

      const canvas = canvasRef.current;
      const people = peopleRef.current;

      people.forEach((person) => {
        // Update animation timer
        person.animTimer += deltaTime;
        if (person.animTimer > 0.2) {
          person.animTimer = 0;
          person.animFrame = (person.animFrame + 1) % 4;
        }

        // Random state changes
        if (Math.random() < 0.005) {
          // Small chance to change state
          const states: ('walking' | 'idle' | 'jumping')[] = ['walking', 'idle', 'jumping'];
          person.state = states[Math.floor(Math.random() * states.length)];
        }

        // Random direction changes
        if (person.state === 'idle' && Math.random() < 0.01) {
          person.direction *= -1;
        }

        // Handle states
        if (person.state === 'walking') {
          // Move in current direction
          person.x += person.direction * person.speed * deltaTime * 60;

          // Wrap around screen edges
          if (person.x < -20) person.x = canvas.width + 20;
          if (person.x > canvas.width + 20) person.x = -20;
        } else if (person.state === 'jumping') {
          // Handle jumping
          person.jumpTimer += deltaTime;

          // Jump arc
          person.jumpHeight = Math.sin(person.jumpTimer * 5) * 20;

          // End jump after one cycle
          if (person.jumpTimer > 0.6) {
            person.state = 'walking';
            person.jumpHeight = 0;
            person.jumpTimer = 0;
          }

          // Still move forward while jumping
          person.x += person.direction * person.speed * 0.5 * deltaTime * 60;
        }

        // Mouse interaction
        if (enableMouseInteraction && mousePositionRef.current && mouseDownRef.current) {
          const { x, y } = mousePositionRef.current;

          // Calculate distance to mouse
          const dx = x - person.x;
          const dy = y - (person.y - person.jumpHeight);
          const distance = Math.sqrt(dx * dx + dy * dy);

          // If mouse is close, make the person run away
          if (distance < 100) {
            // Run away from mouse
            person.direction = dx < 0 ? 1 : -1;
            person.state = 'walking';
            person.speed = speed * 2; // Run faster
          }
        } else {
          // Return to normal speed
          person.speed = (Math.random() * 0.5 + 0.5) * speed;
        }
      });
    },
    [enableMouseInteraction, speed]
  );

  // Draw a stick figure
  const drawStickFigure = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      frame: number,
      direction: number,
      color: string,
      state: 'walking' | 'idle' | 'jumping',
      jumpHeight: number,
      scale: number
    ) => {
      // Adjust y for jump height
      y -= jumpHeight;

      // Scale factor
      const s = scale * pixelSize * 2;

      // Set up pixelated drawing
      ctx.fillStyle = color;

      // Draw head (circle)
      const headSize = 3 * s;
      ctx.fillRect(x - headSize / 2, y - headSize, headSize, headSize);

      // Draw body (line)
      const bodyLength = 4 * s;
      for (let i = 0; i < bodyLength; i += pixelSize) {
        ctx.fillRect(x - pixelSize / 2, y + i, pixelSize, pixelSize);
      }

      // Draw arms based on animation frame
      const armLength = 3 * s;
      let leftArmAngle = 0;
      let rightArmAngle = 0;

      if (state === 'walking') {
        // Walking animation for arms
        switch (frame) {
          case 0:
            leftArmAngle = -0.3;
            rightArmAngle = 0.3;
            break;
          case 1:
            leftArmAngle = -0.1;
            rightArmAngle = 0.1;
            break;
          case 2:
            leftArmAngle = 0.3;
            rightArmAngle = -0.3;
            break;
          case 3:
            leftArmAngle = 0.1;
            rightArmAngle = -0.1;
            break;
        }
      } else if (state === 'jumping') {
        // Arms up for jumping
        leftArmAngle = -0.6;
        rightArmAngle = -0.6;
      }

      // Flip angles if facing left
      if (direction === -1) {
        leftArmAngle = -leftArmAngle;
        rightArmAngle = -rightArmAngle;
      }

      // Draw left arm
      for (let i = 0; i < armLength; i += pixelSize) {
        const armX = x + Math.sin(leftArmAngle) * i * direction;
        const armY = y + bodyLength / 3 + Math.cos(leftArmAngle) * i;
        ctx.fillRect(armX - pixelSize / 2, armY - pixelSize / 2, pixelSize, pixelSize);
      }

      // Draw right arm
      for (let i = 0; i < armLength; i += pixelSize) {
        const armX = x + Math.sin(rightArmAngle) * i * direction;
        const armY = y + bodyLength / 3 + Math.cos(rightArmAngle) * i;
        ctx.fillRect(armX - pixelSize / 2, armY - pixelSize / 2, pixelSize, pixelSize);
      }

      // Draw legs based on animation frame
      const legLength = 4 * s;
      let leftLegAngle = 0;
      let rightLegAngle = 0;

      if (state === 'walking') {
        // Walking animation for legs
        switch (frame) {
          case 0:
            leftLegAngle = 0.3;
            rightLegAngle = -0.3;
            break;
          case 1:
            leftLegAngle = 0.1;
            rightLegAngle = -0.1;
            break;
          case 2:
            leftLegAngle = -0.3;
            rightLegAngle = 0.3;
            break;
          case 3:
            leftLegAngle = -0.1;
            rightLegAngle = 0.1;
            break;
        }
      } else if (state === 'jumping') {
        // Legs bent for jumping
        leftLegAngle = -0.2;
        rightLegAngle = -0.2;
      }

      // Flip angles if facing left
      if (direction === -1) {
        leftLegAngle = -leftLegAngle;
        rightLegAngle = -rightLegAngle;
      }

      // Draw left leg
      for (let i = 0; i < legLength; i += pixelSize) {
        const legX = x + Math.sin(leftLegAngle) * i * direction;
        const legY = y + bodyLength + Math.cos(leftLegAngle) * i;
        ctx.fillRect(legX - pixelSize / 2, legY - pixelSize / 2, pixelSize, pixelSize);
      }

      // Draw right leg
      for (let i = 0; i < legLength; i += pixelSize) {
        const legX = x + Math.sin(rightLegAngle) * i * direction;
        const legY = y + bodyLength + Math.cos(rightLegAngle) * i;
        ctx.fillRect(legX - pixelSize / 2, legY - pixelSize / 2, pixelSize, pixelSize);
      }
    },
    [pixelSize]
  );

  // Render people to canvas
  const renderPeople = useCallback(() => {
    if (!canvasRef.current || !peopleRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with a dark background
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw ground
    ctx.fillStyle = '#333';
    ctx.fillRect(0, canvas.height - 20, canvas.width, 20);

    // Draw each person
    peopleRef.current.forEach((person) => {
      drawStickFigure(
        ctx,
        person.x,
        person.y,
        person.animFrame,
        person.direction,
        person.color,
        person.state,
        person.jumpHeight,
        person.scale
      );
    });

    // Draw pixelated
    ctx.imageSmoothingEnabled = false;
  }, [drawStickFigure]);

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

    // Initialize people
    initPeople();

    function resize() {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      // Reinitialize people with new dimensions
      initPeople();
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

      // Update people
      updatePeople(deltaTime);

      // Render people
      renderPeople();

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
  }, [initPeople, updatePeople, renderPeople, enableMouseInteraction]);

  return (
    <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`}>
      {/* FPS Counter */}
      <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {fps} FPS
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-3 rounded">
        <h3 className="text-sm font-bold mb-2">Pixel People Controls</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs">Color Mode:</label>
            <select
              className="bg-black/70 text-white text-xs p-1 rounded"
              value={colorMode}
              onChange={handleColorModeChange}
            >
              <option value="retro">Retro</option>
              <option value="grayscale">Grayscale</option>
              <option value="colorful">Colorful</option>
            </select>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-2 rounded text-xs max-w-xs text-right">
        Click and hold to scare the stick figures
      </div>
    </div>
  );
};

export { PixelPeople };
