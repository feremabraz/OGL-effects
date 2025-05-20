'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import { atom, useAtom } from 'jotai';

export const starfieldConfigAtom = atom({
  color: [0.9, 0.9, 1.0] as [number, number, number],
  speed: 0.5,
  density: 1.0,
  enableMouseInteraction: true,
});

interface StarfieldProps {
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
uniform vec3 uColor;
uniform float uSpeed;
uniform float uDensity;
uniform vec2 uMouse;

#define PI 3.14159265359

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float star(vec2 uv, float flare) {
  float d = length(uv);
  float m = 0.05 / d;
  
  float rays = max(0.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare;
  
  // Add circular glow
  float glow = 0.01 / d;
  m += glow * 0.3;
  
  return m;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // Use normalized coordinates that fill the entire screen
  vec2 uv = fragCoord / iResolution.xy;
  
  // Convert to centered coordinates for star calculations
  vec2 centeredUv = (uv - 0.5) * 2.0;
  // Adjust for aspect ratio
  centeredUv.x *= iResolution.x / iResolution.y;
  
  vec2 mouse = uMouse * 2.0 - 1.0;
  
  // Add a deep space background
  vec3 bgColor = vec3(0.02, 0.02, 0.05);
  vec3 color = bgColor;
  
  // Time and speed
  float time = iTime * uSpeed;
  
  // Parallax layers
  for (int i = 0; i < 3; i++) {
    float depth = float(i) * 0.2 + 0.1;
    float scale = mix(15.0, 5.0, depth) * uDensity;
    float speed = mix(0.01, 0.05, depth) * uSpeed;
    
    // Create grid for stars
    vec2 gridUv = centeredUv * scale;
    
    // Add mouse parallax
    gridUv += mouse * depth * 0.1;
    
    // Add time movement
    gridUv.y += time * speed;
    
    vec2 grid = fract(gridUv) - 0.5;
    vec2 id = floor(gridUv);
    
    // Random star brightness and size
    float cellRandom = random(id);
    
    // Only render some stars based on random value
    if (cellRandom > 0.94) {
      // Twinkle effect
      float twinkle = sin(time * 5.0 * cellRandom) * 0.5 + 0.5;
      
      // Star brightness
      float brightness = cellRandom * twinkle;
      
      // Star size based on random value
      float starSize = mix(0.05, 0.01, cellRandom);
      
      // Calculate star
      float d = length(grid);
      float starValue = 0.0;
      
      if (d < starSize) {
        // Core of the star
        starValue = smoothstep(starSize, 0.0, d);
        
        // Add flare
        float flare = mix(0.0, 1.0, brightness);
        starValue += star(grid, flare) * brightness;
      }
      
      // Add star to the scene with depth-based brightness
      color += uColor * starValue * brightness * mix(0.5, 1.0, depth);
    }
  }
  
  // Add subtle background nebula
  vec2 nebulaUv = centeredUv + mouse * 0.1;
  float nebula = random(nebulaUv * 0.5 + time * 0.01) * random(nebulaUv * 0.7 - time * 0.015);
  nebula = pow(nebula, 8.0) * 0.2;
  
  // Add colored nebula
  vec3 nebulaColor = mix(
    vec3(0.1, 0.2, 0.5),
    vec3(0.5, 0.1, 0.2),
    random(nebulaUv)
  );
  
  color += nebulaColor * nebula;
  
  // Ensure full opacity
  fragColor = vec4(color, 1.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

const Starfield: React.FC<StarfieldProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(0);
  const [config] = useAtom(starfieldConfigAtom);
  const { color, speed, density, enableMouseInteraction } = config;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Create renderer with explicit size
    const renderer = new Renderer({
      alpha: true,
      width: window.innerWidth,
      height: window.innerHeight,
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
        uColor: { value: new Color(...color) },
        uSpeed: { value: speed },
        uDensity: { value: density },
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
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [color, speed, density, enableMouseInteraction]);

  return <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`} />;
};

export { Starfield };
