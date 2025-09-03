'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../components/ToastProvider';

interface UniversalEditorProps {
  documentId?: string;
  onSave?: (data: any) => void;
  initialData?: any;
}

export default function UniversalEditor({ documentId, onSave, initialData }: UniversalEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    let univer: any = null;
    let mounted = true;

    const initializeUniver = async () => {
      // Use a small delay to ensure the component is fully mounted
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!mounted) return; // Component was unmounted during delay
      
      if (!containerRef.current) {
        console.error('❌ Container ref is null after mounting delay');
        const errorMsg = 'Container element not found after mounting';
        setError(errorMsg);
        showToast(errorMsg, 'error');
        setIsLoading(false);
        return;
      }
      
      try {
        console.log('🚀 Starting Univer initialization with dynamic imports...');
        console.log('📦 Container element ready:', containerRef.current);
        console.log('📦 Container ID:', containerRef.current.id);
        console.log('📦 Container classes:', containerRef.current.className);
        
        // Step 1: Load core modules
        console.log('📦 Loading core modules...');
        const { LocaleType, Univer, UniverInstanceType } = await import('@univerjs/core');
        const { defaultTheme } = await import('@univerjs/design');
        console.log('✅ Core modules loaded');

        if (!mounted) return; // Check if component is still mounted

        // Step 2: Create Univer instance
        console.log('🏗️ Creating Univer instance...');
        univer = new Univer({
          theme: defaultTheme,
          locale: LocaleType.EN_US,
        });
        console.log('✅ Univer instance created successfully');

        if (!mounted) return;

        // Step 3: Load and register render engine
        console.log('📦 Loading render engine...');
        const { UniverRenderEnginePlugin } = await import('@univerjs/engine-render');
        console.log('🔌 Registering render engine plugin...');
        univer.registerPlugin(UniverRenderEnginePlugin);
        console.log('✅ Render engine registered');

        if (!mounted) return;

        // Step 4: Load and register docs plugin (without UI first)
        console.log('📦 Loading docs plugin...');
        const { UniverDocsPlugin } = await import('@univerjs/docs');
        console.log('🔌 Registering docs plugin...');
        univer.registerPlugin(UniverDocsPlugin);
        console.log('✅ Docs plugin registered');

        if (!mounted) return;

        // Step 5: Load and register UI plugin (this is where React issues might occur)
        console.log('📦 Loading UI plugin...');
        const { UniverUIPlugin } = await import('@univerjs/ui');
        console.log('🔌 Registering UI plugin with container...');
        console.log('📦 Container for UI plugin:', containerRef.current);
        univer.registerPlugin(UniverUIPlugin, {
          container: containerRef.current,
        });
        console.log('✅ UI plugin registered');

        if (!mounted) return;

        // Step 6: Load and register docs UI plugin
        console.log('📦 Loading docs UI plugin...');
        const { UniverDocsUIPlugin } = await import('@univerjs/docs-ui');
        console.log('🔌 Registering docs UI plugin...');
        univer.registerPlugin(UniverDocsUIPlugin);
        console.log('✅ Docs UI plugin registered');

        if (!mounted) return;

        // Step 7: Create document
        console.log('📄 Creating document...');
        const documentData = {
          id: documentId || `univer-doc-${Date.now()}`,
          body: {
            dataStream: 'Welcome to Univer Document Editor!\r\n\r\nYou can start typing your content here. This is the real Univer editor with full functionality!\r\n',
            textRuns: [],
            paragraphs: [
              {
                startIndex: 0,
                paragraphStyle: {
                  spaceAbove: 0,
                  lineSpacing: 1,
                  spaceBelow: 0,
                },
              },
            ],
            sectionBreaks: [
              {
                startIndex: 120,
              },
            ],
          },
          documentStyle: {
            pageSize: {
              width: 595,
              height: 842,
            },
            marginTop: 72,
            marginBottom: 72,
            marginRight: 90,
            marginLeft: 90,
          },
        };

        console.log('📄 Document data prepared:', documentData);
        
        console.log('📄 Creating document unit...');
        univer.createUnit(UniverInstanceType.UNIVER_DOC, documentData);
        
        if (!mounted) return;
        
        univerRef.current = univer;
        setIsLoading(false);
        
        console.log('🎉 Univer document editor initialized successfully!');

      } catch (error: any) {
        console.error('❌ Failed to initialize Univer:', error);
        console.error('❌ Error details:', error.message);
        console.error('❌ Stack trace:', error.stack);
        console.error('❌ Error name:', error.name);
        
        if (!mounted) return;
        
        // Provide more specific error information
        let errorMsg: string;
        if (error.message.includes('ReactCurrentOwner')) {
          errorMsg = 'React compatibility issue detected. This is a known issue with Univer + Next.js integration.';
        } else if (error.message.includes('Cannot read properties of undefined')) {
          errorMsg = 'React component lifecycle issue. The component may have been unmounted during initialization.';
        } else {
          errorMsg = `Univer initialization failed: ${error.message}`;
        }
        setError(errorMsg);
        showToast(errorMsg, 'error');
        setIsLoading(false);
      }
    };

    // Start initialization
    initializeUniver();

    return () => {
      mounted = false; // Mark component as unmounted
      if (univer) {
        try {
          console.log('🧹 Disposing Univer instance...');
          univer.dispose();
        } catch (error) {
          console.error('Error disposing Univer:', error);
        }
      }
      univerRef.current = null;
    };
  }, [documentId, initialData]);

  if (isLoading) {
    return (
      <div className="w-full h-[calc(100vh-8rem)] border border-white/10 rounded-lg bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading REAL Univer Document Editor...</p>
          <p className="text-xs text-gray-400 mt-2">NO FALLBACK - Only the actual Univer library</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[calc(100vh-8rem)] border border-red-200 rounded-lg bg-red-50 flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="font-semibold mb-2">❌ Real Univer Editor Failed to Load</p>
          <p className="text-sm mb-2">{error}</p>
          <p className="text-xs text-gray-500 mb-4">This is the ACTUAL Univer library error, not a fallback</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry Real Univer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="univer-container"
      className="univer-container w-full h-[calc(100vh-8rem)] border border-white/10 rounded-lg bg-white overflow-hidden"
      style={{ minHeight: '600px' }}
    />
  );
}