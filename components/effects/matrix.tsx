'use client';

import type * as React from 'react';
import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import { atom, useAtom } from 'jotai';

export const matrixConfigAtom = atom({
  color: [0.0, 0.8, 0.4] as [number, number, number],
  speed: 1.0,
  density: 1.0,
  enableMouseInteraction: true,
});

interface MatrixProps {
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

float character(float n, vec2 p) {
  p = floor(p * vec2(4.0, 4.0) + 2.5);
  if (clamp(p.x, 0.0, 4.0) == p.x && clamp(p.y, 0.0, 4.0) == p.y) {
    if (int(mod(n / exp2(p.x + 5.0 * p.y), 2.0)) == 1) return 1.0;
  }
  return 0.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 mouse = uMouse;
  
  // Add a dark background
  vec3 bgColor = vec3(0.02, 0.03, 0.02);
  
  // Mouse influence
  float distToMouse = length(uv - mouse);
  float mouseInfluence = smoothstep(0.4, 0.0, distToMouse) * 0.5;
  
  // Time and speed
  float time = iTime * uSpeed;
  
  // Create grid for characters
  float charSize = 0.03 * (1.0 / uDensity);
  vec2 charPos = floor(uv / charSize);
  vec2 charUv = fract(uv / charSize);
  
  // Randomize character and speed for each column
  float charRandom = random(vec2(charPos.x, 0.0));
  float speed = 1.0 + charRandom * 5.0;
  
  // Calculate vertical movement
  float yOffset = mod(time * speed * 0.5, 1.0);
  float y = mod(charPos.y + yOffset, iResolution.y / (charSize * iResolution.y));
  
  // Determine character visibility and type
  float visible = step(0.65, random(vec2(charPos.x, floor(y))));
  float charType = floor(random(vec2(charPos.x, floor(y))) * 16.0);
  
  // Generate character
  float char = character(charType, charUv);
  
  // Fade characters based on y position
  float fade = smoothstep(20.0, 0.0, y) * 0.8 + 0.2;
  
  // Add mouse interaction
  fade += mouseInfluence;
  
  // Add glow effect
  float glow = char * fade;
  
  // Add subtle background
  float bg = smoothstep(0.9, 0.0, length(charUv - 0.5)) * 0.05;
  
  // Final color
  vec3 finalColor = bgColor + uColor * (glow + bg);
  
  // Add brightness variation
  finalColor *= 0.8 + 0.2 * sin(charPos.x * 0.2 + time * 0.5);
  
  // Add mouse glow
  finalColor += uColor * mouseInfluence * 0.5;
  
  // Ensure full opacity
  fragColor = vec4(finalColor, 1.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

const Matrix: React.FC<MatrixProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(null);
  const [config] = useAtom(matrixConfigAtom);
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

export { Matrix };
