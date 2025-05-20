'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import { atom, useAtom } from 'jotai';

export const crtConfigAtom = atom({
  scanlineIntensity: 0.2,
  curvature: 0.15,
  vignette: 0.3,
  flickerIntensity: 0.03,
  noiseIntensity: 0.05,
  colorShift: 0.002,
  enableMouseInteraction: true,
});

interface CRTProps {
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
uniform float uScanlineIntensity;
uniform float uCurvature;
uniform float uVignette;
uniform float uFlickerIntensity;
uniform float uNoiseIntensity;
uniform float uColorShift;
uniform vec2 uMouse;

#define PI 3.14159265359

// Random function
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// RGB shift effect
vec3 rgbShift(vec2 uv, float amount) {
  vec3 color;
  color.r = random(vec2(uv.x + amount, uv.y + iTime * 0.1));
  color.g = random(vec2(uv.x, uv.y - iTime * 0.1));
  color.b = random(vec2(uv.x - amount, uv.y));
  return color;
}

// Apply screen curvature to UVs
vec2 curveUV(vec2 uv, float curvature) {
  // Convert UV from 0-1 to -1 to 1
  vec2 cuv = uv * 2.0 - 1.0;
  
  // Apply curvature
  vec2 offset = abs(cuv.yx) / vec2(curvature);
  cuv = cuv + cuv * offset * offset;
  
  // Convert back to 0-1
  return cuv * 0.5 + 0.5;
}

// Vignette effect
float vignette(vec2 uv, float intensity) {
  uv = uv * 2.0 - 1.0;
  return 1.0 - dot(uv, uv) * intensity;
}

// Scanline effect
float scanline(vec2 uv, float intensity) {
  return 1.0 - abs(sin(uv.y * iResolution.y * 1.0)) * intensity;
}

// Noise effect
float noise(vec2 uv, float time) {
  return random(uv + time) * 2.0 - 1.0;
}

// Flicker effect
float flicker(float time, float intensity) {
  return 1.0 - random(vec2(time * 0.01, 0.0)) * intensity;
}

// Generate CRT-like content
vec3 generateContent(vec2 uv, vec2 mouse) {
  // Create a grid pattern
  vec2 grid = floor(uv * 20.0) / 20.0;
  
  // Mouse influence
  float distToMouse = length(uv - mouse);
  float mouseInfluence = smoothstep(0.4, 0.0, distToMouse);
  
  // Create some patterns
  float pattern1 = sin(uv.x * 20.0 + iTime) * cos(uv.y * 20.0 + iTime * 0.5);
  float pattern2 = sin((uv.x + uv.y) * 10.0 + iTime * 0.7);
  
  // Add mouse interaction
  pattern1 += mouseInfluence * sin(distToMouse * 30.0 - iTime * 2.0) * 0.5;
  
  // Mix patterns
  float finalPattern = mix(pattern1, pattern2, 0.5 + 0.5 * sin(iTime * 0.2));
  
  // Create color
  vec3 color = vec3(
    0.5 + 0.5 * sin(finalPattern * 3.0 + iTime),
    0.5 + 0.5 * sin(finalPattern * 3.0 + iTime + PI * 2.0/3.0),
    0.5 + 0.5 * sin(finalPattern * 3.0 + iTime + PI * 4.0/3.0)
  );
  
  // Add grid effect
  color = mix(color, vec3(random(grid + iTime * 0.1)), 0.1);
  
  return color;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // Normalized coordinates
  vec2 uv = fragCoord / iResolution.xy;
  vec2 mouse = uMouse;
  
  // Apply screen curvature
  vec2 curvedUV = curveUV(uv, 5.0 - uCurvature * 4.0);
  
  // Check if we're outside the curved screen
  if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  
  // Generate content
  vec3 color = generateContent(curvedUV, mouse);
  
  // Apply RGB shift
  vec3 rgbColor = rgbShift(curvedUV, uColorShift);
  color = mix(color, rgbColor, 0.02);
  
  // Apply scanlines
  float scanlineEffect = scanline(curvedUV, uScanlineIntensity);
  color *= scanlineEffect;
  
  // Apply vignette
  float vignetteEffect = vignette(curvedUV, uVignette);
  color *= vignetteEffect;
  
  // Apply flicker
  float flickerEffect = flicker(iTime, uFlickerIntensity);
  color *= flickerEffect;
  
  // Apply noise
  float noiseEffect = 1.0 + noise(curvedUV, iTime) * uNoiseIntensity;
  color *= noiseEffect;
  
  // Add subtle screen glow
  color += vec3(0.1, 0.1, 0.15) * (1.0 - vignetteEffect) * 0.5;
  
  // Add subtle RGB separation at edges
  float edgeDist = 1.0 - min(
    min(curvedUV.x, 1.0 - curvedUV.x),
    min(curvedUV.y, 1.0 - curvedUV.y)
  ) * 2.0;
  
  color.r += edgeDist * edgeDist * 0.3;
  color.b += edgeDist * edgeDist * 0.2;
  
  // Ensure full opacity
  fragColor = vec4(color, 1.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

const CRT: React.FC<CRTProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(null);
  const [config] = useAtom(crtConfigAtom);
  const {
    scanlineIntensity,
    curvature,
    vignette,
    flickerIntensity,
    noiseIntensity,
    colorShift,
    enableMouseInteraction,
  } = config;

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
        uScanlineIntensity: { value: scanlineIntensity },
        uCurvature: { value: curvature },
        uVignette: { value: vignette },
        uFlickerIntensity: { value: flickerIntensity },
        uNoiseIntensity: { value: noiseIntensity },
        uColorShift: { value: colorShift },
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
  }, [
    scanlineIntensity,
    curvature,
    vignette,
    flickerIntensity,
    noiseIntensity,
    colorShift,
    enableMouseInteraction,
  ]);

  return <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`} />;
};

export { CRT };
