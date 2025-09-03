'use client';

import React, { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import UniverEditor from '../../../components/UniverEditor';
import { useToast } from '../../../components/ToastProvider';

export default function CreateDocument() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [savedDocumentId, setSavedDocumentId] = useState<string | null>(null);
  const savedDocumentIdRef = useRef<string | null>(null); // Use ref for immediate access
  const { showToast } = useToast();

  // Get initial title from URL parameter or use default
  const initialTitle = searchParams.get('title') || 'New Document';

  const handleSave = async (documentData: any) => {
    console.log('🔍 DEBUG: handleSave called, current savedDocumentIdRef:', savedDocumentIdRef.current);
    console.log('🔍 DEBUG: current savedDocumentId state:', savedDocumentId);
    console.log('🔍 DEBUG: documentData:', documentData);
    
    try {
      let response;
      
      // Use ref for immediate access to document ID
      if (savedDocumentIdRef.current) {
        console.log('Updating existing document:', savedDocumentIdRef.current);
        response = await fetch(`/api/documents/${savedDocumentIdRef.current}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(documentData),
        });
      } else {
        // Create new document only on first save
        console.log('Creating new document');
        response = await fetch('/api/documents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(documentData),
        });
      }

      if (!response.ok) {
        throw new Error('Failed to save document');
      }

      const result = await response.json();
      console.log('Document saved:', result);
      
      // Store the document ID from the first save (both in ref and state)
      if (!savedDocumentIdRef.current && result.documentId) {
        savedDocumentIdRef.current = result.documentId; // Immediate access
        setSavedDocumentId(result.documentId); // For UI updates
        console.log('Stored document ID for future saves:', result.documentId);
        console.log('🔍 DEBUG: Ref after setting savedDocumentId:', savedDocumentIdRef.current);
      }
      
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