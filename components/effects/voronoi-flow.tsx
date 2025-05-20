'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import { atom, useAtom } from 'jotai';

export const voronoiFlowConfigAtom = atom({
  // Performance settings
  particleCount: 5000, // Reduced for better performance
  cellCount: 12, // Number of Voronoi cells

  // Visual settings
  flowSpeed: 0.5,
  particleSize: 1.5,
  fadeSpeed: 0.03,

  // Color settings
  colorMode: 'flow', // "flow", "cell", "distance"
  colorIntensity: 0.8,

  // Interaction
  enableMouseInteraction: true,
  mouseInfluence: 0.3,
});

interface VoronoiFlowProps {
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
uniform int uParticleCount;
uniform int uCellCount;
uniform float uFlowSpeed;
uniform float uParticleSize;
uniform float uFadeSpeed;
uniform int uColorMode; // 0: flow, 1: cell, 2: distance
uniform float uColorIntensity;
uniform vec2 uMouse;
uniform float uMouseInfluence;

varying vec2 vUv;

// Random function
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// Hash function for Voronoi
vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Voronoi function
vec3 voronoi(vec2 x, float time) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  
  vec3 m = vec3(8.0);
  float movement = time * uFlowSpeed * 0.3;
  
  // Iterate through neighboring cells
  for(int j = -1; j <= 1; j++) {
    for(int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      
      // Cell point with some movement
      vec2 o = hash(n + g);
      o = 0.5 + 0.5 * sin(movement + 6.2831 * o);
      
      // Distance to cell point
      vec2 r = g + o - f;
      float d = dot(r, r);
      
      // If this cell is closer than the previous closest
      if(d < m.x) {
        m = vec3(d, o);
      }
    }
  }
  
  return m;
}

// Flow field function
vec2 flowField(vec2 uv, float time) {
  // Get Voronoi cell info
  vec3 v = voronoi(uv * float(uCellCount), time);
  
  // Create flow direction based on Voronoi
  float angle = atan(v.y - 0.5, v.z - 0.5) + time * uFlowSpeed;
  
  // Mouse influence
  vec2 mouseDir = uv - uMouse;
  float mouseDist = length(mouseDir);
  float mouseStrength = exp(-mouseDist * 8.0) * uMouseInfluence;
  
  // Combine flow with mouse influence
  vec2 flow = vec2(cos(angle), sin(angle));
  flow = mix(flow, normalize(mouseDir), mouseStrength);
  
  return flow;
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  // Get previous frame color (for trails)
  vec4 prevColor = vec4(0.0, 0.0, 0.0, 1.0);
  
  // Fade out previous frame
  vec3 color = prevColor.rgb * (1.0 - uFadeSpeed);
  
  // Screen coordinates
  vec2 uv = vUv;
  
  // Seed for particle positions
  float seed = 12345.67;
  
  // Render particles
  for(int i = 0; i < 10000; i++) {
    if(i >= uParticleCount) break;
    
    // Generate consistent random seed for this particle
    float particleSeed = seed + float(i);
    
    // Particle position - use time to move it along flow field
    vec2 pos = vec2(
      random(vec2(particleSeed, 0.0)),
      random(vec2(0.0, particleSeed))
    );
    
    // Move particle along flow field
    float particleTime = iTime * 0.5;
    for(int j = 0; j < 10; j++) {
      vec2 flow = flowField(pos, particleTime);
      pos += flow * 0.003;
      
      // Wrap around edges
      pos = fract(pos);
    }
    
    // Calculate distance to particle
    float dist = length(uv - pos);
    
    // Render particle if close enough
    if(dist < uParticleSize / iResolution.x) {
      // Get Voronoi info for coloring
      vec3 v = voronoi(pos * float(uCellCount), particleTime);
      
      // Calculate particle color based on mode
      vec3 particleColor;
      
      if(uColorMode == 0) {
        // Color by flow direction
        vec2 flow = flowField(pos, particleTime);
        float angle = atan(flow.y, flow.x) / (2.0 * 3.14159) + 0.5;
        particleColor = hsv2rgb(vec3(angle, 0.7, uColorIntensity));
      } else if(uColorMode == 1) {
        // Color by cell
        float cellIndex = v.y * v.z * 10.0;
        particleColor = hsv2rgb(vec3(fract(cellIndex), 0.7, uColorIntensity));
      } else {
        // Color by distance to cell center
        float dist = v.x * 2.0;
        particleColor = hsv2rgb(vec3(0.6 - dist * 0.2, 0.7, uColorIntensity));
      }
      
      // Smooth particle edge
      float alpha = 1.0 - smoothstep(0.0, uParticleSize / iResolution.x, dist);
      
      // Add to color
      color += particleColor * alpha * 0.3;
    }
  }
  
  // Output final color
  gl_FragColor = vec4(color, 1.0);
}
`;

const VoronoiFlow: React.FC<VoronoiFlowProps> = ({ className = '', onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(0);
  const [config] = useAtom(voronoiFlowConfigAtom);
  const [colorMode, setColorMode] = useState<string>(config.colorMode);
  const [fps, setFps] = useState<number>(0);
  const fpsValues = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(0);

  const {
    particleCount,
    cellCount,
    flowSpeed,
    particleSize,
    fadeSpeed,
    colorIntensity,
    enableMouseInteraction,
    mouseInfluence,
  } = config;

  // Handle color mode change
  const handleColorModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setColorMode(e.target.value);
  };

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
      return;
    }

    // Create geometry
    const geometry = new Triangle(gl);

    // Create program
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
        uParticleCount: { value: particleCount },
        uCellCount: { value: cellCount },
        uFlowSpeed: { value: flowSpeed },
        uParticleSize: { value: particleSize },
        uFadeSpeed: { value: fadeSpeed },
        uColorMode: { value: colorMode === 'flow' ? 0 : colorMode === 'cell' ? 1 : 2 },
        uColorIntensity: { value: colorIntensity },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseInfluence: { value: mouseInfluence },
      },
    });

    // Create mesh
    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer?.setSize(width, height);
      program.uniforms.iResolution.value.set(width, height, width / height);
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

      // Update uniforms
      program.uniforms.iTime.value = t * 0.001;
      program.uniforms.uColorMode.value = colorMode === 'flow' ? 0 : colorMode === 'cell' ? 1 : 2;

      if (enableMouseInteraction) {
        const smoothing = 0.05;
        currentMouse[0] += smoothing * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += smoothing * (targetMouse[1] - currentMouse[1]);
        program.uniforms.uMouse.value[0] = currentMouse[0];
        program.uniforms.uMouse.value[1] = currentMouse[1];
      }

      // Render
      renderer?.render({ scene: mesh });
      animationFrameId.current = requestAnimationFrame(update);
    }

    animationFrameId.current = requestAnimationFrame(update);

    // Cleanup
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', resize);

      if (enableMouseInteraction) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }

      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    particleCount,
    cellCount,
    flowSpeed,
    particleSize,
    fadeSpeed,
    colorMode,
    colorIntensity,
    enableMouseInteraction,
    mouseInfluence,
    onError,
  ]);

  return (
    <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`}>
      {/* FPS Counter */}
      <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {fps} FPS
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-3 rounded">
        <h3 className="text-sm font-bold mb-2">Visualization Settings</h3>
        <div className="flex items-center gap-2">
          <label className="text-xs">Color Mode:</label>
          <select
            className="bg-black/70 text-white text-xs p-1 rounded"
            value={colorMode}
            onChange={handleColorModeChange}
          >
            <option value="flow">Flow Direction</option>
            <option value="cell">Cell ID</option>
            <option value="distance">Cell Distance</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export { VoronoiFlow };
