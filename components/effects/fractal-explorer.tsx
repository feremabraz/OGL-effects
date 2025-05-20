'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import { atom, useAtom } from 'jotai';

export const fractalConfigAtom = atom({
  // Julia set parameters
  juliaReal: -0.7, // Real part of Julia constant
  juliaImag: 0.27, // Imaginary part of Julia constant
  maxIterations: 100, // Maximum iterations for fractal calculation
  escapeRadius: 4.0, // Escape radius for fractal calculation

  // View parameters
  zoom: 1.0, // Zoom level
  offsetX: 0.0, // X offset for panning
  offsetY: 0.0, // Y offset for panning

  // Visual parameters
  colorCycles: 3.0, // Number of color cycles
  colorSpeed: 0.5, // Speed of color cycling
  colorSaturation: 0.8, // Color saturation
  colorBrightness: 0.9, // Color brightness

  // Interaction
  enableMouseInteraction: true,
  zoomSpeed: 0.1, // Speed of zoom when scrolling
});

interface FractalExplorerProps {
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
uniform float uJuliaReal;
uniform float uJuliaImag;
uniform float uMaxIterations;
uniform float uEscapeRadius;
uniform float uZoom;
uniform float uOffsetX;
uniform float uOffsetY;
uniform float uColorCycles;
uniform float uColorSpeed;
uniform float uColorSaturation;
uniform float uColorBrightness;

varying vec2 vUv;

// Convert HSV to RGB
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// Calculate Julia set
vec2 complexSqr(vec2 z) {
  return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
}

float julia(vec2 z, vec2 c) {
  float iter = 0.0;
  for(float i = 0.0; i < 1000.0; i++) {
    if(i >= uMaxIterations) break;
    
    z = complexSqr(z) + c;
    
    if(dot(z, z) > uEscapeRadius) {
      // Smooth coloring formula
      return i + 1.0 - log(log(dot(z, z))) / log(2.0);
    }
    
    iter += 1.0;
  }
  
  return iter;
}

void main() {
  // Map UV to complex plane
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y; // Correct for aspect ratio
  
  // Apply zoom and offset
  uv = uv / uZoom + vec2(uOffsetX, uOffsetY);
  
  // Calculate Julia set
  vec2 c = vec2(uJuliaReal, uJuliaImag);
  float iterations = julia(uv, c);
  
  // Coloring
  if(iterations < uMaxIterations) {
    // Normalize iteration count
    float normalized = iterations / uMaxIterations;
    
    // Create a cycling color based on iteration count and time
    float hue = normalized * uColorCycles + iTime * uColorSpeed;
    vec3 color = hsv2rgb(vec3(hue, uColorSaturation, uColorBrightness));
    
    // Add some depth with a subtle shadow effect
    float shadow = pow(normalized, 1.5);
    color *= mix(0.8, 1.0, shadow);
    
    gl_FragColor = vec4(color, 1.0);
  } else {
    // Points inside the set are black
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  }
}
`;

const FractalExplorer: React.FC<FractalExplorerProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(null);
  const lastMousePos = useRef<[number, number]>([0, 0]);
  const isDragging = useRef(false);
  const [config, setConfig] = useAtom(fractalConfigAtom);
  const {
    juliaReal,
    juliaImag,
    maxIterations,
    escapeRadius,
    zoom,
    offsetX,
    offsetY,
    colorCycles,
    colorSpeed,
    colorSaturation,
    colorBrightness,
    enableMouseInteraction,
    zoomSpeed,
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
        uJuliaReal: { value: juliaReal },
        uJuliaImag: { value: juliaImag },
        uMaxIterations: { value: maxIterations },
        uEscapeRadius: { value: escapeRadius },
        uZoom: { value: zoom },
        uOffsetX: { value: offsetX },
        uOffsetY: { value: offsetY },
        uColorCycles: { value: colorCycles },
        uColorSpeed: { value: colorSpeed },
        uColorSaturation: { value: colorSaturation },
        uColorBrightness: { value: colorBrightness },
      },
    });

    // Create mesh
    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      program.uniforms.iResolution.value.set(width, height, width / height);
    }

    window.addEventListener('resize', resize);
    resize();

    // Mouse interaction handlers
    function handleMouseDown(e: MouseEvent) {
      if (!enableMouseInteraction) return;
      isDragging.current = true;
      lastMousePos.current = [e.clientX, e.clientY];
    }

    function handleMouseMove(e: MouseEvent) {
      if (!enableMouseInteraction || !isDragging.current) return;

      const dx = (e.clientX - lastMousePos.current[0]) / window.innerWidth;
      const dy = (e.clientY - lastMousePos.current[1]) / window.innerHeight;

      // Adjust offset based on zoom level (higher zoom = smaller movements)
      setConfig((prev) => ({
        ...prev,
        offsetX: prev.offsetX - (dx * 2.0) / prev.zoom,
        offsetY: prev.offsetY + (dy * 2.0) / prev.zoom,
      }));

      lastMousePos.current = [e.clientX, e.clientY];
    }

    function handleMouseUp() {
      isDragging.current = false;
    }

    function handleMouseLeave() {
      isDragging.current = false;
    }

    function handleWheel(e: WheelEvent) {
      if (!enableMouseInteraction) return;
      e.preventDefault();

      // Calculate zoom factor
      const zoomFactor = e.deltaY > 0 ? 1.0 - zoomSpeed : 1.0 + zoomSpeed;

      // Get mouse position in normalized coordinates
      const rect = container.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      // Adjust mouseX for aspect ratio
      const aspectRatio = window.innerWidth / window.innerHeight;
      const adjustedMouseX = mouseX * aspectRatio;

      // Calculate new zoom and offset
      const newZoom = zoom * zoomFactor;

      // Adjust offset to zoom toward mouse position
      const newOffsetX = offsetX + (adjustedMouseX / zoom - adjustedMouseX / newZoom);
      const newOffsetY = offsetY + (mouseY / zoom - mouseY / newZoom);

      setConfig((prev) => ({
        ...prev,
        zoom: newZoom,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      }));
    }

    if (enableMouseInteraction) {
      container.addEventListener('mousedown', handleMouseDown);
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('mouseleave', handleMouseLeave);
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    // Animation loop
    function update(t: number) {
      // Update uniforms
      program.uniforms.iTime.value = t * 0.001;
      program.uniforms.uJuliaReal.value = juliaReal;
      program.uniforms.uJuliaImag.value = juliaImag;
      program.uniforms.uMaxIterations.value = maxIterations;
      program.uniforms.uEscapeRadius.value = escapeRadius;
      program.uniforms.uZoom.value = zoom;
      program.uniforms.uOffsetX.value = offsetX;
      program.uniforms.uOffsetY.value = offsetY;
      program.uniforms.uColorCycles.value = colorCycles;
      program.uniforms.uColorSpeed.value = colorSpeed;
      program.uniforms.uColorSaturation.value = colorSaturation;
      program.uniforms.uColorBrightness.value = colorBrightness;

      // Render
      renderer.render({ scene: mesh });
      animationFrameId.current = requestAnimationFrame(update);
    }

    animationFrameId.current = requestAnimationFrame(update);

    // Cleanup
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', resize);

      if (enableMouseInteraction) {
        container.removeEventListener('mousedown', handleMouseDown);
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('wheel', handleWheel);
      }

      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    juliaReal,
    juliaImag,
    maxIterations,
    escapeRadius,
    zoom,
    offsetX,
    offsetY,
    colorCycles,
    colorSpeed,
    colorSaturation,
    colorBrightness,
    enableMouseInteraction,
    zoomSpeed,
    setConfig,
  ]);

  // Keyboard controls for changing Julia set parameters
  useEffect(() => {
    if (!enableMouseInteraction) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const step = 0.01;
      let newJuliaReal = juliaReal;
      let newJuliaImag = juliaImag;

      switch (e.key) {
        case 'ArrowLeft':
          newJuliaReal -= step;
          break;
        case 'ArrowRight':
          newJuliaReal += step;
          break;
        case 'ArrowUp':
          newJuliaImag += step;
          break;
        case 'ArrowDown':
          newJuliaImag -= step;
          break;
        case 'r':
          // Reset view
          setConfig((prev) => ({
            ...prev,
            zoom: 1.0,
            offsetX: 0.0,
            offsetY: 0.0,
          }));
          return;
        default:
          return;
      }

      setConfig((prev) => ({
        ...prev,
        juliaReal: newJuliaReal,
        juliaImag: newJuliaImag,
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableMouseInteraction, juliaReal, juliaImag, setConfig]);

  return <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`} />;
};

export { FractalExplorer };
