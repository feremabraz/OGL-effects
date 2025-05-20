'use client';

import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import { atom, useAtom } from 'jotai';

export const metaballsConfigAtom = atom({
  // Ball settings
  ballCount: 8,
  ballSpeed: 0.5,
  ballSize: 0.15,

  // Visual settings
  threshold: 1.0,
  smoothing: 0.05,
  colorCycle: 0.2,

  // Interaction
  enableMouseInteraction: true,
  mouseForce: 0.3,
});

interface MetaballsProps {
  className?: string;
  onError?: () => void;
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
uniform int uBallCount;
uniform float uBallSize;
uniform float uThreshold;
uniform float uSmoothing;
uniform float uColorCycle;
uniform vec2 uMouse;
uniform float uMouseForce;
uniform vec2 uBallPositions[16]; // Max 16 balls
uniform vec2 uBallVelocities[16];

varying vec2 vUv;

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  // Convert UV to centered coordinates
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y; // Correct for aspect ratio
  
  // Calculate metaball field
  float totalField = 0.0;
  
  for (int i = 0; i < 16; i++) {
    if (i >= uBallCount) break;
    
    vec2 ballPos = uBallPositions[i];
    float distSquared = length(uv - ballPos) * length(uv - ballPos);
    float radius = uBallSize;
    
    // Add field contribution from this ball
    totalField += radius * radius / max(distSquared, 0.0001);
  }
  
  // Apply threshold with smoothing
  float fieldValue = smoothstep(uThreshold - uSmoothing, uThreshold + uSmoothing, totalField);
  
  // Create color based on field value
  float hue = fieldValue * 0.7 + iTime * uColorCycle;
  vec3 color = hsv2rgb(vec3(hue, 0.8, 0.9));
  
  // Add subtle glow
  color += hsv2rgb(vec3(hue + 0.1, 0.7, 0.8)) * (1.0 - fieldValue) * 0.2;
  
  // Add subtle patterns based on field gradient
  float pattern = fract(totalField * 5.0 - iTime * 0.1);
  color = mix(color, color * (0.9 + 0.1 * pattern), 0.2);
  
  // Output final color with alpha based on field
  gl_FragColor = vec4(color, fieldValue);
}
`;

const Metaballs: React.FC<MetaballsProps> = ({ className = '', onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>(0);
  const [config] = useAtom(metaballsConfigAtom);
  const [fps, setFps] = useState<number>(0);
  const fpsValues = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(0);
  const ballPositions = useRef<Float32Array>(new Float32Array(32)); // x,y for up to 16 balls
  const ballVelocities = useRef<Float32Array>(new Float32Array(32));

  const {
    ballCount,
    ballSpeed,
    ballSize,
    threshold,
    smoothing,
    colorCycle,
    enableMouseInteraction,
    mouseForce,
  } = config;

  // Initialize ball positions and velocities
  useEffect(() => {
    const positions = ballPositions.current;
    const velocities = ballVelocities.current;

    for (let i = 0; i < ballCount; i++) {
      // Random positions between -1 and 1
      positions[i * 2] = Math.random() * 2 - 1;
      positions[i * 2 + 1] = Math.random() * 2 - 1;

      // Random velocities
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 0.5 + 0.5) * ballSpeed * 0.02;
      velocities[i * 2] = Math.cos(angle) * speed;
      velocities[i * 2 + 1] = Math.sin(angle) * speed;
    }
  }, [ballCount, ballSpeed]);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;

    // Create renderer with explicit error handling
    let renderer: Renderer | null = null;
    try {
      renderer = new Renderer({
        canvas,
        alpha: true,
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: Math.min(2, window.devicePixelRatio),
      });
    } catch (error) {
      console.error('Failed to initialize renderer:', error);
      if (onError) onError();
      return;
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

    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.position = 'absolute';
    gl.canvas.style.top = '0';
    gl.canvas.style.left = '0';

    // Create geometry
    const geometry = new Triangle(gl);

    // Create uniform arrays for ball positions and velocities
    const ballPositionsArray = [];
    const ballVelocitiesArray = [];
    for (let i = 0; i < 16; i++) {
      ballPositionsArray.push({ value: new Float32Array([0, 0]) });
      ballVelocitiesArray.push({ value: new Float32Array([0, 0]) });
    }

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
        uBallCount: { value: ballCount },
        uBallSize: { value: ballSize },
        uThreshold: { value: threshold },
        uSmoothing: { value: smoothing },
        uColorCycle: { value: colorCycle },
        uMouse: { value: new Float32Array([0, 0]) },
        uMouseForce: { value: mouseForce },
        uBallPositions: { value: ballPositionsArray.map((p) => p.value) },
        uBallVelocities: { value: ballVelocitiesArray.map((v) => v.value) },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });

    const currentMouse = [0, 0];
    let targetMouse = [0, 0];

    function handleMouseMove(e: MouseEvent) {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetMouse = [x * (window.innerWidth / window.innerHeight), y];
    }

    function handleMouseLeave() {
      targetMouse = [0, 0];
    }

    if (enableMouseInteraction) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    // Initialize ball positions and velocities
    const positions = ballPositions.current;
    const velocities = ballVelocities.current;

    for (let i = 0; i < ballCount; i++) {
      // Random positions between -1 and 1
      positions[i * 2] = Math.random() * 2 - 1;
      positions[i * 2 + 1] = Math.random() * 2 - 1;

      // Random velocities
      const angle = Math.random() * Math.PI * 2;
      const speed = (Math.random() * 0.5 + 0.5) * ballSpeed * 0.02;
      velocities[i * 2] = Math.cos(angle) * speed;
      velocities[i * 2 + 1] = Math.sin(angle) * speed;
    }

    // Animation loop with FPS calculation
    function update(t: number) {
      if (lastFrameTime.current) {
        const frameTime = t - lastFrameTime.current;
        const currentFps = 1000 / frameTime;
        fpsValues.current.push(currentFps);
        if (fpsValues.current.length > 10) fpsValues.current.shift();
        if (t % 10 < 1) {
          const avgFps = fpsValues.current.reduce((sum, fps) => sum + fps, 0) / fpsValues.current.length;
          setFps(Math.round(avgFps));
        }
      }
      lastFrameTime.current = t;
      program.uniforms.iTime.value = t * 0.001;
      if (enableMouseInteraction) {
        const smoothing = 0.1;
        currentMouse[0] += smoothing * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += smoothing * (targetMouse[1] - currentMouse[1]);
        program.uniforms.uMouse.value[0] = currentMouse[0];
        program.uniforms.uMouse.value[1] = currentMouse[1];
      }
      const positions = ballPositions.current;
      const velocities = ballVelocities.current;
      const dt = 1.0 / 60.0;
      for (let i = 0; i < ballCount; i++) {
        const idx = i * 2;
        if (enableMouseInteraction && (currentMouse[0] !== 0 || currentMouse[1] !== 0)) {
          const dx = positions[idx] - currentMouse[0];
          const dy = positions[idx + 1] - currentMouse[1];
          const distSquared = dx * dx + dy * dy;
          if (distSquared < 0.5) {
            const dist = Math.sqrt(distSquared);
            const force = mouseForce / (dist + 0.1);
            velocities[idx] += (dx / dist) * force * dt;
            velocities[idx + 1] += (dy / dist) * force * dt;
          }
        }
        positions[idx] += velocities[idx];
        positions[idx + 1] += velocities[idx + 1];
        if (Math.abs(positions[idx]) > 1.5) {
          velocities[idx] *= -0.8;
          positions[idx] = Math.sign(positions[idx]) * 1.5;
        }
        if (Math.abs(positions[idx + 1]) > 1.0) {
          velocities[idx + 1] *= -0.8;
          positions[idx + 1] = Math.sign(positions[idx + 1]) * 1.0;
        }
        velocities[idx] *= 0.99;
        velocities[idx + 1] *= 0.99;
        program.uniforms.uBallPositions.value[i][0] = positions[idx];
        program.uniforms.uBallPositions.value[i][1] = positions[idx + 1];
        program.uniforms.uBallVelocities.value[i][0] = velocities[idx];
        program.uniforms.uBallVelocities.value[i][1] = velocities[idx + 1];
      }
      renderer?.render({ scene: mesh });
      animationFrameId.current = requestAnimationFrame(update);
    }
    animationFrameId.current = requestAnimationFrame(update);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (enableMouseInteraction) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [ballCount, ballSize, threshold, smoothing, colorCycle, enableMouseInteraction, mouseForce, onError]);

  return (
    <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`}>
      <canvas ref={canvasRef} />
      <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {fps} FPS
      </div>
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-3 rounded">
        <h3 className="text-sm font-bold mb-2">Metaballs Settings</h3>
        <div className="text-xs">Move your mouse to interact with the metaballs</div>
      </div>
    </div>
  );
};

export { Metaballs };
