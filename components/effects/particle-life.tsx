'use client';

import type * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Renderer, Program, Mesh, Triangle, Color, RenderTarget, Texture } from 'ogl';
import { atom, useAtom } from 'jotai';

export const particleLifeConfigAtom = atom({
  // Simulation settings
  particleCount: 1000,
  particleTypes: 5,
  attractionMatrix: [] as number[][],
  minDistance: 20,
  maxDistance: 80,
  forceFactor: 0.2,
  friction: 0.05,
  wrapEdges: true,

  // Visual settings
  particleSize: 3.0,
  trailIntensity: 0.8,
  colorMode: 'type', // "type", "velocity", "age"

  // Interaction
  enableMouseInteraction: true,
  mouseRadius: 100,
  mouseForce: 0.5,
});

interface ParticleLifeProps {
  className?: string;
}

// Vertex shader for particles
const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// Fragment shader for simulation
const simulationShader = `
precision highp float;

uniform sampler2D tPositions;
uniform sampler2D tVelocities;
uniform sampler2D tTypes;
uniform float iTime;
uniform vec3 iResolution;
uniform float uMinDistance;
uniform float uMaxDistance;
uniform float uForceFactor;
uniform float uFriction;
uniform bool uWrapEdges;
uniform vec2 uMouse;
uniform float uMouseRadius;
uniform float uMouseForce;
uniform bool uMouseDown;
uniform sampler2D uAttractionMatrix;
uniform int uParticleTypes;

varying vec2 vUv;

// Random function
float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  // Get current particle data
  vec4 position = texture2D(tPositions, vUv);
  vec4 velocity = texture2D(tVelocities, vUv);
  vec4 typeInfo = texture2D(tTypes, vUv);
  
  // Extract particle type (0-4)
  int particleType = int(typeInfo.r * 255.0);
  
  // Calculate forces from other particles
  vec2 totalForce = vec2(0.0);
  
  // Screen dimensions
  float width = iResolution.x;
  float height = iResolution.y;
  
  // Number of particles to sample (for performance)
  const int SAMPLE_COUNT = 20;
  
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    // Sample a random particle
    float randomU = random(vUv + vec2(float(i) * 0.01, iTime * 0.001));
    float randomV = random(vUv + vec2(iTime * 0.001, float(i) * 0.01));
    vec2 sampleUV = vec2(randomU, randomV);
    
    // Get other particle data
    vec4 otherPosition = texture2D(tPositions, sampleUV);
    vec4 otherTypeInfo = texture2D(tTypes, sampleUV);
    
    // Skip if same particle
    if (distance(position.xy, otherPosition.xy) < 0.001) continue;
    
    // Calculate distance between particles
    vec2 diff = otherPosition.xy - position.xy;
    
    // Handle edge wrapping
    if (uWrapEdges) {
      if (abs(diff.x) > width * 0.5) diff.x = diff.x - sign(diff.x) * width;
      if (abs(diff.y) > height * 0.5) diff.y = diff.y - sign(diff.y) * height;
    }
    
    float dist = length(diff);
    
    // Apply force if within range
    if (dist > 0.0 && dist < uMaxDistance) {
      // Normalize direction
      vec2 direction = normalize(diff);
      
      // Get other particle type
      int otherType = int(otherTypeInfo.r * 255.0);
      
      // Look up attraction value from matrix
      vec2 matrixCoord = vec2(
        (float(particleType) + 0.5) / float(uParticleTypes),
        (float(otherType) + 0.5) / float(uParticleTypes)
      );
      float attraction = texture2D(uAttractionMatrix, matrixCoord).r * 2.0 - 1.0;
      
      // Calculate force based on distance
      float forceMagnitude = 0.0;
      
      if (dist < uMinDistance) {
        // Strong repulsion at very close distances (regardless of type)
        forceMagnitude = -1.0;
      } else {
        // Attraction or repulsion based on types
        float normalizedDist = (dist - uMinDistance) / (uMaxDistance - uMinDistance);
        forceMagnitude = attraction * (1.0 - normalizedDist);
      }
      
      // Add to total force
      totalForce += direction * forceMagnitude * uForceFactor;
    }
  }
  
  // Apply mouse interaction
  if (uMouseDown) {
    vec2 mousePos = uMouse * iResolution.xy;
    vec2 toMouse = mousePos - position.xy;
    
    // Handle edge wrapping for mouse too
    if (uWrapEdges) {
      if (abs(toMouse.x) > width * 0.5) toMouse.x = toMouse.x - sign(toMouse.x) * width;
      if (abs(toMouse.y) > height * 0.5) toMouse.y = toMouse.y - sign(toMouse.y) * height;
    }
    
    float mouseDistance = length(toMouse);
    
    if (mouseDistance < uMouseRadius) {
      vec2 mouseDirection = normalize(toMouse);
      float mouseForce = (1.0 - mouseDistance / uMouseRadius) * uMouseForce;
      totalForce += mouseDirection * mouseForce;
    }
  }
  
  // Update velocity
  vec2 newVelocity = velocity.xy * (1.0 - uFriction) + totalForce;
  
  // Limit maximum velocity
  float maxVel = 5.0;
  float velLength = length(newVelocity);
  if (velLength > maxVel) {
    newVelocity = newVelocity * (maxVel / velLength);
  }
  
  // Update position
  vec2 newPosition = position.xy + newVelocity;
  
  // Handle edge wrapping
  if (uWrapEdges) {
    if (newPosition.x < 0.0) newPosition.x += width;
    if (newPosition.x > width) newPosition.x -= width;
    if (newPosition.y < 0.0) newPosition.y += height;
    if (newPosition.y > height) newPosition.y -= height;
  } else {
    // Bounce off edges
    if (newPosition.x < 0.0 || newPosition.x > width) {
      newVelocity.x = -newVelocity.x * 0.8;
      newPosition.x = clamp(newPosition.x, 0.0, width);
    }
    if (newPosition.y < 0.0 || newPosition.y > height) {
      newVelocity.y = -newVelocity.y * 0.8;
      newPosition.y = clamp(newPosition.y, 0.0, height);
    }
  }
  
  // Output updated position and velocity
  if (gl_FragCoord.x < iResolution.x * 0.5) {
    // Left half of the render target: update positions
    gl_FragColor = vec4(newPosition, position.zw);
  } else {
    // Right half of the render target: update velocities
    gl_FragColor = vec4(newVelocity, velocity.zw);
  }
}
`;

// Fragment shader for rendering
const renderShader = `
precision highp float;

uniform sampler2D tPositions;
uniform sampler2D tVelocities;
uniform sampler2D tTypes;
uniform sampler2D tPrevFrame;
uniform float iTime;
uniform vec3 iResolution;
uniform float uParticleSize;
uniform float uTrailIntensity;
uniform int uColorMode; // 0: type, 1: velocity, 2: age

varying vec2 vUv;

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  // Get previous frame
  vec4 prevFrame = texture2D(tPrevFrame, vUv);
  
  // Fade previous frame for trail effect
  vec3 color = prevFrame.rgb * uTrailIntensity;
  
  // Screen coordinates
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  
  // Number of particles to render
  const int PARTICLE_COUNT = 1000;
  
  // Render particles
  for (int i = 0; i < PARTICLE_COUNT; i++) {
    // Calculate texture coordinate for this particle
    float y = (float(i) + 0.5) / float(PARTICLE_COUNT);
    
    // Get particle data
    vec4 position = texture2D(tPositions, vec2(0.25, y));
    vec4 velocity = texture2D(tVelocities, vec2(0.75, y));
    vec4 typeInfo = texture2D(tTypes, vec2(0.25, y));
    
    // Skip if we've rendered all particles
    if (position.x < 0.0) break;
    
    // Calculate distance to particle
    vec2 particlePos = position.xy / iResolution.xy;
    float dist = distance(uv, particlePos) * iResolution.x;
    
    // Render particle if close enough
    if (dist < uParticleSize) {
      // Get particle type
      float particleType = typeInfo.r;
      
      // Calculate particle color based on mode
      vec3 particleColor;
      
      if (uColorMode == 0) {
        // Color by type
        float hue = particleType;
        particleColor = hsv2rgb(vec3(hue, 0.8, 1.0));
      } else if (uColorMode == 1) {
        // Color by velocity
        float speed = length(velocity.xy) / 5.0; // Normalize
        float hue = 0.7 - speed * 0.5; // Blue to red
        particleColor = hsv2rgb(vec3(hue, 0.8, 1.0));
      } else {
        // Color by age
        float age = typeInfo.g;
        float hue = fract(age * 0.1 + iTime * 0.05);
        particleColor = hsv2rgb(vec3(hue, 0.7, 1.0));
      }
      
      // Smooth particle edge
      float alpha = 1.0 - smoothstep(uParticleSize * 0.5, uParticleSize, dist);
      
      // Add to color
      color = mix(color, particleColor, alpha);
    }
  }
  
  // Output final color
  gl_FragColor = vec4(color, 1.0);
}
`;

const ParticleLife: React.FC<ParticleLifeProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number>(0);
  const mouseDownRef = useRef(false);
  const [config, setConfig] = useAtom(particleLifeConfigAtom);
  const [colorMode, setColorMode] = useState<string>(config.colorMode);
  const [wrapEdges, setWrapEdges] = useState<boolean>(config.wrapEdges);
  const [attractionPreset, setAttractionPreset] = useState<string>('random');

  const {
    particleCount,
    particleTypes,
    minDistance,
    maxDistance,
    forceFactor,
    friction,
    particleSize,
    trailIntensity,
    enableMouseInteraction,
    mouseRadius,
    mouseForce,
  } = config;

  // Generate attraction matrix if empty
  useEffect(() => {
    if (config.attractionMatrix.length === 0) {
      generateAttractionMatrix('random');
    }
  }, [config]);

  // Generate attraction matrix based on preset
  const generateAttractionMatrix = useCallback(
    (preset: string) => {
      const matrix: number[][] = [];

      for (let i = 0; i < particleTypes; i++) {
        matrix[i] = [];
        for (let j = 0; j < particleTypes; j++) {
          let value = 0;

          if (preset === 'random') {
            // Random values between -1 and 1
            value = Math.random() * 2 - 1;
          } else if (preset === 'clusters') {
            // Same types attract, different types repel
            value = i === j ? 0.8 : -0.5;
          } else if (preset === 'mix') {
            // Complex mixing behavior
            value = Math.sin((i * j + 1) * 0.5) * 0.8;
          } else if (preset === 'chaos') {
            // Strong attractions and repulsions
            value = Math.random() > 0.5 ? 1 : -1;
          } else if (preset === 'balanced') {
            // Balanced ecosystem
            const diff = Math.abs(i - j);
            value = diff === 1 || diff === particleTypes - 1 ? 0.7 : -0.3;
          }

          matrix[i][j] = value;
        }
      }

      setAttractionPreset(preset);
      setConfig({ ...config, attractionMatrix: matrix });
    },
    [particleTypes, setConfig, config]
  );

  // Handle color mode change
  const handleColorModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newMode = e.target.value;
      setColorMode(newMode);
      setConfig({ ...config, colorMode: newMode });
    },
    [config, setConfig]
  );

  // Handle wrap edges change
  const handleWrapEdgesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.checked;
      setWrapEdges(newValue);
      setConfig({ ...config, wrapEdges: newValue });
    },
    [config, setConfig]
  );

  // Handle attraction preset change
  const handleAttractionPresetChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      generateAttractionMatrix(e.target.value);
    },
    [generateAttractionMatrix]
  );

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

    // Create geometry for full-screen quad
    const geometry = new Triangle(gl);

    // Create data textures
    const createDataTexture = (size: number, fillFunc: (i: number) => number[]) => {
      const data = new Float32Array(size * 4);
      for (let i = 0; i < size; i++) {
        const values = fillFunc(i);
        data[i * 4] = values[0];
        data[i * 4 + 1] = values[1];
        data[i * 4 + 2] = values[2];
        data[i * 4 + 3] = values[3];
      }
      return data;
    };

    // Initialize particle positions
    const positionData = createDataTexture(particleCount, () => {
      return [Math.random() * window.innerWidth, Math.random() * window.innerHeight, 0, 1];
    });

    // Initialize particle velocities
    const velocityData = createDataTexture(particleCount, () => {
      return [(Math.random() * 2 - 1) * 0.5, (Math.random() * 2 - 1) * 0.5, 0, 0];
    });

    // Initialize particle types
    const typeData = createDataTexture(particleCount, () => {
      return [
        Math.floor(Math.random() * particleTypes) / 255, // Type (0-4)
        Math.random(), // Age
        0,
        1,
      ];
    });

    // Create attraction matrix texture
    const attractionMatrixData = new Float32Array(particleTypes * particleTypes * 4);
    for (let i = 0; i < particleTypes; i++) {
      for (let j = 0; j < particleTypes; j++) {
        const idx = (i * particleTypes + j) * 4;
        const value = (config.attractionMatrix[i]?.[j] ?? 0) * 0.5 + 0.5; // Convert from [-1,1] to [0,1]
        attractionMatrixData[idx] = value;
        attractionMatrixData[idx + 1] = value;
        attractionMatrixData[idx + 2] = value;
        attractionMatrixData[idx + 3] = 1;
      }
    }

    // Create textures
    const positionTexture = new Texture(gl, {
      image: positionData,
      width: particleCount,
      height: 1,
      type: gl.FLOAT,
      format: gl.RGBA,
      internalFormat: gl.renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
    });

    const velocityTexture = new Texture(gl, {
      image: velocityData,
      width: particleCount,
      height: 1,
      type: gl.FLOAT,
      format: gl.RGBA,
      internalFormat: gl.renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
    });

    const typeTexture = new Texture(gl, {
      image: typeData,
      width: particleCount,
      height: 1,
      type: gl.FLOAT,
      format: gl.RGBA,
      internalFormat: gl.renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
    });

    const attractionMatrixTexture = new Texture(gl, {
      image: attractionMatrixData,
      width: particleTypes,
      height: particleTypes,
      type: gl.FLOAT,
      format: gl.RGBA,
      internalFormat: gl.renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
    });

    // Create render targets for ping-pong rendering
    const simulationTarget = new RenderTarget(gl, {
      width: particleCount,
      height: 1,
      type: gl.FLOAT,
      format: gl.RGBA,
      internalFormat: gl.renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      depth: false,
    });

    const renderTargets = [
      new RenderTarget(gl, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
      new RenderTarget(gl, {
        width: window.innerWidth,
        height: window.innerHeight,
      }),
    ];
    let currentRenderTarget = 0;

    // Create simulation program
    const simulationProgram = new Program(gl, {
      vertex: vertexShader,
      fragment: simulationShader,
      uniforms: {
        tPositions: { value: positionTexture },
        tVelocities: { value: velocityTexture },
        tTypes: { value: typeTexture },
        iTime: { value: 0 },
        iResolution: { value: new Color(particleCount, 1, particleCount) },
        uMinDistance: { value: minDistance },
        uMaxDistance: { value: maxDistance },
        uForceFactor: { value: forceFactor },
        uFriction: { value: friction },
        uWrapEdges: { value: wrapEdges },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uMouseRadius: { value: mouseRadius },
        uMouseForce: { value: mouseForce },
        uMouseDown: { value: false },
        uAttractionMatrix: { value: attractionMatrixTexture },
        uParticleTypes: { value: particleTypes },
      },
    });

    // Create render program
    const renderProgram = new Program(gl, {
      vertex: vertexShader,
      fragment: renderShader,
      uniforms: {
        tPositions: { value: positionTexture },
        tVelocities: { value: velocityTexture },
        tTypes: { value: typeTexture },
        tPrevFrame: { value: renderTargets[1 - currentRenderTarget].texture },
        iTime: { value: 0 },
        iResolution: {
          value: new Color(
            window.innerWidth,
            window.innerHeight,
            window.innerWidth / window.innerHeight
          ),
        },
        uParticleSize: { value: particleSize },
        uTrailIntensity: { value: trailIntensity },
        uColorMode: { value: colorMode === 'type' ? 0 : colorMode === 'velocity' ? 1 : 2 },
      },
    });

    // Create meshes
    const simulationMesh = new Mesh(gl, { geometry, program: simulationProgram });
    const renderMesh = new Mesh(gl, { geometry, program: renderProgram });

    function resize() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);

      // Resize render targets
      renderTargets[0].setSize(width, height);
      renderTargets[1].setSize(width, height);

      // Update resolution uniform
      renderProgram.uniforms.iResolution.value.set(width, height, width / height);
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
      simulationProgram.uniforms.uMouseDown.value = true;
    }

    function handleMouseUp() {
      mouseDownRef.current = false;
      simulationProgram.uniforms.uMouseDown.value = false;
    }

    function handleMouseLeave() {
      mouseDownRef.current = false;
      simulationProgram.uniforms.uMouseDown.value = false;
      targetMouse = [0.5, 0.5];
    }

    if (enableMouseInteraction) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mousedown', handleMouseDown);
      container.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('mouseleave', handleMouseLeave);
    }

    function update(t: number) {
      // Update time uniform
      const time = t * 0.001;
      simulationProgram.uniforms.iTime.value = time;
      renderProgram.uniforms.iTime.value = time;

      // Update color mode
      renderProgram.uniforms.uColorMode.value =
        colorMode === 'type' ? 0 : colorMode === 'velocity' ? 1 : 2;

      // Update wrap edges
      simulationProgram.uniforms.uWrapEdges.value = wrapEdges;

      // Update mouse
      if (enableMouseInteraction) {
        const smoothing = 0.05;
        currentMouse[0] += smoothing * (targetMouse[0] - currentMouse[0]);
        currentMouse[1] += smoothing * (targetMouse[1] - currentMouse[1]);
        simulationProgram.uniforms.uMouse.value[0] = currentMouse[0];
        simulationProgram.uniforms.uMouse.value[1] = currentMouse[1];
        simulationProgram.uniforms.uMouseDown.value = mouseDownRef.current;
      }

      // Simulation step
      simulationProgram.uniforms.tPositions.value = positionTexture;
      simulationProgram.uniforms.tVelocities.value = velocityTexture;
      renderer.render({ scene: simulationMesh, target: simulationTarget });

      // Copy simulation results back to textures
      gl.bindFramebuffer(gl.FRAMEBUFFER, simulationTarget.buffer);

      // Read positions
      // Read positions
      if ('readBuffer' in gl) {
        (gl as WebGL2RenderingContext).readBuffer(gl.COLOR_ATTACHMENT0);
      }
      gl.bindTexture(gl.TEXTURE_2D, positionTexture.texture);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, particleCount, 1);

      // Read velocities
      if ('readBuffer' in gl) {
        (gl as WebGL2RenderingContext).readBuffer(gl.COLOR_ATTACHMENT0);
      }
      gl.bindTexture(gl.TEXTURE_2D, velocityTexture.texture);
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, particleCount, 0, particleCount, 1);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // Render particles
      renderProgram.uniforms.tPositions.value = positionTexture;
      renderProgram.uniforms.tVelocities.value = velocityTexture;
      renderProgram.uniforms.tPrevFrame.value = renderTargets[1 - currentRenderTarget].texture;
      renderer.render({ scene: renderMesh, target: renderTargets[currentRenderTarget] });

      // Render to screen
      renderer.render({ scene: renderMesh });

      // Swap render targets
      currentRenderTarget = 1 - currentRenderTarget;

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
    particleCount,
    particleTypes,
    minDistance,
    maxDistance,
    forceFactor,
    friction,
    wrapEdges,
    particleSize,
    trailIntensity,
    colorMode,
    enableMouseInteraction,
    mouseRadius,
    mouseForce,
    config.attractionMatrix,
  ]);

  return (
    <div ref={containerRef} className={`w-full h-full absolute inset-0 ${className}`}>
      {/* Controls */}
      <div className="absolute bottom-4 left-4 bg-black/50 text-white p-3 rounded">
        <h3 className="text-sm font-bold mb-2">Particle Life Settings</h3>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-xs">Color Mode:</label>
            <select
              className="bg-black/70 text-white text-xs p-1 rounded"
              value={colorMode}
              onChange={handleColorModeChange}
            >
              <option value="type">By Type</option>
              <option value="velocity">By Velocity</option>
              <option value="age">By Age</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs">Behavior:</label>
            <select
              className="bg-black/70 text-white text-xs p-1 rounded"
              value={attractionPreset}
              onChange={handleAttractionPresetChange}
            >
              <option value="random">Random</option>
              <option value="clusters">Clusters</option>
              <option value="mix">Mix</option>
              <option value="chaos">Chaos</option>
              <option value="balanced">Balanced</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs">Wrap Edges:</label>
            <input
              type="checkbox"
              checked={wrapEdges}
              onChange={handleWrapEdgesChange}
              className="w-4 h-4"
            />
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-2 rounded text-xs">
        Click and drag to interact with particles
      </div>
    </div>
  );
};

export { ParticleLife };
