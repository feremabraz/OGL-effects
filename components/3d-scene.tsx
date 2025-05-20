'use client';

import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  Environment,
  OrbitControls,
  PerspectiveCamera,
  useGLTF,
  Html,
  Float,
  ContactShadows,
  useProgress,
} from '@react-three/drei';
import { atom, useAtom, useAtomValue } from 'jotai';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MODEL_URL = '/cubic-character.glb';

const modelRotationAtom = atom(0);
const autoRotateAtom = atom(true);
const environmentPresetAtom = atom<
  | 'apartment'
  | 'city'
  | 'dawn'
  | 'forest'
  | 'lobby'
  | 'night'
  | 'park'
  | 'studio'
  | 'sunset'
  | 'warehouse'
>('sunset');

// Separate loading component that doesn't cause state updates during render
function LoadingScreen() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
      <div className="flex flex-col items-center justify-center">
        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full animate-pulse w-full" />
        </div>
        <p className="mt-2 text-sm text-gray-300">Loading model...</p>
      </div>
    </div>
  );
}

// Progress tracker component - separated from the main render tree
function ProgressTracker() {
  const { progress, active } = useProgress();

  if (!active) return null;

  return (
    <Html center>
      <div className="flex flex-col items-center justify-center">
        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-gray-600">{progress.toFixed(0)}% loaded</p>
      </div>
    </Html>
  );
}

// Model component
function Model() {
  const { scene } = useGLTF(MODEL_URL);
  const [rotation] = useAtom(modelRotationAtom);
  const autoRotate = useAtomValue(autoRotateAtom);
  const [rotationY, setRotationY] = useState(0);

  // Handle auto-rotation with standard React hooks
  useEffect(() => {
    if (!autoRotate) return;

    let animationId: number;
    const animate = () => {
      setRotationY((prev) => (prev + 0.005) % (Math.PI * 2));
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [autoRotate]);

  return (
    <group rotation-y={autoRotate ? rotationY : rotation} scale={3} position={[0, -0.5, 0]}>
      <primitive object={scene} />
    </group>
  );
}

// Scene content component to separate model loading from the main scene
function SceneContent() {
  const environment = useAtomValue(environmentPresetAtom);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} />
      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
        minDistance={3}
        maxDistance={8}
      />

      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <Suspense fallback={<ProgressTracker />}>
          <Model />
        </Suspense>
      </Float>

      <ContactShadows opacity={0.5} scale={10} blur={1} far={10} resolution={256} color="#000000" />

      <Environment preset={environment} background blur={0.8} />

      <ambientLight intensity={0.3} />
      <spotLight position={[5, 5, 5]} angle={0.15} penumbra={1} intensity={1} castShadow />
    </>
  );
}

// Controls component
function SceneControls() {
  const [autoRotate, setAutoRotate] = useAtom(autoRotateAtom);
  const [environment, setEnvironment] = useAtom(environmentPresetAtom);

  const environments = [
    'sunset',
    'studio',
    'dawn',
    'night',
    'warehouse',
    'forest',
    'park',
  ] as const;

  return (
    <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-4">
      <Button 
        variant="outline" 
        onClick={() => setAutoRotate(!autoRotate)}
        className="bg-white/10 backdrop-blur-md text-white shadow-lg hover:bg-white/20 border-none"
      >
        {autoRotate ? 'Stop Rotation' : 'Auto Rotate'}
      </Button>

      <Select
        value={environment}
        onValueChange={(value) => setEnvironment(value as typeof environment)}
      >
        <SelectTrigger className="w-[180px] bg-white/10 backdrop-blur-md text-white shadow-lg hover:bg-white/20 border-none">
          <SelectValue placeholder="Environment" />
        </SelectTrigger>
        <SelectContent>
          {environments.map((env) => (
            <SelectItem key={env} value={env}>
              {env.charAt(0).toUpperCase() + env.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Information overlay
function InfoOverlay() {
  return (
    <div className="absolute top-5 left-5 max-w-md p-4 bg-white/10 backdrop-blur-md rounded-md text-white shadow-lg">
      <h2 className="text-xl font-bold mb-2">Cubic Character</h2>
      <p className="text-sm">
        This is a 3D model of a cubic character modeled with Blender, exported as glb and rendered
        using React Three Fiber and Drei. Use the controls below to change the environment or toggle
        auto-rotation.
      </p>
    </div>
  );
}

// Main scene component
export function ThreeDScene() {
  // Preload the model
  useGLTF.preload(MODEL_URL);
  const [isLoading, setIsLoading] = useState(true);

  // Use effect to handle initial loading state
  useEffect(() => {
    // Set a timeout to ensure we don't show the loading screen forever if something goes wrong
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative h-full w-full flex flex-col">
      {isLoading && <LoadingScreen />}
      <Canvas className="flex-1">
        <SceneContent />
      </Canvas>

      <InfoOverlay />
      <SceneControls />
    </div>
  );
}
