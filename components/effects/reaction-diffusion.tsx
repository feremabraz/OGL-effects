'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Color, RenderTarget } from 'ogl';
import { atom, useAtom } from 'jotai';

export const reactionDiffusionConfigAtom = atom({
  feedRate: 0.035, // Feed rate parameter (F)
  killRate: 0.062, // Kill rate parameter (k)
  diffusionRateA: 1.0, // Diffusion rate of chemical A
  diffusionRateB: 0.5, // Diffusion rate of chemical B
  timeScale: 1.0, // Speed of simulation
  colorA: [0.0, 0.0, 0.2] as [number, number, number], // Dark blue
  colorB: [0.0, 1.0, 0.8] as [number, number, number], // Cyan
  brushSize: 0.05, // Size of the interaction brush
  enableMouseInteraction: true,
});

interface ReactionDiffusionProps {
  className?: string;
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
uniform float iTime;
uniform vec3 iResolution;
uniform float uFeedRate;
uniform float uKillRate;
uniform float uDiffusionRateA;
uniform float uDiffusionRateB;
uniform float uTimeScale;
uniform vec2 uMouse;
uniform float uBrushSize;
uniform int uMouseDown;

varying vec2 vUv;

void main() {
  // Get the current state
  vec2 uv = vUv;
  vec4 state = texture2D(tMap, uv);
  
  // Extract chemical concentrations
  float a = state.r; // Chemical A (prey)
  float b = state.g; // Chemical B (predator)
  
  // Compute Laplacian using 9-point stencil
  vec2 texel = 1.0 / iResolution.xy;
  
  // Sample neighbors
  float a_n = texture2D(tMap, uv + vec2(0.0, texel.y)).r;
  float a_s = texture2D(tMap, uv + vec2(0.0, -texel.y)).r;
  float a_e = texture2D(tMap, uv + vec2(texel.x, 0.0)).r;
  float a_w = texture2D(tMap, uv + vec2(-texel.x, 0.0)).r;
  float a_ne = texture2D(tMap, uv + vec2(texel.x, texel.y)).r;
  float a_nw = texture2D(tMap, uv + vec2(-texel.x, texel.y)).r;
  float a_se = texture2D(tMap, uv + vec2(texel.x, -texel.y)).r;
  float a_sw = texture2D(tMap, uv + vec2(-texel.x, -texel.y)).r;
  
  float b_n = texture2D(tMap, uv + vec2(0.0, texel.y)).g;
  float b_s = texture2D(tMap, uv + vec2(0.0, -texel.y)).g;
  float b_e = texture2D(tMap, uv + vec2(texel.x, 0.0)).g;
  float b_w = texture2D(tMap, uv + vec2(-texel.x, 0.0)).g;
  float b_ne = texture2D(tMap, uv + vec2(texel.x, texel.y)).g;
  float b_nw = texture2D(tMap, uv + vec2(-texel.x, texel.y)).g;
  float b_se = texture2D(tMap, uv + vec2(texel.x, -texel.y)).g;
  float b_sw = texture2D(tMap, uv + vec2(-texel.x, -texel.y)).g;
  
  // Compute Laplacian
  float laplacianA = 0.05 * a_n + 0.05 * a_s + 0.05 * a_e + 0.05 * a_w + 
                     0.025 * a_ne + 0.025 * a_nw + 0.025 * a_se + 0.025 * a_sw - 
                     0.3 * a;
                     
  float laplacianB = 0.05 * b_n + 0.05 * b_s + 0.05 * b_e + 0.05 * b_w + 
                     0.025 * b_ne + 0.025 * b_nw + 0.025 * b_se + 0.025 * b_sw - 
                     0.3 * b;
  
  // Compute reaction-diffusion update
  float deltaT = 1.0 * uTimeScale;
  float reactionRate = a * b * b;
  
  float nextA = a + deltaT * (uDiffusionRateA * laplacianA - reactionRate + uFeedRate * (1.0 - a));
  float nextB = b + deltaT * (uDiffusionRateB * laplacianB + reactionRate - (uKillRate + uFeedRate) * b);
  
  // Clamp values
  nextA = clamp(nextA, 0.0, 1.0);
  nextB = clamp(nextB, 0.0, 1.0);
  
  // Add mouse interaction
  if (uMouseDown == 1) {
    float dist = distance(uv, uMouse);
    if (dist < uBrushSize) {
      float influence = 1.0 - smoothstep(0.0, uBrushSize, dist);
      nextB = mix(nextB, 1.0, influence);
    }
  }
  
  // Output new state
  gl_FragColor = vec4(nextA, nextB, 0.0, 1.0);
}
`;

// Fragment shader for rendering pass
const renderShader = `
precision highp float;

uniform sampler2D tMap;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying vec2 vUv;

void main() {
  // Get the current state
  vec4 state = texture2D(tMap, vUv);
  
  // Extract chemical concentrations
  float a = state.r; // Chemical A
  float b = state.g; // Chemical B
  
  // Map concentrations to colors
  vec3 color = mix(uColorA, uColorB, b);
  
  // Add some subtle variations based on both chemicals
  color = mix(color, vec3(1.0), a * b * 0.2);
  
  // Output final color
  gl_FragColor = vec4(color, 1.0);
}
`;

const ReactionDiffusion: React.FC<ReactionDiffusionProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(0);
  const mouseDownRef = useRef(false);
  const [config] = useAtom(reactionDiffusionConfigAtom);
  const {
    feedRate,
    killRate,
    diffusionRateA,
    diffusionRateB,
    timeScale,
    colorA,
    colorB,
    brushSize,
    enableMouseInteraction,
  } = config;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Create renderer
    const renderer = new Renderer({
      alpha: true,
      width: window.innerWidth,
      height: window.innerHeight,
    });

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    container.appendChild(gl.canvas);

    // Ensure the canvas fills the container
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.position = 'absolute';
    gl.canvas.style.top = '0';
    gl.canvas.style.left = '0';

    // Create geometry
    const geometry = new Triangle(gl);

    // Create ping-pong render targets
    const fbo = {
      read: new RenderTarget(gl, { width: 512, height: 512 }),
      write: new RenderTarget(gl, { width: 512, height: 512 }),
      swap: () => {
        const temp = fbo.read;
        fbo.read = fbo.write;
        fbo.write = temp;
      },
    };

    // Initialize the simulation with some seed pattern
    const initialData = new Uint8Array(512 * 512 * 4);
    for (let i = 0; i < 512; i++) {
      for (let j = 0; j < 512; j++) {
        const idx = (i * 512 + j) * 4;

        // Set initial state (mostly chemical A with some small spots of B)
        initialData[idx] = 255; // A = 1.0 (red channel)
        initialData[idx + 1] = 0; // B = 0.0 (green channel)

        // Add some random spots of chemical B
        const centerX = 512 / 2;
        const centerY = 512 / 2;
        const dx = j - centerX;
        const dy = i - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Create a circular pattern in the center
        if (dist < 20) {
          initialData[idx + 1] = 255; // B = 1.0
        }

        // Add some random spots
        if (Math.random() < 0.001) {
          initialData[idx + 1] = 255; // B = 1.0
        }

        initialData[idx + 2] = 0; // Unused (blue channel)
        initialData[idx + 3] = 255; // Alpha = 1.0
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, fbo.read.texture.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, initialData);
    gl.bindTexture(gl.TEXTURE_2D, fbo.write.texture.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, initialData);

    // Create simulation program
    const simulationProgram = new Program(gl, {
      vertex: vertexShader,
      fragment: simulationShader,
      uniforms: {
        tMap: { value: fbo.read.texture },
        iTime: { value: 0 },
        iResolution: { value: new Color(512, 512, 1) },
        uFeedRate: { value: feedRate },
        uKillRate: { value: killRate },
        uDiffusionRateA: { value: diffusionRateA },
        uDiffusionRateB: { value: diffusionRateB },
        uTimeScale: { value: timeScale },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uBrushSize: { value: brushSize },
        uMouseDown: { value: 0 },
      },
    });

    // Create render program
    const renderProgram = new Program(gl, {
      vertex: vertexShader,
      fragment: renderShader,
      uniforms: {
        tMap: { value: fbo.read.texture },
        uColorA: { value: new Color(...colorA) },
        uColorB: { value: new Color(...colorB) },
      },
    });

    // Create meshes
    const simulationMesh = new Mesh(gl, { geometry, program: simulationProgram });
    const renderMesh = new Mesh(gl, { geometry, program: renderProgram });

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
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

    function handleMouseDown() {
      mouseDownRef.current = true;
    }

    function handleMouseUp() {
      mouseDownRef.current = false;
    }

    function handleMouseLeave() {
      mouseDownRef.current = false;
      targetMouse = [0.5, 0.5];
    }

    if (enableMouseInteraction) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mousedown', handleMouseDown);
      container.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    function update(t: number) {
      // Update uniforms
      simulationProgram.uniforms.iTime.value = t * 0.001;
      simulationProgram.uniforms.uFeedRate.value = feedRate;
      simulationProgram.uniforms.uKillRate.value = killRate;
      simulationProgram.uniforms.uDiffusionRateA.value = diffusionRateA;
      simulationProgram.uniforms.uDiffusionRateB.value = diffusionRateB;
      simulationProgram.uniforms.uTimeScale.value = timeScale;
      simulationProgram.uniforms.uBrushSize.value = brushSize;

      renderProgram.uniforms.uColorA.value.set(...colorA);
      renderProgram.uniforms.uColorB.value.set(...colorB);

      if (enableMouseInteraction) {
        const smoothing = 0.05;
        currentMouse[0] += smoothing * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += smoothing * (targetMouse[1] - currentMouse[1]);
        simulationProgram.uniforms.uMouse.value[0] = currentMouse[0];
        simulationProgram.uniforms.uMouse.value[1] = currentMouse[1];
        simulationProgram.uniforms.uMouseDown.value = mouseDownRef.current ? 1 : 0;
      }

      // Simulation step
      renderer.render({ scene: simulationMesh, target: fbo.write });
      fbo.swap();

      // Update texture reference
      simulationProgram.uniforms.tMap.value = fbo.read.texture;
      renderProgram.uniforms.tMap.value = fbo.read.texture;

      // Render to screen
      renderer.render({ scene: renderMesh });

      animationFrameId.current = requestAnimationFrame(update);
    }

    animationFrameId.current = requestAnimationFrame(update);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', resize);

      if (enableMouseInteraction) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mousedown', handleMouseDown);
        container.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    feedRate,
    killRate,
    diffusionRateA,
    diffusionRateB,
    timeScale,
    colorA,
    colorB,
    brushSize,
    enableMouseInteraction,
  ]);

  return <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`} />;
};

export { ReactionDiffusion };
