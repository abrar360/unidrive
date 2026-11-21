'use client';

import React, { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import UniverEditor from '../../../components/UniverEditor';
import { useToast } from '../../../components/ToastProvider';

// Next.js requires useSearchParams() to be inside a Suspense boundary,
// otherwise `next build` fails while prerendering this page.
export default function CreateDocumentPage() {
  return (
    <Suspense fallback={null}>
      <CreateDocument />
    </Suspense>
  );
}

function CreateDocument() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);
  const savedDocumentIdRef = useRef<string | null>(null); // Use ref for immediate access
  // The in-flight POST that creates the document. Saves that arrive before it
  // finishes wait for it and then update that document, instead of each
  // sending their own POST and creating duplicates.
  const createRequestRef = useRef<Promise<unknown> | null>(null);
  const { showToast } = useToast();

  // Get initial title from URL parameter or use default
  const initialTitle = searchParams.get('title') || 'New Document';
  // Folder to create the document in, if opened from inside a folder
  const folderId = searchParams.get('folderId');

  const handleSave = async (documentData: any) => {
    try {
      let response;

      // A create request is already running: wait for it, then update
      if (!savedDocumentIdRef.current && createRequestRef.current) {
        await createRequestRef.current.catch(() => {});
      }

      // Use ref for immediate access to document ID
      if (savedDocumentIdRef.current) {
        response = await fetch(`/api/documents/${savedDocumentIdRef.current}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(documentData),
        });
      } else {
        // Create new document only on first save
        const createRequest = fetch('/api/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          // folderId comes from /document/create?folderId=... (creating inside a folder)
          body: JSON.stringify(folderId ? { ...documentData, folderId } : documentData),
        }).then(async (res) => {
          if (!res.ok) {
            throw new Error('Failed to save document');
          }
          const created = await res.json();
          if (created.documentId) {
            savedDocumentIdRef.current = created.documentId;
            setSavedDocumentId(created.documentId);
          }
          return created;
        });
        createRequestRef.current = createRequest;
        try {
          const created = await createRequest;
          return created;
        } finally {
          createRequestRef.current = null;
        }
      }

      if (!response.ok) {
        throw new Error('Failed to save document');
      }

      const result = await response.json();

      // Optionally redirect to the edit page after save
      // router.push(`/document/${result.documentId}`);
      
      return result;
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to save document', 'error');
      throw error;
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      margin: 0,
      padding: 0,
      backgroundColor: 'white'
    }}>
      <UniverEditor
        title={initialTitle}
        onSave={handleSave}
      />
    </div>
  );
}