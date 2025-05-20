'use client';

import type React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Renderer, Program, Mesh, Triangle, Color, RenderTarget, Texture } from 'ogl';
import { atom, useAtom } from 'jotai';

export const gameOfLifeConfigAtom = atom({
  // Simulation settings
  cellSize: 4, // Size of each cell in pixels
  updateRate: 10, // Updates per second

  // Visual settings
  colorMode: 'age', // "binary", "age", "rainbow"
  fadeSpeed: 0.995, // How quickly cells fade when they die

  // Interaction
  enableMouseInteraction: true,
  brushSize: 3, // Size of the drawing brush in cells
});

interface GameOfLifeProps {
  className?: string;
  onError?: () => void;
}

// Vertex shader for both passes
const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Fragment shader for simulation pass
const simulationShader = `
precision highp float;

uniform sampler2D tMap;
uniform vec3 iResolution;
uniform float iTime;
uniform vec2 uMouse;
uniform bool uMouseDown;
uniform int uBrushSize;
uniform bool uErase;

varying vec2 vUv;

void main() {
  vec2 texel = 1.0 / iResolution.xy;
  vec2 uv = vUv;
  
  // Get current state
  vec4 currentState = texture2D(tMap, uv);
  
  // Mouse interaction - more responsive drawing
  if (uMouseDown) {
    vec2 mousePos = uMouse;
    float dist = distance(uv, mousePos);
    float brushRadius = float(uBrushSize) * texel.x * 5.0; // Larger brush radius
    
    if (dist < brushRadius) {
      if (uErase) {
        // Erase cells
        currentState = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        // Draw cells
        currentState = vec4(1.0, 0.0, 0.0, 1.0);
      }
      // Skip the rest of the simulation for immediate feedback
      gl_FragColor = currentState;
      return;
    }
  }
  
  // Get neighbor states
  float n = texture2D(tMap, uv + vec2(0.0, texel.y)).r;
  float ne = texture2D(tMap, uv + vec2(texel.x, texel.y)).r;
  float e = texture2D(tMap, uv + vec2(texel.x, 0.0)).r;
  float se = texture2D(tMap, uv + vec2(texel.x, -texel.y)).r;
  float s = texture2D(tMap, uv + vec2(0.0, -texel.y)).r;
  float sw = texture2D(tMap, uv + vec2(-texel.x, -texel.y)).r;
  float w = texture2D(tMap, uv + vec2(-texel.x, 0.0)).r;
  float nw = texture2D(tMap, uv + vec2(-texel.x, texel.y)).r;
  
  // Count live neighbors
  float liveNeighbors = n + ne + e + se + s + sw + w + nw;
  
  // Apply Conway's Game of Life rules
  float currentCell = currentState.r;
  float nextCell = currentCell;
  
  if (currentCell > 0.5) {
    // Cell is alive
    if (liveNeighbors < 2.0 || liveNeighbors > 3.0) {
      // Cell dies
      nextCell = 0.0;
    }
  } else {
    // Cell is dead
    if (liveNeighbors == 3.0) {
      // Cell becomes alive
      nextCell = 1.0;
    }
  }
  
  // Age tracking in green channel
  float age = currentState.g;
  if (nextCell > 0.5) {
    // Increment age for live cells
    age = min(age + 0.01, 1.0);
  } else {
    // Reset age for dead cells
    age = 0.0;
  }
  
  // Birth time tracking in blue channel
  float birthTime = currentState.b;
  if (nextCell > 0.5 && currentCell < 0.5) {
    // New birth - record time
    birthTime = mod(iTime * 0.1, 1.0);
  } else if (nextCell < 0.5) {
    // Cell died - reset birth time
    birthTime = 0.0;
  }
  
  gl_FragColor = vec4(nextCell, age, birthTime, 1.0);
}
`;

// Fragment shader for rendering pass
const renderShader = `
precision highp float;

uniform sampler2D tMap;
uniform float iTime;
uniform vec3 iResolution;
uniform int uColorMode; // 0: binary, 1: age, 2: rainbow
uniform float uFadeSpeed;

varying vec2 vUv;

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  // Get cell state
  vec4 state = texture2D(tMap, vUv);
  float cell = state.r;
  float age = state.g;
  float birthTime = state.b;
  
  // Calculate color based on mode
  vec3 color;
  
  if (uColorMode == 0) {
    // Binary mode - simple black and white
    color = vec3(cell);
  } else if (uColorMode == 1) {
    // Age mode - color based on cell age
    if (cell > 0.5) {
      // Live cells - from blue to red based on age
      color = mix(vec3(0.0, 0.5, 1.0), vec3(1.0, 0.0, 0.0), age);
    } else {
      // Dead cells - black
      color = vec3(0.0);
    }
  } else {
    // Rainbow mode - color based on birth time
    if (cell > 0.5) {
      // Live cells - rainbow colors
      color = hsv2rgb(vec3(birthTime, 0.8, 1.0));
    } else {
      // Dead cells - fade out
      float fadeMultiplier = pow(uFadeSpeed, 10.0);
      color = hsv2rgb(vec3(birthTime, 0.8, 1.0)) * fadeMultiplier;
    }
  }
  
  // Add subtle grid pattern
  vec2 grid = fract(vUv * iResolution.xy / 4.0);
  float gridLine = max(
    smoothstep(0.95, 1.0, grid.x) * 0.5,
    smoothstep(0.95, 1.0, grid.y) * 0.5
  );
  color = mix(color, vec3(0.2, 0.2, 0.3), gridLine * 0.1);
  
  // Output final color
  gl_FragColor = vec4(color, 1.0);
}
`;

const GameOfLife: React.FC<GameOfLifeProps> = ({ className = '', onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(null);
  const lastUpdateTime = useRef<number>(0);
  const mouseDownRef = useRef(false);
  const eraseMode = useRef(false);
  const [config, setConfig] = useAtom(gameOfLifeConfigAtom);
  const [colorMode, setColorMode] = useState<string>(config.colorMode);
  const [isRunning, setIsRunning] = useState(true);
  const [fps, setFps] = useState<number>(0);
  const fpsValues = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(0);

  const { cellSize, updateRate, fadeSpeed, enableMouseInteraction, brushSize } = config;

  // Handle color mode change
  const handleColorModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newMode = e.target.value;
      setColorMode(newMode);
      setConfig({ ...config, colorMode: newMode });
    },
    [config, setConfig]
  );

  // Toggle simulation running state
  const toggleRunning = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  // Clear the grid
  const clearGrid = useCallback(() => {
    // This will be handled in the effect by setting a flag
    setNeedsReset(true);
  }, []);

  // Random grid
  const randomGrid = useCallback(() => {
    // This will be handled in the effect by setting a flag
    setNeedsRandomize(true);
  }, []);

  // State for reset and randomize flags
  const [needsReset, setNeedsReset] = useState(false);
  const [needsRandomize, setNeedsRandomize] = useState(false);

  // Add preset patterns
  const addGlider = useCallback(() => {
    setPattern('glider');
  }, []);

  const addPulsar = useCallback(() => {
    setPattern('pulsar');
  }, []);

  const addGosperGun = useCallback(() => {
    setPattern('gosperGun');
  }, []);

  // State for pattern to add
  const [pattern, setPattern] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Create renderer with explicit error handling
    let renderer: Renderer | null = null;
    try {
      renderer = new Renderer({
        alpha: true,
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: Math.min(2, window.devicePixelRatio), // Limit DPR for performance
      });
    } catch (error) {
      console.error('Failed to initialize renderer:', error);
      if (onError) onError();
      return; // Exit early if renderer creation fails
    }

    if (!renderer || !renderer.gl) {
      console.error('Renderer or WebGL context is null');
      if (onError) onError();
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Ensure the canvas fills the container
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.position = 'absolute';
    gl.canvas.style.top = '0';
    gl.canvas.style.left = '0';

    // Append canvas to container with error handling
    try {
      container.appendChild(gl.canvas);
    } catch (error) {
      console.error('Failed to append canvas to container:', error);
      if (onError) onError();
      return;
    }

    // Calculate grid dimensions based on cell size
    const gridWidth = Math.ceil(window.innerWidth / cellSize);
    const gridHeight = Math.ceil(window.innerHeight / cellSize);

    // Create geometry for full-screen quad
    const geometry = new Triangle(gl);

    // Create ping-pong render targets for simulation
    const renderTargets = [
      new RenderTarget(gl, {
        width: gridWidth,
        height: gridHeight,
        type: gl.FLOAT,
        format: gl.RGBA,
        internalFormat: gl.renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
        minFilter: gl.NEAREST,
        magFilter: gl.NEAREST,
        depth: false,
      }),
      new RenderTarget(gl, {
        width: gridWidth,
        height: gridHeight,
        type: gl.FLOAT,
        format: gl.RGBA,
        internalFormat: gl.renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
        minFilter: gl.NEAREST,
        magFilter: gl.NEAREST,
        depth: false,
      }),
    ];
    let currentRenderTarget = 0;

    // Initialize grid with random state
    const initialData = new Float32Array(gridWidth * gridHeight * 4);
    for (let i = 0; i < gridHeight; i++) {
      for (let j = 0; j < gridWidth; j++) {
        const idx = (i * gridWidth + j) * 4;
        // 30% chance of a cell being alive initially for better visibility
        initialData[idx] = Math.random() < 0.3 ? 1.0 : 0.0;
        initialData[idx + 1] = 0.0; // Age
        initialData[idx + 2] = 0.0; // Birth time
        initialData[idx + 3] = 1.0; // Alpha
      }
    }

    // Create texture from initial data
    const initialTexture = new Texture(gl, {
      image: initialData,
      width: gridWidth,
      height: gridHeight,
      type: gl.FLOAT,
      format: gl.RGBA,
      internalFormat: gl.renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      wrapS: gl.CLAMP_TO_EDGE,
      wrapT: gl.CLAMP_TO_EDGE,
    });

    // Copy initial data to both render targets
    gl.bindFramebuffer(gl.FRAMEBUFFER, renderTargets[0].buffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      initialTexture.texture,
      0
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, renderTargets[1].buffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      initialTexture.texture,
      0
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Create simulation program
    const simulationProgram = new Program(gl, {
      vertex: vertexShader,
      fragment: simulationShader,
      uniforms: {
        tMap: { value: renderTargets[0].texture },
        iResolution: { value: new Color(gridWidth, gridHeight, gridWidth / gridHeight) },
        iTime: { value: 0 },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseDown: { value: false },
        uBrushSize: { value: brushSize * 2 }, // Double the brush size for better visibility
        uErase: { value: false },
      },
    });

    // Create render program
    const renderProgram = new Program(gl, {
      vertex: vertexShader,
      fragment: renderShader,
      uniforms: {
        tMap: { value: renderTargets[0].texture },
        iTime: { value: 0 },
        iResolution: {
          value: new Color(
            window.innerWidth,
            window.innerHeight,
            window.innerWidth / window.innerHeight
          ),
        },
        uColorMode: { value: colorMode === 'binary' ? 0 : colorMode === 'age' ? 1 : 2 },
        uFadeSpeed: { value: fadeSpeed },
      },
    });

    // Create meshes
    const simulationMesh = new Mesh(gl, { geometry, program: simulationProgram });
    const renderMesh = new Mesh(gl, { geometry, program: renderProgram });

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer?.setSize(width, height);

      // Update resolution uniform for render program
      renderProgram.uniforms.iResolution.value.set(width, height, width / height);
    }

    window.addEventListener('resize', resize);
    resize();

    // Mouse interaction
    const currentMouse = [0.5, 0.5];
    let targetMouse = [0.5, 0.5];

    function handleMouseMove(e: MouseEvent) {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      targetMouse = [x, y];

      // If mouse is down, immediately update the uniform for responsive drawing
      if (mouseDownRef.current) {
        simulationProgram.uniforms.uMouse.value[0] = x;
        simulationProgram.uniforms.uMouse.value[1] = y;
      }
    }

    function handleMouseDown(e: MouseEvent) {
      mouseDownRef.current = true;
      simulationProgram.uniforms.uMouseDown.value = true;

      // Right click or ctrl+click for erase mode
      if (e.button === 2 || e.ctrlKey) {
        eraseMode.current = true;
        simulationProgram.uniforms.uErase.value = true;
        e.preventDefault();
      } else {
        eraseMode.current = false;
        simulationProgram.uniforms.uErase.value = false;
      }
    }

    function handleMouseUp() {
      mouseDownRef.current = false;
      simulationProgram.uniforms.uMouseDown.value = false;
    }

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
    }

    if (enableMouseInteraction) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mousedown', handleMouseDown);
      container.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('mouseup', handleMouseUp);
    }

    // Function to reset the grid
    function resetGrid() {
      const clearData = new Float32Array(gridWidth * gridHeight * 4);
      for (let i = 0; i < gridHeight; i++) {
        for (let j = 0; j < gridWidth; j++) {
          const idx = (i * gridWidth + j) * 4;
          clearData[idx] = 0.0; // All cells dead
          clearData[idx + 1] = 0.0; // Age
          clearData[idx + 2] = 0.0; // Birth time
          clearData[idx + 3] = 1.0; // Alpha
        }
      }

      const clearTexture = new Texture(gl, {
        image: clearData,
        width: gridWidth,
        height: gridHeight,
        type: gl.FLOAT,
        format: gl.RGBA,
        internalFormat: gl.renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
        minFilter: gl.NEAREST,
        magFilter: gl.NEAREST,
      });

      gl.bindFramebuffer(gl.FRAMEBUFFER, renderTargets[0].buffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        clearTexture.texture,
        0
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, renderTargets[1].buffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        clearTexture.texture,
        0
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      setNeedsReset(false);
    }

    // Function to randomize the grid
    function randomizeGrid() {
      const randomData = new Float32Array(gridWidth * gridHeight * 4);
      for (let i = 0; i < gridHeight; i++) {
        for (let j = 0; j < gridWidth; j++) {
          const idx = (i * gridWidth + j) * 4;
          randomData[idx] = Math.random() < 0.3 ? 1.0 : 0.0; // 30% chance of being alive
          randomData[idx + 1] = 0.0; // Age
          randomData[idx + 2] = 0.0; // Birth time
          randomData[idx + 3] = 1.0; // Alpha
        }
      }

      const randomTexture = new Texture(gl, {
        image: randomData,
        width: gridWidth,
        height: gridHeight,
        type: gl.FLOAT,
        format: gl.RGBA,
        internalFormat: gl.renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
        minFilter: gl.NEAREST,
        magFilter: gl.NEAREST,
      });

      gl.bindFramebuffer(gl.FRAMEBUFFER, renderTargets[0].buffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        randomTexture.texture,
        0
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, renderTargets[1].buffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        randomTexture.texture,
        0
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      setNeedsRandomize(false);
    }

    // Function to add a pattern
    function addPatternToGrid(patternType: string) {
      // First, read current grid state
      const pixels = new Float32Array(gridWidth * gridHeight * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, renderTargets[currentRenderTarget].buffer);
      gl.readPixels(0, 0, gridWidth, gridHeight, gl.RGBA, gl.FLOAT, pixels);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // Center position for the pattern
      const centerX = Math.floor(gridWidth / 2);
      const centerY = Math.floor(gridHeight / 2);

      // Add pattern based on type
      if (patternType === 'glider') {
        // Glider pattern
        const glider = [
          [0, 0, 1],
          [1, 0, 1],
          [0, 1, 1],
        ];

        for (let y = 0; y < glider.length; y++) {
          for (let x = 0; x < glider[y].length; x++) {
            const gridX = centerX + x - 1;
            const gridY = centerY + y - 1;
            if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
              const idx = (gridY * gridWidth + gridX) * 4;
              pixels[idx] = glider[y][x];
            }
          }
        }
      } else if (patternType === 'pulsar') {
        // Pulsar pattern (period 3 oscillator)
        const pulsar = [
          [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
          [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
          [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
          [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
          [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
          [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
          [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
          [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
        ];

        for (let y = 0; y < pulsar.length; y++) {
          for (let x = 0; x < pulsar[y].length; x++) {
            const gridX = centerX + x - 6;
            const gridY = centerY + y - 6;
            if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
              const idx = (gridY * gridWidth + gridX) * 4;
              pixels[idx] = pulsar[y][x];
            }
          }
        }
      } else if (patternType === 'gosperGun') {
        // Gosper Glider Gun
        const gun = [
          [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 1, 1,
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 1, 1,
          ],
          [
            1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
          ],
          [
            1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
          ],
        ];

        for (let y = 0; y < gun.length; y++) {
          for (let x = 0; x < gun[y].length; x++) {
            const gridX = centerX + x - 18;
            const gridY = centerY + y - 4;
            if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
              const idx = (gridY * gridWidth + gridX) * 4;
              pixels[idx] = gun[y][x];
            }
          }
        }
      }

      // Update both render targets with the new pattern
      const patternTexture = new Texture(gl, {
        image: pixels,
        width: gridWidth,
        height: gridHeight,
        type: gl.FLOAT,
        format: gl.RGBA,
        internalFormat: gl.renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
        minFilter: gl.NEAREST,
        magFilter: gl.NEAREST,
      });

      gl.bindFramebuffer(gl.FRAMEBUFFER, renderTargets[0].buffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        patternTexture.texture,
        0
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, renderTargets[1].buffer);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        patternTexture.texture,
        0
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      setPattern(null);
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

      // Handle reset request
      if (needsReset) {
        resetGrid();
      }

      // Handle randomize request
      if (needsRandomize) {
        randomizeGrid();
      }

      // Handle pattern request
      if (pattern) {
        addPatternToGrid(pattern);
      }

      // Update time uniform
      simulationProgram.uniforms.iTime.value = t * 0.001;
      renderProgram.uniforms.iTime.value = t * 0.001;

      // Update color mode
      renderProgram.uniforms.uColorMode.value =
        colorMode === 'binary' ? 0 : colorMode === 'age' ? 1 : 2;

      // Update mouse position with smoothing
      if (enableMouseInteraction) {
        const smoothing = 0.1;
        currentMouse[0] += smoothing * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += smoothing * (targetMouse[1] - currentMouse[1]);
        simulationProgram.uniforms.uMouse.value[0] = currentMouse[0];
        simulationProgram.uniforms.uMouse.value[1] = currentMouse[1];
      }

      // Update simulation at fixed rate
      const updateInterval = 1000 / updateRate;
      if (isRunning && t - lastUpdateTime.current > updateInterval) {
        lastUpdateTime.current = t;

        // Ping-pong rendering
        simulationProgram.uniforms.tMap.value = renderTargets[currentRenderTarget].texture;
        renderer?.render({
          scene: simulationMesh,
          target: renderTargets[1 - currentRenderTarget],
        });
        currentRenderTarget = 1 - currentRenderTarget;
      }

      // Render to screen
      renderProgram.uniforms.tMap.value = renderTargets[currentRenderTarget].texture;
      renderer?.render({ scene: renderMesh });

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
        container.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('mouseup', handleMouseUp);
      }

      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    cellSize,
    updateRate,
    colorMode,
    fadeSpeed,
    enableMouseInteraction,
    brushSize,
    isRunning,
    needsReset,
    needsRandomize,
    pattern,
    onError,
    config,
  ]);

  return (
    <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`}>
      {/* FPS Counter */}
      <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {fps} FPS
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-3 rounded">
        <h3 className="text-sm font-bold mb-2">Game of Life Controls</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs">Color Mode:</label>
            <select
              className="bg-black/70 text-white text-xs p-1 rounded"
              value={colorMode}
              onChange={handleColorModeChange}
            >
              <option value="binary">Binary</option>
              <option value="age">Age</option>
              <option value="rainbow">Rainbow</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={`text-xs px-2 py-1 rounded ${isRunning ? 'bg-red-600' : 'bg-green-600'}`}
              onClick={toggleRunning}
            >
              {isRunning ? 'Pause' : 'Play'}
            </button>
            <button className="text-xs px-2 py-1 rounded bg-blue-600" onClick={clearGrid}>
              Clear
            </button>
            <button className="text-xs px-2 py-1 rounded bg-purple-600" onClick={randomGrid}>
              Random
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs">Patterns:</label>
            <button className="text-xs px-2 py-1 rounded bg-indigo-600" onClick={addGlider}>
              Glider
            </button>
            <button className="text-xs px-2 py-1 rounded bg-indigo-600" onClick={addPulsar}>
              Pulsar
            </button>
            <button className="text-xs px-2 py-1 rounded bg-indigo-600" onClick={addGosperGun}>
              Glider Gun
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-2 rounded text-xs max-w-xs text-right">
        Left click to draw cells
        <br />
        Right click to erase cells
      </div>

      {/* Initial Instructions */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-6 py-4 rounded text-center pointer-events-none">
        <h3 className="text-xl font-bold mb-2">Click and drag to draw cells</h3>
        <p className="text-sm">Or try the pattern buttons below</p>
      </div>
    </div>
  );
};

export { GameOfLife };
