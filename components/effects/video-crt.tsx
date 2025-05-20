'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Renderer, Program, Mesh, Triangle, Texture, Color } from 'ogl';
import { atom, useAtom } from 'jotai';

export const videoCrtConfigAtom = atom({
  staticIntensity: 0.1,
  scanlineIntensity: 0.15,
  vignette: 0, // Changed from 0.1 to 0
  curvature: 0.2,
  colorBleeding: 0.03,
  brightness: 1.2,
  contrast: 1.1,
  flickerIntensity: 0.03,
  enableMouseInteraction: true,
});

interface VideoCRTProps {
  className?: string;
  videoUrl: string;
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
uniform sampler2D tVideo;
uniform float uStaticIntensity;
uniform float uScanlineIntensity;
uniform float uVignette;
uniform float uCurvature;
uniform float uColorBleeding;
uniform float uBrightness;
uniform float uContrast;
uniform float uFlickerIntensity;
uniform vec2 uMouse;

#define PI 3.14159265359

// Random function
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
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
  // TV scanlines are horizontal (different from computer CRTs)
  float scanlineY = uv.y * iResolution.y;
  float scanline = 0.5 + 0.5 * sin(scanlineY * 1.0);
  return 1.0 - scanline * intensity;
}

// Interlacing effect
float interlace(vec2 uv, float time) {
  float line = floor(uv.y * iResolution.y);
  float oddEven = mod(line + floor(time * 10.0), 2.0);
  return 0.9 + oddEven * 0.1;
}

// Static noise - simplified to remove vertical and horizontal lines
float staticNoise(vec2 uv, float time, float intensity) {
  // Just use general noise without the structured lines
  float noise = random(uv * 100.0 + time) * intensity;
  
  // Add subtle variation to make it more natural
  float variation = random(uv * 50.0 - time * 0.5) * intensity * 0.5;
  
  return noise + variation;
}

// Color bleeding/chromatic aberration
vec3 colorBleeding(sampler2D tex, vec2 uv, float amount) {
  vec3 color;
  color.r = texture2D(tex, uv + vec2(amount, 0.0)).r;
  color.g = texture2D(tex, uv).g;
  color.b = texture2D(tex, uv - vec2(amount, 0.0)).b;
  return color;
}

// Tracking distortion (VHS-like)
vec2 trackingDistortion(vec2 uv, float time) {
  // Occasional horizontal displacement
  float trackingJump = step(0.99, sin(time * 0.3) * 0.5 + 0.5) * 0.02;
  trackingJump *= step(0.2, random(vec2(floor(time), 0.0)));
  
  // Subtle waviness
  float waviness = sin(uv.y * 20.0 + time) * 0.0005;
  
  return vec2(trackingJump + waviness, 0.0);
}

// TV frame/bezel - using a more subtle vignette-like approach
float tvFrame(vec2 uv) {
  // Create a more subtle vignette-like frame instead of hard edges
  vec2 frameUV = uv * 2.0 - 1.0;
  
  // Calculate distance from center (0,0) to current position
  float dist = length(frameUV);
  
  // Create a soft oval mask that fades out toward the edges
  float cornerFade = smoothstep(0.85, 1.0, dist);
  
  // Create frame mask (1 inside frame, 0 outside)
  float frameMask = 1.0 - cornerFade;
  
  return frameMask;
}

// Flicker effect
float flicker(float time, float intensity) {
  return 1.0 - random(vec2(time * 0.01, 0.0)) * intensity;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  // Normalized coordinates
  vec2 uv = fragCoord / iResolution.xy;
  vec2 mouse = uMouse;
  
  // Apply screen curvature
  vec2 curvedUV = curveUV(uv, 5.0 - uCurvature * 4.0);
  
  // Apply tracking distortion
  curvedUV += trackingDistortion(curvedUV, iTime);
  
  // Check if we're outside the curved screen
  if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  
  // Sample video with color bleeding
  vec3 color = colorBleeding(tVideo, curvedUV, uColorBleeding);
  
  // Apply brightness and contrast
  color = (color - 0.5) * uContrast + 0.5;
  color *= uBrightness;
  
  // Apply scanlines
  float scanlineEffect = scanline(curvedUV, uScanlineIntensity);
  color *= scanlineEffect;
  
  // Apply interlacing
  float interlaceEffect = interlace(curvedUV, iTime);
  color *= interlaceEffect;
  
  // Apply vignette
  // float vignetteEffect = vignette(curvedUV, uVignette);
  // color *= vignetteEffect;
  
  // Vignette disabled
  float vignetteEffect = 1.0; // No effect (multiplier of 1.0)
  
  // Apply flicker
  float flickerEffect = flicker(iTime, uFlickerIntensity);
  color *= flickerEffect;
  
  // Apply static noise
  float noise = staticNoise(curvedUV, iTime, uStaticIntensity);
  color += vec3(noise);
  
  // Apply TV frame/bezel
  float frame = tvFrame(uv);
  
  // Add subtle reflection on the screen (based on mouse position)
  float reflection = smoothstep(0.5, 0.0, length(curvedUV - mouse)) * 0.1;
  color += reflection * frame;
  
  // Apply frame mask (softer transition)
  color = mix(vec3(0.0), color, frame);
  
  // Ensure full opacity
  fragColor = vec4(color, 1.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}
`;

const VideoCRT: React.FC<VideoCRTProps> = ({ className = '', videoUrl }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameId = useRef<number>(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [config] = useAtom(videoCrtConfigAtom);
  const {
    staticIntensity,
    scanlineIntensity,
    vignette,
    curvature,
    colorBleeding,
    brightness,
    contrast,
    flickerIntensity,
    enableMouseInteraction,
  } = config;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Create video element
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    video.muted = false;
    video.loop = true;
    video.style.display = 'none';
    video.addEventListener('loadeddata', () => {
      setVideoLoaded(true);
      video.play().catch((err) => console.error('Error playing video:', err));
    });
    document.body.appendChild(video);
    videoRef.current = video;

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

    // Create video texture
    const texture = new Texture(gl, {
      generateMipmaps: false,
      width: 1,
      height: 1,
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
        tVideo: { value: texture },
        uStaticIntensity: { value: staticIntensity },
        uScanlineIntensity: { value: scanlineIntensity },
        uVignette: { value: vignette },
        uCurvature: { value: curvature },
        uColorBleeding: { value: colorBleeding },
        uBrightness: { value: brightness },
        uContrast: { value: contrast },
        uFlickerIntensity: { value: flickerIntensity },
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
      if (videoRef.current && videoRef.current.readyState >= 2) {
        // Update video texture
        texture.image = videoRef.current;
        texture.needsUpdate = true;
      }

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
      if (videoRef.current) {
        videoRef.current.pause();
        document.body.removeChild(videoRef.current);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    videoUrl,
    staticIntensity,
    scanlineIntensity,
    vignette,
    curvature,
    colorBleeding,
    brightness,
    contrast,
    flickerIntensity,
    enableMouseInteraction,
  ]);

  return (
    <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`}>
      {!videoLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-white text-xl">Loading video...</div>
        </div>
      )}
    </div>
  );
};

export { VideoCRT };
