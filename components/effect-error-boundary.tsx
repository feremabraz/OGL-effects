'use client';

import { type ReactNode, Component, type ErrorInfo } from 'react';
import { NavigationButtons } from '@/components/navigation-buttons';

interface EffectErrorBoundaryProps {
  currentEffect: string;
  children: ReactNode;
}

interface EffectErrorBoundaryState {
  hasError: boolean;
}

export class EffectErrorBoundary extends Component<
  EffectErrorBoundaryProps,
  EffectErrorBoundaryState
> {
  constructor(props: EffectErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error in EffectErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-black/70 p-6 rounded-lg border border-red-500 max-w-md">
            <h2 className="text-2xl font-bold mb-2 text-white">Rendering Error</h2>
            <p className="text-white/80 mb-4">
              There was a problem initializing the WebGL renderer. This might be due to browser
              compatibility issues or hardware limitations.
            </p>
            <p className="text-white/60 text-sm">
              Try refreshing the page or using a different browser with WebGL support.
            </p>
          </div>
          <NavigationButtons currentEffect={this.props.currentEffect} />
        </div>
      );
    }
    return this.props.children;
  }
}
