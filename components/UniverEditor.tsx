'use client';

import { useEffect, useRef, useState } from 'react';
import { useToast } from '../components/ToastProvider';

const DOCUMENT_DATA = {};


interface UniverEditorProps {
  documentId?: string;
  initialData?: any;
  title?: string;
  onSave?: (data: any) => void;
}

export default function UniverEditor({
  documentId,
  initialData,
  title = 'Untitled Document',
  onSave
}: UniverEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<any>(null);
  const [documentTitle, setDocumentTitle] = useState(initialData?.title || title);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'changed' | 'saving'>('idle');
  const facadeRef = useRef<any>(null);
  const lastContentHashRef = useRef<string>('');
  const lastTitleHashRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { showToast } = useToast();

  // Function to handle document changes and trigger auto-save
  const handleDocumentChange = async () => {
    if (saving || !onSave) return;

    try {
      const currentContent = await extractDocumentContent();
      const currentHash = JSON.stringify(currentContent);
      
      if (currentHash !== lastContentHashRef.current) {
        lastContentHashRef.current = currentHash;
        setAutoSaveStatus('changed');
        
        // Clear existing timeout if any
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        // Set new timeout for auto-save
        saveTimeoutRef.current = setTimeout(async () => {
          console.log('🔍 DEBUG: Content auto-save triggered');
          setAutoSaveStatus('saving');
          
          // Get the current title from the input field to avoid stale state
          const titleInput = document.querySelector('input[type="text"]') as HTMLInputElement;
          const currentTitle = titleInput?.value || documentTitle;
          
          const documentData = {
            title: currentTitle,
            content: currentContent
          };
          
          console.log('🔍 DEBUG: Content auto-save with data:', documentData);
          await onSave(documentData);
          setLastSaved(new Date());
          
          setAutoSaveStatus('idle');
        }, 2000); // 2 second debounce
      }
    } catch (error) {
      console.error('Error handling document change:', error);
    }
  };

 // Function to handle title changes and trigger auto-save
 const handleTitleChange = async (newTitle: string) => {
   if (saving || !onSave) return;

   console.log('🔍 DEBUG: handleTitleChange called with:', newTitle);
   console.log('🔍 DEBUG: Current documentTitle state:', documentTitle);

   try {
     const currentHash = newTitle;
     
     if (currentHash !== lastTitleHashRef.current) {
       lastTitleHashRef.current = currentHash;
       setAutoSaveStatus('changed');
       
       console.log('🔍 DEBUG: Title changed, will auto-save in 2 seconds');
       
       // Clear existing timeout if any
       if (titleSaveTimeoutRef.current) {
         clearTimeout(titleSaveTimeoutRef.current);
       }
       
       // Set new timeout for auto-save, capturing the new title in the closure
       titleSaveTimeoutRef.current = setTimeout(async () => {
         console.log('🔍 DEBUG: Auto-save triggered, using captured title:', newTitle);
         setAutoSaveStatus('saving');
         
         // Use the captured newTitle instead of documentTitle state
         const documentContent = await extractDocumentContent();
         const documentData = {
           title: newTitle, // Use the captured title directly
           content: documentContent
         };
         
         console.log('🔍 DEBUG: Title auto-save with data:', documentData);
         await onSave(documentData);
         setLastSaved(new Date());
         lastContentHashRef.current = JSON.stringify(documentContent);
         
         setAutoSaveStatus('idle');
       }, 2000); // 2 second debounce
     }
   } catch (error) {
     console.error('Error handling title change:', error);
   }
 };

  // Function to set up auto-save functionality
  const setupAutoSave = async () => {
    if (!facadeRef.current || !onSave) {
      console.log('❌ Cannot setup auto-save: facade or onSave not available');
      return;
    }

    console.log('🚀 Setting up event listeners for auto-save...');
    console.log('Facade available:', !!facadeRef.current);
    console.log('onSave prop available:', !!onSave);
    
    try {
      let activeDocument = null;
      
      // Debug: Log available facade methods
      if (facadeRef.current) {
        console.log('Facade methods:', Object.getOwnPropertyNames(facadeRef.current));
        console.log('Facade prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(facadeRef.current)));
      }
      
      // Method 1: Try to get active document through facade
      if (typeof facadeRef.current.getActiveDocument === 'function') {
        activeDocument = facadeRef.current.getActiveDocument();
        console.log('Active document found:', !!activeDocument);
      } else {
        console.log('getActiveDocument method not available');
      }
      
      // Method 2: If no active document, try to get all documents
      if (!activeDocument && typeof facadeRef.current.getAllDocuments === 'function') {
        const allDocs = facadeRef.current.getAllDocuments();
        console.log('All documents:', allDocs);
        if (allDocs && allDocs.length > 0) {
          activeDocument = allDocs[0];
          console.log('Using first document from getAllDocuments');
        }
      } else if (!activeDocument) {
        console.log('getAllDocuments method not available');
      }

      if (activeDocument) {
        console.log('Active document methods:', Object.getOwnPropertyNames(activeDocument));
        console.log('Active document prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(activeDocument)));
        
        // Try to listen for document changes using available event methods
        let eventListenerSet = false;
        const eventMethods = ['on', 'addEventListener', 'subscribe', 'onChange'];
        
        for (const method of eventMethods) {
          if (typeof activeDocument[method] === 'function') {
            // Use the first available event method
            activeDocument[method]('change', handleDocumentChange);
            console.log(`✅ Using ${method} for document change events`);
            eventListenerSet = true;
            break;
          }
        }

        // Also try to listen for command/operation events if available
        if (typeof facadeRef.current.on === 'function') {
          facadeRef.current.on('operation', handleDocumentChange);
          console.log('✅ Listening for operation events on facade');
          eventListenerSet = true;
        }
        
        // Try onCommandExecuted as another event method
        if (!eventListenerSet && typeof facadeRef.current.onCommandExecuted === 'function') {
          facadeRef.current.onCommandExecuted((command: any) => {
            console.log('📝 Command executed:', command.id);
            // Filter for content-changing commands
            if (command.id && (
              command.id.includes('doc.operation') ||
              command.id.includes('text') ||
              command.id.includes('insert') ||
              command.id.includes('delete') ||
              command.id.includes('replace')
            )) {
              console.log('🔄 Content change detected via command:', command.id);
              handleDocumentChange();
            }
          });
          console.log('✅ Using onCommandExecuted for content change detection');
          eventListenerSet = true;
        }
        
        if (!eventListenerSet) {
          console.warn('⚠️ No event methods available - auto-save disabled');
        }
      } else {
        // Try onCommandExecuted even without active document
        if (typeof facadeRef.current.onCommandExecuted === 'function') {
          facadeRef.current.onCommandExecuted((command: any) => {
            console.log('📝 Command executed (no active doc):', command.id);
            // Filter for content-changing commands
            if (command.id && (
              command.id.includes('doc.operation') ||
              command.id.includes('text') ||
              command.id.includes('insert') ||
              command.id.includes('delete') ||
              command.id.includes('replace')
            )) {
              console.log('🔄 Content change detected via command (no active doc):', command.id);
              handleDocumentChange();
            }
          });
          console.log('✅ Using onCommandExecuted without active document');
        } else {
          console.warn('⚠️ No active document and no command events - auto-save disabled');
        }
      }
    } catch (error) {
      console.error('❌ Error setting up event listeners:', error);
      console.warn('⚠️ Auto-save disabled due to event listener setup failure');
    }
  };

  useEffect(() => {
    if (!containerRef.current || univerRef.current) return;

    const initializeUniver = async () => {
      try {
        // Dynamic imports to prevent redi conflicts
        const [
          { LocaleType, mergeLocales, Univer, UniverInstanceType },
          DesignEnUS,
          { UniverDocsPlugin },
          { UniverDocsUIPlugin },
          DocsUIEnUS,
          { UniverFormulaEnginePlugin },
          { UniverRenderEnginePlugin },
          { UniverUIPlugin },
          UIEnUS
        ] = await Promise.all([
          import('@univerjs/core'),
          import('@univerjs/design/locale/en-US'),
          import('@univerjs/docs'),
          import('@univerjs/docs-ui'),
          import('@univerjs/docs-ui/locale/en-US'),
          import('@univerjs/engine-formula'),
          import('@univerjs/engine-render'),
          import('@univerjs/ui'),
          import('@univerjs/ui/locale/en-US')
        ]);

        // Import facades after core imports
        await Promise.all([
          import('@univerjs/engine-formula/lib/facade'),
          import('@univerjs/ui/lib/facade'),
          import('@univerjs/docs-ui/lib/facade')
        ]);

        const univer = new Univer({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: mergeLocales(
              DesignEnUS.default,
              UIEnUS.default,
              DocsUIEnUS.default,
            ),
          },
        });

        // Try to import and initialize facade API
        try {
          // Import FUniver from facade module using direct path
          const { FUniver } = await import('@univerjs/core/lib/facade');
          const univerAPI = FUniver.newAPI(univer);
          facadeRef.current = univerAPI;
          console.log('Facade API initialized successfully');
          
          // Set up auto-save functionality immediately after facade initialization
          if (onSave) {
            setupAutoSave();
          }
        } catch (error) {
          console.warn('Facade API not available:', error);
          facadeRef.current = null;
        }

        univer.registerPlugin(UniverRenderEnginePlugin);
        univer.registerPlugin(UniverFormulaEnginePlugin);
        univer.registerPlugin(UniverUIPlugin, {
          container: containerRef.current,
        });
        univer.registerPlugin(UniverDocsPlugin);
        univer.registerPlugin(UniverDocsUIPlugin);

        // Create the document with existing content or empty
        const documentData = initialData?.content ? {
          id: documentId || 'default-doc',
          ...initialData.content
        } : DOCUMENT_DATA;

        console.log('📄 Creating Univer document with data:', documentData);
        univer.createUnit(UniverInstanceType.UNIVER_DOC, documentData);

        // // Try to set the created document as active after creation
        // setTimeout(() => {
        //   if (facadeRef.current) {
        //     try {
        //       console.log('🔄 Attempting to activate document after creation...');
              
        //       // Method 1: Try getUniverDoc and inspect what we get
        //       if (typeof facadeRef.current.getUniverDoc === 'function') {
        //         const doc = facadeRef.current.getUniverDoc(documentData.id);
        //         console.log('Retrieved document by ID:', !!doc);
        //         if (doc) {
        //           console.log('Document object keys:', Object.getOwnPropertyNames(doc));
        //           console.log('Document prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(doc)));
        //         }
        //       }
              
        //       // Method 2: Try using _univerInstanceService directly
        //       if (facadeRef.current._univerInstanceService) {
        //         const instanceService = facadeRef.current._univerInstanceService;
        //         console.log('Instance service available:', !!instanceService);
        //         if (typeof instanceService.focusUnit === 'function') {
        //           instanceService.focusUnit(documentData.id);
        //           console.log('✅ Used focusUnit to activate document');
        //         } else if (typeof instanceService.setCurrentUnit === 'function') {
        //           instanceService.setCurrentUnit(documentData.id);
        //           console.log('✅ Used setCurrentUnit to activate document');
        //         }
        //       }
              
        //       // Method 3: Force refresh the facade active document
        //       setTimeout(() => {
        //         if (typeof facadeRef.current.getActiveDocument === 'function') {
        //           const activeDoc = facadeRef.current.getActiveDocument();
        //           console.log('Active document after activation attempts:', !!activeDoc);
        //         }
        //       }, 50);
        //     } catch (error) {
        //       console.error('Error activating document:', error);
        //     }
        //   }
        // }, 100);

        univerRef.current = univer;
      } catch (error) {
        console.error('Univer initialization failed:', error);
        showToast('Document editor failed to initialize', 'error');
      }
    };

    initializeUniver();

    return () => {
      if (univerRef.current) {
        univerRef.current.dispose();
        univerRef.current = null;
      }
    };
  }, []); // Remove initialData dependency to prevent re-initialization

  // Cleanup effect for auto-save functionality
  useEffect(() => {
    return () => {
      // Cleanup event listeners and intervals on component unmount
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
        titleSaveTimeoutRef.current = null;
      }
      
      // Try to cleanup event listeners if possible
      try {
        if (facadeRef.current && typeof facadeRef.current.off === 'function') {
          facadeRef.current.off('operation', handleDocumentChange);
        }
        
        // Also try to cleanup document event listeners
        if (facadeRef.current && typeof facadeRef.current.getActiveDocument === 'function') {
          const activeDocument = facadeRef.current.getActiveDocument();
          if (activeDocument) {
            const cleanupMethods = ['off', 'removeEventListener', 'unsubscribe', 'removeChangeListener'];
            for (const method of cleanupMethods) {
              if (typeof activeDocument[method] === 'function') {
                activeDocument[method]('change', handleDocumentChange);
                break;
              }
            }
          }
        }
      } catch (error) {
        console.warn('Error cleaning up event listeners:', error);
      }
    };
  }, []); // Run cleanup on unmount only

  // Function to extract document content for change detection
  const extractDocumentContent = async (): Promise<any> => {
    if (!facadeRef.current) {
      return {
        body: {
          dataStream: `No facade available - ${new Date().toISOString()}`,
          textRuns: [],
          paragraphs: [{ startIndex: 0 }],
        }
      };
    }

    try {
      let documentContent = null;
      
      // Method 1: Try to get active document through facade
      if (typeof facadeRef.current.getActiveDocument === 'function') {
        const activeDoc = facadeRef.current.getActiveDocument();
        if (activeDoc && typeof activeDoc.getSnapshot === 'function') {
          documentContent = activeDoc.getSnapshot();
        }
      }
      
      // Method 2: If no active document, try to get all documents
      if (!documentContent && typeof facadeRef.current.getAllDocuments === 'function') {
        const allDocs = facadeRef.current.getAllDocuments();
        if (allDocs && allDocs.length > 0) {
          const firstDoc = allDocs[0];
          if (typeof firstDoc.getSnapshot === 'function') {
            documentContent = firstDoc.getSnapshot();
          }
        }
      }
      
      // Final fallback
      if (!documentContent) {
        documentContent = {
          body: {
            dataStream: `Fallback content - ${new Date().toISOString()}`,
            textRuns: [],
            paragraphs: [{ startIndex: 0 }],
          }
        };
      }
      
      return documentContent;
    } catch (error) {
      console.error('Error extracting content:', error);
      return {
        body: {
          dataStream: '',
          textRuns: [],
          paragraphs: [{ startIndex: 0 }],
        }
      };
    }
  };

  const handleSave = async () => {
    if (!onSave || saving) return;
    
    setSaving(true);
    try {
      const documentContent = await extractDocumentContent();

      const documentData = {
        title: documentTitle,
        content: documentContent
      };
      
      console.log('🔍 DEBUG: Saving document with title:', documentTitle);
      console.log('🔍 DEBUG: Document data being sent:', documentData);
      
      await onSave(documentData);
      setLastSaved(new Date());
      lastContentHashRef.current = JSON.stringify(documentContent); // Update hash after successful save
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save document', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header with save button */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <input
            type="text"
            value={documentTitle}
            onChange={(e) => {
              setDocumentTitle(e.target.value);
              handleTitleChange(e.target.value);
            }}
            className="text-lg font-medium text-gray-900 bg-transparent border-none outline-none focus:bg-gray-50 px-2 py-1 rounded"
            placeholder="Untitled Document"
          />
          <div className="flex items-center space-x-2">
            {lastSaved && (
              <span className="text-sm text-gray-500">
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {autoSaveStatus === 'changed' && (
              <span className="text-sm text-yellow-600">• Editing...</span>
            )}
            {autoSaveStatus === 'saving' && (
              <span className="text-sm text-blue-600">Saving...</span>
            )}
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Univer Editor Container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          flex: 1
        }}
      />
    </div>
  );
}