'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import { atom, useAtom } from 'jotai';

export const rayMarchingConfigAtom = atom({
  // Camera settings
  cameraDistance: 5.0,
  cameraHeight: 1.5,
  cameraRotationSpeed: 0.2,

  // Scene settings
  sceneComplexity: 1.0, // Controls number of objects
  animationSpeed: 0.5,

  // Visual settings
  fogDensity: 0.15,
  reflections: 1.0, // Changed from boolean to number
  shadows: 1.0, // Changed from boolean to number

  // Color settings
  primaryColor: [0.8, 0.2, 0.5] as [number, number, number], // Pink
  secondaryColor: [0.2, 0.5, 0.8] as [number, number, number], // Blue
  groundColor: [0.1, 0.1, 0.15] as [number, number, number], // Dark blue-gray

  // Interaction
  enableMouseInteraction: true,
});

interface RayMarchingProps {
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
uniform float uCameraDistance;
uniform float uCameraHeight;
uniform float uCameraRotationSpeed;
uniform float uSceneComplexity;
uniform float uAnimationSpeed;
uniform float uFogDensity;
uniform float uReflections; // Changed from bool to float
uniform float uShadows; // Changed from bool to float
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;
uniform vec3 uGroundColor;
uniform vec2 uMouse;

varying vec2 vUv;

#define PI 3.14159265359
#define MAX_STEPS 100
#define MAX_DIST 100.0
#define SURF_DIST 0.01
#define MAX_BOUNCES 2

// Rotation matrix around the Y axis
mat3 rotateY(float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return mat3(
    c, 0, s,
    0, 1, 0,
    -s, 0, c
  );
}

// Rotation matrix around the X axis
mat3 rotateX(float theta) {
  float c = cos(theta);
  float s = sin(theta);
  return mat3(
    1, 0, 0,
    0, c, -s,
    0, s, c
  );
}

// Smooth minimum function for soft blending of shapes
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Signed distance functions for various shapes

// Sphere SDF
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

// Box SDF
float sdBox(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

// Torus SDF
float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

// Cylinder SDF
float sdCylinder(vec3 p, vec3 c) {
  return length(p.xz - c.xy) - c.z;
}

// Plane SDF
float sdPlane(vec3 p, vec3 n, float h) {
  return dot(p, n) + h;
}

// Scene SDF - combines all objects
float sceneSDF(vec3 p) {
  // Animate time
  float time = iTime * uAnimationSpeed;
  
  // Ground plane
  float ground = sdPlane(p, vec3(0.0, 1.0, 0.0), 0.0);
  
  // Center sphere
  float sphere = sdSphere(p - vec3(0.0, 1.5 + sin(time) * 0.2, 0.0), 1.0);
  
  // Rotating torus
  vec3 torusPos = p;
  torusPos = rotateY(time * 0.5) * torusPos;
  torusPos = rotateX(time * 0.3) * torusPos;
  float torus = sdTorus(torusPos - vec3(0.0, 1.5, 0.0), vec2(2.0, 0.5));
  
  // Orbiting spheres
  float orbitingSpheres = MAX_DIST;
  
  if (uSceneComplexity > 0.5) {
    for (int i = 0; i < 5; i++) {
      float angle = float(i) * PI * 0.4 + time;
      float radius = 3.0;
      vec3 pos = vec3(cos(angle) * radius, 1.0 + sin(time + float(i)), sin(angle) * radius);
      float size = 0.5 + 0.3 * sin(time * 0.5 + float(i));
      float orb = sdSphere(p - pos, size);
      orbitingSpheres = min(orbitingSpheres, orb);
    }
  }
  
  // Pillars
  float pillars = MAX_DIST;
  
  if (uSceneComplexity > 0.2) {
    for (int i = 0; i < 8; i++) {
      float angle = float(i) * PI * 0.25;
      float radius = 6.0;
      vec3 pos = vec3(cos(angle) * radius, 0.0, sin(angle) * radius);
      float height = 3.0 + sin(time * 0.2 + float(i)) * 1.0;
      float pillar = sdCylinder(p - pos, vec3(0.0, 0.0, 0.5));
      pillar = max(pillar, -sdBox(p - vec3(pos.x, height, pos.z), vec3(0.6, 10.0, 0.6)));
      pillars = min(pillars, pillar);
    }
  }
  
  // Combine objects with smooth blending
  float scene = ground;
  scene = min(scene, sphere);
  scene = min(scene, torus);
  scene = min(scene, orbitingSpheres);
  scene = min(scene, pillars);
  
  return scene;
}

// Calculate normal at a point
vec3 getNormal(vec3 p) {
  float d = sceneSDF(p);
  vec2 e = vec2(0.01, 0.0);
  
  vec3 n = d - vec3(
    sceneSDF(p - e.xyy),
    sceneSDF(p - e.yxy),
    sceneSDF(p - e.yyx)
  );
  
  return normalize(n);
}

// Ray marching function
float rayMarch(vec3 ro, vec3 rd, float maxDist) {
  float dO = 0.0;
  
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * dO;
    float dS = sceneSDF(p);
    dO += dS;
    if (dO > maxDist || dS < SURF_DIST) break;
  }
  
  return dO;
}

// Soft shadows calculation
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0;
  float t = mint;
  
  for (int i = 0; i < 16; i++) {
    if (t < maxt) {
      float h = sceneSDF(ro + rd * t);
      if (h < 0.001) return 0.0;
      res = min(res, k * h / t);
      t += h;
    }
  }
  
  return res;
}

// Calculate ambient occlusion
float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  
  for (int i = 0; i < 5; i++) {
    float h = 0.01 + 0.12 * float(i) / 4.0;
    float d = sceneSDF(p + h * n);
    occ += (h - d) * sca;
    sca *= 0.95;
  }
  
  return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}

// Get material properties based on position
vec3 getMaterial(vec3 p) {
  // Ground plane has a grid pattern
  if (abs(p.y) < 0.01) {
    // Create grid pattern
    float grid = 0.0;
    float gridSize = 1.0;
    
    // Major grid lines
    grid += 1.0 - smoothstep(0.02, 0.05, abs(mod(p.x, gridSize) - gridSize * 0.5));
    grid += 1.0 - smoothstep(0.02, 0.05, abs(mod(p.z, gridSize) - gridSize * 0.5));
    
    // Fade grid with distance
    float dist = length(p.xz);
    grid *= smoothstep(20.0, 5.0, dist);
    
    // Mix ground color with grid
    return mix(uGroundColor, uSecondaryColor * 0.5, grid * 0.5);
  }
  
  // For other objects, use a position-based color
  float t = 0.5 + 0.5 * sin(p.y * 0.5 + iTime * 0.3);
  return mix(uPrimaryColor, uSecondaryColor, t);
}

// Main rendering function
vec3 render(vec3 ro, vec3 rd) {
  vec3 col = vec3(0.0);
  vec3 accum = vec3(1.0); // Accumulated color for reflections
  
  // Initial ray
  float d = rayMarch(ro, rd, MAX_DIST);
  
  // If we hit something
  if (d < MAX_DIST) {
    vec3 p = ro + rd * d;
    vec3 n = getNormal(p);
    
    // Material properties
    vec3 mat = getMaterial(p);
    
    // Lighting
    vec3 lightPos = vec3(5.0, 10.0, -5.0);
    vec3 lightDir = normalize(lightPos - p);
    
    // Ambient light
    float ambient = 0.1;
    
    // Diffuse light
    float diff = max(dot(n, lightDir), 0.0);
    
    // Specular light
    vec3 reflectDir = reflect(-lightDir, n);
    float spec = pow(max(dot(rd, reflectDir), 0.0), 32.0);
    
    // Shadows
    float shadow = 1.0;
    if (uShadows > 0.5) { // Changed from boolean to float comparison
      shadow = softShadow(p + n * 0.01, lightDir, 0.1, 10.0, 8.0);
    }
    
    // Ambient occlusion
    float ao = calcAO(p, n);
    
    // Combine lighting
    col = mat * (ambient + diff * shadow) + spec * shadow * 0.5;
    col *= ao;
    
    // Reflections
    if (uReflections > 0.5) { // Changed from boolean to float comparison
      // Calculate reflection ray
      vec3 reflRay = reflect(rd, n);
      
      // March along reflection ray
      float reflDist = rayMarch(p + n * 0.01, reflRay, MAX_DIST);
      
      // If reflection hits something
      if (reflDist < MAX_DIST) {
        vec3 reflPos = p + n * 0.01 + reflRay * reflDist;
        vec3 reflNorm = getNormal(reflPos);
        vec3 reflMat = getMaterial(reflPos);
        
        // Simple lighting for reflection
        float reflDiff = max(dot(reflNorm, lightDir), 0.0);
        float reflShadow = 1.0;
        if (uShadows > 0.5) { // Changed from boolean to float comparison
          reflShadow = softShadow(reflPos + reflNorm * 0.01, lightDir, 0.1, 10.0, 8.0);
        }
        
        // Add reflection to color
        float reflStrength = 0.3 * (1.0 - dot(n, -rd)); // Fresnel-like effect
        col = mix(col, reflMat * reflDiff * reflShadow, reflStrength);
      }
    }
    
    // Fog
    float fogAmount = 1.0 - exp(-d * uFogDensity);
    vec3 fogColor = vec3(0.05, 0.05, 0.1); // Dark blue fog
    col = mix(col, fogColor, fogAmount);
  } else {
    // Sky gradient if no hit
    float t = 0.5 * (rd.y + 1.0);
    col = mix(vec3(0.1, 0.1, 0.2), vec3(0.02, 0.02, 0.05), t);
    
    // Add stars
    vec3 rd2 = rd * 100.0;
    vec3 star = floor(rd2);
    if (fract(sin(dot(star.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453) > 0.997) {
      float starIntensity = fract(sin(dot(star.xyz, vec3(19.9898, 78.233, 45.164))) * 43758.5453);
      col += vec3(starIntensity) * 0.5;
    }
  }
  
  return col;
}

void main() {
  // Normalized coordinates
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= iResolution.x / iResolution.y; // Correct for aspect ratio
  
  // Camera setup
  float time = iTime * uCameraRotationSpeed;
  
  // Mouse influence on camera
  float mouseX = uMouse.x * 2.0 - 1.0;
  float mouseY = uMouse.y * 2.0 - 1.0;
  
  // Camera position
  vec3 ro = vec3(
    cos(time + mouseX * 2.0) * uCameraDistance,
    uCameraHeight + mouseY * 1.0,
    sin(time + mouseX * 2.0) * uCameraDistance
  );
  
  // Look at center
  vec3 lookAt = vec3(0.0, 1.0, 0.0);
  
  // Camera frame
  vec3 forward = normalize(lookAt - ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  
  // Ray direction
  vec3 rd = normalize(forward + uv.x * right + uv.y * up);
  
  // Render scene
  vec3 col = render(ro, rd);
  
  // Tone mapping
  col = col / (1.0 + col);
  
  // Gamma correction
  col = pow(col, vec3(0.4545));
  
  gl_FragColor = vec4(col, 1.0);
}
`;

const RayMarching: React.FC<RayMarchingProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(0);
  const [config] = useAtom(rayMarchingConfigAtom);
  const {
    cameraDistance,
    cameraHeight,
    cameraRotationSpeed,
    sceneComplexity,
    animationSpeed,
    fogDensity,
    reflections,
    shadows,
    primaryColor,
    secondaryColor,
    groundColor,
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

    // Create program with all uniforms initialized
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
        uCameraDistance: { value: cameraDistance },
        uCameraHeight: { value: cameraHeight },
        uCameraRotationSpeed: { value: cameraRotationSpeed },
        uSceneComplexity: { value: sceneComplexity },
        uAnimationSpeed: { value: animationSpeed },
        uFogDensity: { value: fogDensity },
        uReflections: { value: reflections }, // Now using float instead of boolean
        uShadows: { value: shadows }, // Now using float instead of boolean
        uPrimaryColor: { value: new Color(...primaryColor) },
        uSecondaryColor: { value: new Color(...secondaryColor) },
        uGroundColor: { value: new Color(...groundColor) },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
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

    // Animation loop
    function update(t: number) {
      // Update uniforms
      program.uniforms.iTime.value = t * 0.001;

      // Ensure all uniforms are properly updated
      if (enableMouseInteraction) {
        const smoothing = 0.05;
        currentMouse[0] += smoothing * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += smoothing * (targetMouse[1] - currentMouse[1]);
        program.uniforms.uMouse.value[0] = currentMouse[0];
        program.uniforms.uMouse.value[1] = currentMouse[1];
      }

      // Render - simplified to avoid potential issues
      renderer.render({ scene: mesh });
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
    cameraDistance,
    cameraHeight,
    cameraRotationSpeed,
    sceneComplexity,
    animationSpeed,
    fogDensity,
    reflections,
    shadows,
    primaryColor,
    secondaryColor,
    groundColor,
    enableMouseInteraction,
  ]);

  return <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`} />;
};

export { RayMarching };
