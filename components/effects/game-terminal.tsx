'use client';

import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Color, Texture, Transform } from 'ogl';
import { atom, useAtom } from 'jotai';

export const gameTerminalConfigAtom = atom({
  monitorColor: [0.2, 0.8, 0.2] as [number, number, number], // Green phosphor
  scanlineIntensity: 0.2,
  persistence: 0.3, // Phosphor persistence/ghosting
  glowIntensity: 0.3,
  noiseIntensity: 0.02,
  distortion: 0.08,
  enableMouseInteraction: true,
  textSpeed: 30, // Characters per second
});

// Game state atom
export const gameStateAtom = atom({
  currentText: '',
  targetText:
    'Welcome to the Adventure Terminal.\n\nYou find yourself in a dark room. A faint green glow from this terminal provides the only light.\n\n> ',
  isTyping: false,
  commandHistory: [] as string[],
  currentLocation: 'start',
  inventory: [] as string[],
});

interface GameTerminalProps {
  className?: string;
}

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform vec3 uMonitorColor;
uniform float uScanlineIntensity;
uniform float uPersistence;
uniform float uGlowIntensity;
uniform float uNoiseIntensity;
uniform float uDistortion;
uniform vec2 uMouse;
uniform sampler2D tText;

#define PI 3.14159265359

// Random function
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Distortion function
vec2 distort(vec2 uv) {
  // Barrel distortion
  vec2 cuv = uv * 2.0 - 1.0;
  float r2 = cuv.x * cuv.x + cuv.y * cuv.y;
  float f = 1.0 + r2 * uDistortion;
  cuv *= f;
  return cuv * 0.5 + 0.5;
}

// Scanline effect
float scanline(vec2 uv) {
  // Thicker scanlines with subtle variation
  float scanlineY = uv.y * iResolution.y;
  float scanline = 0.5 + 0.5 * sin(scanlineY * 0.7);
  return 1.0 - scanline * uScanlineIntensity;
}

// Horizontal distortion (like a bad horizontal hold)
float horizontalDistortion(vec2 uv, float time) {
  float distortion = sin(uv.y * 10.0 + time * 0.5) * 0.001 * uDistortion * 5.0;
  return distortion;
}

// Glow effect
float glow(vec2 uv, float intensity) {
  // Center glow
  float dist = length(uv - vec2(0.5));
  return 1.0 - smoothstep(0.0, 0.8, dist) * intensity;
}

// Cursor blink effect
float cursor(vec2 uv, float time) {
  // Blinking cursor at the end of text
  float blink = step(0.5, fract(time));
  return blink;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // Normalized coordinates
  vec2 uv = fragCoord / iResolution.xy;
  vec2 mouse = uMouse;
  
  // Apply distortion
  vec2 distortedUV = distort(uv);
  
  // Check if we're outside the screen after distortion
  if (distortedUV.x < 0.0 || distortedUV.x > 1.0 || distortedUV.y < 0.0 || distortedUV.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  
  // Apply horizontal distortion
  distortedUV.x += horizontalDistortion(distortedUV, iTime);
  
  // Sample text texture
  vec4 textColor = texture2D(tText, distortedUV);
  
  // Apply scanlines
  float scanlineEffect = scanline(distortedUV);
  
  // Apply phosphor persistence/ghosting
  vec4 ghostText = texture2D(tText, distortedUV + vec2(0.001, 0.0));
  textColor = max(textColor, ghostText * uPersistence);
  
  // Apply noise
  float noise = random(distortedUV + iTime) * uNoiseIntensity;
  
  // Apply glow
  float glowEffect = glow(distortedUV, uGlowIntensity);
  
  // Combine effects
  vec3 color = uMonitorColor * textColor.rgb * scanlineEffect * glowEffect;
  
  // Add noise
  color += uMonitorColor * noise;
  
  // Add subtle ambient light
  color += uMonitorColor * 0.05;
  
  // Add subtle horizontal lines
  float hlines = step(0.98, fract(distortedUV.y * iResolution.y * 0.25));
  color += uMonitorColor * hlines * 0.1;
  
  // Ensure full opacity
  fragColor = vec4(color, 1.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

const GameTerminal: React.FC<GameTerminalProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const textContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameId = useRef<number>(null);
  const [config] = useAtom(gameTerminalConfigAtom);
  const [gameState, setGameState] = useAtom(gameStateAtom);
  const {
    monitorColor,
    scanlineIntensity,
    persistence,
    glowIntensity,
    noiseIntensity,
    distortion,
    enableMouseInteraction,
    textSpeed,
  } = config;

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Handle typing effect
  useEffect(() => {
    if (gameState.currentText !== gameState.targetText) {
      setGameState((prev) => ({ ...prev, isTyping: true }));

      const typeNextChar = () => {
        setGameState((prev) => {
          if (prev.currentText.length < prev.targetText.length) {
            const nextChar = prev.targetText.charAt(prev.currentText.length);
            const newText = prev.currentText + nextChar;
            return { ...prev, currentText: newText };
          } else {
            return { ...prev, isTyping: false };
          }
        });
      };

      const typingInterval = setInterval(typeNextChar, 1000 / textSpeed);
      return () => clearInterval(typingInterval);
    }
  }, [gameState.currentText, gameState.targetText, textSpeed, setGameState]);

  // Handle user input
  const handleUserInput = (input: string) => {
    const command = input.trim().toLowerCase();

    // Add command to history
    setGameState((prev) => ({
      ...prev,
      commandHistory: [...prev.commandHistory, command],
    }));

    // Process command
    let response = '';

    // Simple command parser for a text adventure
    if (command === 'help') {
      response = 'Available commands: look, inventory, take [item], go [direction], help\n\n> ';
    } else if (command === 'look') {
      if (gameState.currentLocation === 'start') {
        response =
          "You're in a dimly lit room. There's an old desk with this terminal on it. A door leads north, and there's a small key on the floor.\n\n> ";
      } else if (gameState.currentLocation === 'hallway') {
        response =
          "You're in a long hallway. Doors lead east and west. The room with the terminal is to the south.\n\n> ";
      } else if (gameState.currentLocation === 'vault') {
        response =
          "You're in what appears to be a vault. There's a strange device on a pedestal in the center of the room.\n\n> ";
      }
    } else if (command === 'inventory') {
      if (gameState.inventory.length === 0) {
        response = 'Your inventory is empty.\n\n> ';
      } else {
        response = `You are carrying: ${gameState.inventory.join(', ')}\n\n> `;
      }
    } else if (command.startsWith('take ')) {
      const item = command.substring(5);
      if (
        gameState.currentLocation === 'start' &&
        item === 'key' &&
        !gameState.inventory.includes('key')
      ) {
        setGameState((prev) => ({
          ...prev,
          inventory: [...prev.inventory, 'key'],
        }));
        response = 'You pick up the key.\n\n> ';
      } else if (
        gameState.currentLocation === 'vault' &&
        item === 'device' &&
        !gameState.inventory.includes('device')
      ) {
        setGameState((prev) => ({
          ...prev,
          inventory: [...prev.inventory, 'device'],
        }));
        response =
          'You carefully take the strange device. It hums with an otherworldly energy.\n\n> ';
      } else {
        response = "You don't see that here.\n\n> ";
      }
    } else if (command.startsWith('go ')) {
      const direction = command.substring(3);
      if (gameState.currentLocation === 'start' && direction === 'north') {
        setGameState((prev) => ({
          ...prev,
          currentLocation: 'hallway',
        }));
        response = 'You go north into a hallway.\n\n> ';
      } else if (gameState.currentLocation === 'hallway' && direction === 'south') {
        setGameState((prev) => ({
          ...prev,
          currentLocation: 'start',
        }));
        response = 'You return to the room with the terminal.\n\n> ';
      } else if (
        gameState.currentLocation === 'hallway' &&
        direction === 'east' &&
        gameState.inventory.includes('key')
      ) {
        setGameState((prev) => ({
          ...prev,
          currentLocation: 'vault',
        }));
        response =
          'You use the key to unlock the east door and enter what appears to be a vault.\n\n> ';
      } else if (
        gameState.currentLocation === 'hallway' &&
        direction === 'east' &&
        !gameState.inventory.includes('key')
      ) {
        response = 'The door is locked. You need a key.\n\n> ';
      } else if (gameState.currentLocation === 'hallway' && direction === 'west') {
        response = "The west door is jammed and won't open.\n\n> ";
      } else if (gameState.currentLocation === 'vault' && direction === 'west') {
        setGameState((prev) => ({
          ...prev,
          currentLocation: 'hallway',
        }));
        response = 'You return to the hallway.\n\n> ';
      } else {
        response = "You can't go that way.\n\n> ";
      }
    } else {
      response = "I don't understand that command. Type 'help' for a list of commands.\n\n> ";
    }

    // Update the target text with the response
    setGameState((prev) => ({
      ...prev,
      targetText: prev.currentText + '\n' + response,
    }));
  };

  // Handle keyboard input
  useEffect(() => {
    let inputBuffer = '';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState.isTyping) {
        if (e.key === 'Enter') {
          // Process command
          if (inputBuffer.trim()) {
            // Update the current text to include the user's input
            setGameState((prev) => ({
              ...prev,
              currentText: prev.currentText + inputBuffer,
            }));

            // Process the command
            handleUserInput(inputBuffer);

            // Clear the input buffer
            inputBuffer = '';
          }
        } else if (e.key === 'Backspace') {
          // Remove the last character from the input buffer
          inputBuffer = inputBuffer.slice(0, -1);

          // Update the current text
          setGameState((prev) => ({
            ...prev,
            currentText:
              prev.currentText.slice(0, prev.currentText.lastIndexOf('>') + 2) + inputBuffer,
          }));
        } else if (e.key.length === 1) {
          // Add the character to the input buffer
          inputBuffer += e.key;

          // Update the current text
          setGameState((prev) => ({
            ...prev,
            currentText:
              prev.currentText.slice(0, prev.currentText.lastIndexOf('>') + 2) + inputBuffer,
          }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.isTyping, setGameState]);

  // Render text to canvas
  useEffect(() => {
    if (!textCanvasRef.current) return;

    const canvas = textCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    textContextRef.current = ctx;

    // Set canvas size
    canvas.width = 1024;
    canvas.height = 1024;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set text properties
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px monospace';
    ctx.textBaseline = 'top';

    // Draw text
    const lines = gameState.currentText.split('\n');
    const lineHeight = 30;
    const startX = 40;
    let startY = 40;

    lines.forEach((line) => {
      ctx.fillText(line, startX, startY);
      startY += lineHeight;
    });

    // Draw cursor if not typing
    if (!gameState.isTyping) {
      const lastLine = lines[lines.length - 1];
      const cursorX = startX + ctx.measureText(lastLine).width;
      const cursorY = startY - lineHeight;

      // Blinking cursor
      const now = Date.now();
      if (Math.floor(now / 500) % 2 === 0) {
        ctx.fillRect(cursorX, cursorY, 12, 24);
      }
    }
  }, [gameState.currentText, gameState.isTyping]);

  useEffect(() => {
    if (!containerRef.current || !textCanvasRef.current) return;
    const container = containerRef.current;

    // Create text canvas (hidden)
    const textCanvas = textCanvasRef.current;
    textCanvas.style.display = 'none';
    document.body.appendChild(textCanvas);

    // Create renderer with explicit size
    const renderer = new Renderer({
      alpha: true,
      width: window.innerWidth,
      height: window.innerHeight,
      canvas: canvasRef.current || undefined,
    });

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

    container.appendChild(gl.canvas);

    // Use Triangle geometry for full screen coverage
    const geometry = new Triangle(gl);

    // Create text texture
    const texture = new Texture(gl, {
      image: textCanvas,
      generateMipmaps: false,
    });

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: new Color(
            window.innerWidth,
            window.innerHeight,
            window.innerWidth / window.innerHeight
          ),
        },
        tText: { value: texture },
        uMonitorColor: { value: new Color(...monitorColor) },
        uScanlineIntensity: { value: scanlineIntensity },
        uPersistence: { value: persistence },
        uGlowIntensity: { value: glowIntensity },
        uNoiseIntensity: { value: noiseIntensity },
        uDistortion: { value: distortion },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      // Get the actual dimensions of the window
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Set the renderer size to match the window
      renderer.setSize(width, height);

      // Update the resolution uniform
      program.uniforms.iResolution.value.r = width;
      program.uniforms.iResolution.value.g = height;
      program.uniforms.iResolution.value.b = width / height;
    }

    window.addEventListener('resize', resize);
    resize();

    const currentMouse = [0.5, 0.5];
    let targetMouse = [0.5, 0.5];

    function handleMouseMove(e: MouseEvent) {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;
      targetMouse = [x, y];
    }

    function handleMouseLeave() {
      targetMouse = [0.5, 0.5];
    }

    if (enableMouseInteraction) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    function update(t: number) {
      // Update text texture
      texture.image = textCanvas;
      texture.needsUpdate = true;

      if (enableMouseInteraction) {
        const smoothing = 0.05;
        currentMouse[0] += smoothing * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += smoothing * (targetMouse[1] - currentMouse[1]);
        program.uniforms.uMouse.value[0] = currentMouse[0];
        program.uniforms.uMouse.value[1] = currentMouse[1];
      } else {
        program.uniforms.uMouse.value[0] = 0.5;
        program.uniforms.uMouse.value[1] = 0.5;
      }
      program.uniforms.iTime.value = t * 0.001;

      const scene = new Transform();
      scene.addChild(mesh);
      renderer.render({ scene: mesh });
      animationFrameId.current = requestAnimationFrame(update);
    }

    animationFrameId.current = requestAnimationFrame(update);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', resize);

      if (enableMouseInteraction) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
      if (document.body.contains(textCanvas)) document.body.removeChild(textCanvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    monitorColor,
    scanlineIntensity,
    persistence,
    glowIntensity,
    noiseIntensity,
    distortion,
    enableMouseInteraction,
  ]);

  return (
    <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`} tabIndex={0}>
      <canvas ref={canvasRef} />
      <canvas ref={textCanvasRef} className="hidden" width="1024" height="1024" />
    </div>
  );
};

export { GameTerminal };
