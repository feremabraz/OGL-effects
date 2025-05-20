'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import { atom, useAtom } from 'jotai';

export const wavesConfigAtom = atom({
  color: [0.0, 0.4, 0.6] as [number, number, number],
  speed: 0.5,
  amplitude: 0.8,
  enableMouseInteraction: true,
});

interface WavesProps {
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
uniform float uAmplitude;
uniform vec2 uMouse;

#define PI 3.14159265359

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = random(i);
  float b = random(i + vec2(1.0, 0.0));
  float c = random(i + vec2(0.0, 1.0));
  float d = random(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 1.0;
  float freq = 1.0;
  for(int i = 0; i < 6; i++) {
    sum += amp * noise(p * freq);
    amp *= 0.5;
    freq *= 2.0;
  }
  return sum;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 mouse = uMouse;
  
  // Add a subtle background gradient for the sky
  vec3 skyColor = mix(
    vec3(0.1, 0.2, 0.4),
    vec3(0.5, 0.7, 0.9),
    uv.y
  );
  
  // Mouse influence
  float distToMouse = length(uv - mouse);
  float mouseInfluence = smoothstep(0.4, 0.0, distToMouse) * 0.5;
  
  // Time and speed
  float time = iTime * uSpeed;
  
  // Generate waves
  float y = uv.y;
  
  // Multiple wave layers
  float wave1 = sin(uv.x * 10.0 + time) * 0.02 * uAmplitude;
  float wave2 = sin(uv.x * 5.0 - time * 0.5) * 0.03 * uAmplitude;
  float wave3 = sin(uv.x * 7.5 + time * 0.7) * 0.01 * uAmplitude;
  
  // Add some noise
  float noiseVal = fbm(vec2(uv.x * 3.0, time * 0.1)) * 0.02 * uAmplitude;
  
  // Combine waves
  float waves = wave1 + wave2 + wave3 + noiseVal;
  
  // Add mouse interaction
  waves += mouseInfluence * sin(length(uv - mouse) * 20.0 - time * 2.0) * 0.05;
  
  // Create water surface
  float waterLine = 0.5 + waves;
  float water = smoothstep(waterLine + 0.01, waterLine - 0.01, y);
  
  // Add some details to the water
  float detail = fbm(vec2(uv.x * 20.0, (uv.y + time * 0.1) * 20.0)) * 0.02;
  float foam = smoothstep(waterLine + 0.03, waterLine - 0.03, y + detail) - water;
  
  // Final color
  vec3 waterColor = uColor;
  vec3 foamColor = vec3(1.0);
  vec3 finalColor = mix(waterColor, foamColor, foam * 0.7);
  
  // Add depth
  finalColor *= mix(0.6, 1.0, smoothstep(waterLine, waterLine - 0.4, y));
  
  // Combine water and sky
  finalColor = mix(skyColor, finalColor, water);
  
  // Ensure full opacity
  fragColor = vec4(finalColor, 1.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

const Waves: React.FC<WavesProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(0);
  const [config] = useAtom(wavesConfigAtom);
  const { color, speed, amplitude, enableMouseInteraction } = config;

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
        uAmplitude: { value: amplitude },
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
  }, [color, speed, amplitude, enableMouseInteraction]);

  return <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`} />;
};

export { Waves };
