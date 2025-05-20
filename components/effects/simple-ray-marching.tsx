'use client';

import type React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';
import { atom, useAtom } from 'jotai';

export const simpleRayMarchingConfigAtom = atom({
  // Performance settings
  resolution: 1.0, // Resolution scale (0.5 = half resolution)

  // Camera settings
  cameraDistance: 5.0,
  cameraHeight: 1.5,
  cameraRotationSpeed: 0.2,

  // Scene settings
  sceneComplexity: 0.5, // Reduced complexity
  animationSpeed: 0.5,

  // Visual settings
  fogDensity: 0.2,
  reflections: 0.0, // Disabled by default for performance
  shadows: 1.0,

  // Color settings
  primaryColor: [0.8, 0.2, 0.5] as [number, number, number], // Pink
  secondaryColor: [0.2, 0.5, 0.8] as [number, number, number], // Blue
  groundColor: [0.1, 0.1, 0.15] as [number, number, number], // Dark blue-gray

  // Interaction
  enableMouseInteraction: true,
});

interface SimpleRayMarchingProps {
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
uniform float uReflections;
uniform float uShadows;
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;
uniform vec3 uGroundColor;
uniform vec2 uMouse;

varying vec2 vUv;

#define PI 3.14159265359
#define MAX_STEPS 60 // Reduced from 100 for performance
#define MAX_DIST 50.0 // Reduced from 100 for performance
#define SURF_DIST 0.01

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

// Sphere SDF
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

// Box SDF
float sdBox(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

// Plane SDF
float sdPlane(vec3 p, vec3 n, float h) {
  return dot(p, n) + h;
}

// Scene SDF - simplified for performance
float sceneSDF(vec3 p) {
  // Animate time
  float time = iTime * uAnimationSpeed;
  
  // Ground plane
  float ground = sdPlane(p, vec3(0.0, 1.0, 0.0), 0.0);
  
  // Center sphere
  float sphere = sdSphere(p - vec3(0.0, 1.5 + sin(time) * 0.2, 0.0), 1.0);
  
  // Orbiting spheres - simplified, fewer spheres
  float orbitingSpheres = MAX_DIST;
  
  if (uSceneComplexity > 0.3) {
    for (int i = 0; i < 3; i++) { // Reduced from 5 to 3
      float angle = float(i) * PI * 0.6 + time;
      float radius = 3.0;
      vec3 pos = vec3(cos(angle) * radius, 1.0 + sin(time + float(i)), sin(angle) * radius);
      float size = 0.5 + 0.3 * sin(time * 0.5 + float(i));
      float orb = sdSphere(p - pos, size);
      orbitingSpheres = min(orbitingSpheres, orb);
    }
  }
  
  // Boxes - simpler than pillars
  float boxes = MAX_DIST;
  
  if (uSceneComplexity > 0.2) {
    for (int i = 0; i < 4; i++) { // Reduced from 8 to 4
      float angle = float(i) * PI * 0.5;
      float radius = 6.0;
      vec3 pos = vec3(cos(angle) * radius, 0.5, sin(angle) * radius);
      float box = sdBox(p - pos, vec3(0.5, 0.5 + sin(time * 0.2 + float(i)), 0.5));
      boxes = min(boxes, box);
    }
  }
  
  // Combine objects
  float scene = ground;
  scene = min(scene, sphere);
  scene = min(scene, orbitingSpheres);
  scene = min(scene, boxes);
  
  return scene;
}

// Calculate normal at a point - simplified for performance
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

// Ray marching function - simplified for performance
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

// Soft shadows calculation - simplified for performance
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0;
  float t = mint;
  
  for (int i = 0; i < 8; i++) { // Reduced from 16 to 8
    if (t < maxt) {
      float h = sceneSDF(ro + rd * t);
      if (h < 0.001) return 0.0;
      res = min(res, k * h / t);
      t += h;
    }
  }
  
  return res;
}

// Get material properties based on position - simplified
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

// Main rendering function - simplified for performance
vec3 render(vec3 ro, vec3 rd) {
  vec3 col = vec3(0.0);
  
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
    float ambient = 0.2; // Increased from 0.1 for better visibility
    
    // Diffuse light
    float diff = max(dot(n, lightDir), 0.0);
    
    // Specular light - simplified
    vec3 reflectDir = reflect(-lightDir, n);
    float spec = pow(max(dot(rd, reflectDir), 0.0), 16.0); // Reduced from 32 to 16
    
    // Shadows
    float shadow = 1.0;
    if (uShadows > 0.5) {
      shadow = softShadow(p + n * 0.01, lightDir, 0.1, 10.0, 8.0);
    }
    
    // Combine lighting - simplified
    col = mat * (ambient + diff * shadow) + spec * shadow * 0.3;
    
    // Reflections - simplified
    if (uReflections > 0.5) {
      // Calculate reflection ray
      vec3 reflRay = reflect(rd, n);
      
      // March along reflection ray
      float reflDist = rayMarch(p + n * 0.01, reflRay, MAX_DIST);
      
      // If reflection hits something
      if (reflDist < MAX_DIST) {
        vec3 reflPos = p + n * 0.01 + reflRay * reflDist;
        vec3 reflMat = getMaterial(reflPos);
        
        // Add reflection to color - simplified
        float reflStrength = 0.2;
        col = mix(col, reflMat, reflStrength);
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
    
    // Add stars - simplified
    vec3 rd2 = rd * 100.0;
    vec3 star = floor(rd2);
    if (fract(sin(dot(star.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453) > 0.998) {
      col += vec3(0.5);
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

const SimpleRayMarching: React.FC<SimpleRayMarchingProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(0);
  const [config, setConfig] = useAtom(simpleRayMarchingConfigAtom);
  const [fps, setFps] = useState(0);
  const fpsRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  const {
    resolution,
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

  const handleResolutionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setConfig({ ...config, resolution: Number.parseFloat(e.target.value) });
    },
    [config, setConfig]
  );

  const handleComplexityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setConfig({ ...config, sceneComplexity: Number.parseFloat(e.target.value) });
    },
    [config, setConfig]
  );

  const handleShadowsChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setConfig({ ...config, shadows: Number.parseFloat(e.target.value) });
    },
    [config, setConfig]
  );

  const handleReflectionsChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setConfig({ ...config, reflections: Number.parseFloat(e.target.value) });
    },
    [config, setConfig]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // Create renderer with scaled resolution
    const width = Math.floor(window.innerWidth * resolution);
    const height = Math.floor(window.innerHeight * resolution);

    const renderer = new Renderer({
      alpha: true,
      width,
      height,
    });

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    container.appendChild(gl.canvas);

    // Ensure the canvas fills the container regardless of resolution
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
          value: new Color(width, height, width / height),
        },
        uCameraDistance: { value: cameraDistance },
        uCameraHeight: { value: cameraHeight },
        uCameraRotationSpeed: { value: cameraRotationSpeed },
        uSceneComplexity: { value: sceneComplexity },
        uAnimationSpeed: { value: animationSpeed },
        uFogDensity: { value: fogDensity },
        uReflections: { value: reflections },
        uShadows: { value: shadows },
        uPrimaryColor: { value: new Color(...primaryColor) },
        uSecondaryColor: { value: new Color(...secondaryColor) },
        uGroundColor: { value: new Color(...groundColor) },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
      },
    });

    // Create mesh
    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      const newWidth = Math.floor(window.innerWidth * resolution);
      const newHeight = Math.floor(window.innerHeight * resolution);
      renderer.setSize(newWidth, newHeight);
      program.uniforms.iResolution.value.set(newWidth, newHeight, newWidth / newHeight);
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
      if (lastFrameTimeRef.current) {
        const frameTime = t - lastFrameTimeRef.current;
        const currentFps = 1000 / frameTime;

        // Store last 10 FPS values for averaging
        fpsRef.current.push(currentFps);
        if (fpsRef.current.length > 10) {
          fpsRef.current.shift();
        }

        // Update FPS display every 10 frames
        if (t % 10 < 1) {
          const avgFps = fpsRef.current.reduce((sum, fps) => sum + fps, 0) / fpsRef.current.length;
          setFps(Math.round(avgFps));
        }
      }
      lastFrameTimeRef.current = t;

      // Update uniforms
      program.uniforms.iTime.value = t * 0.001;

      if (enableMouseInteraction) {
        const smoothing = 0.05;
        currentMouse[0] += smoothing * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += smoothing * (targetMouse[1] - currentMouse[1]);
        program.uniforms.uMouse.value[0] = currentMouse[0];
        program.uniforms.uMouse.value[1] = currentMouse[1];
      }

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
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
      }

      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    resolution,
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
    setConfig,
  ]);

  return (
    <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`}>
      {/* FPS Counter */}
      <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
        {fps} FPS
      </div>

      {/* Performance Controls */}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-3 rounded">
        <h3 className="text-sm font-bold mb-2">Performance Settings</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs">Resolution:</label>
            <select
              className="bg-black/70 text-white text-xs p-1 rounded"
              value={resolution}
              onChange={handleResolutionChange}
            >
              <option value="0.25">25%</option>
              <option value="0.5">50%</option>
              <option value="0.75">75%</option>
              <option value="1">100%</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs">Complexity:</label>
            <select
              className="bg-black/70 text-white text-xs p-1 rounded"
              value={sceneComplexity}
              onChange={handleComplexityChange}
            >
              <option value="0">Minimal</option>
              <option value="0.25">Low</option>
              <option value="0.5">Medium</option>
              <option value="1">High</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs">Shadows:</label>
            <select
              className="bg-black/70 text-white text-xs p-1 rounded"
              value={shadows}
              onChange={handleShadowsChange}
            >
              <option value="0">Off</option>
              <option value="1">On</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs">Reflections:</label>
            <select
              className="bg-black/70 text-white text-xs p-1 rounded"
              value={reflections}
              onChange={handleReflectionsChange}
            >
              <option value="0">Off</option>
              <option value="1">On</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export { SimpleRayMarching };
