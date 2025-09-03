'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import UniverEditor from '../../../components/UniverEditor';
import { useToast } from '../../../components/ToastProvider';

export default function EditDocument() {
  const params = useParams();
  const router = useRouter();
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const loadDocument = async () => {
      try {
        // Fetch actual document data from API
        const response = await fetch(`/api/documents/${params.id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Document not found');
          }
          throw new Error('Failed to load document');
        }
        
        const documentData = await response.json();
        setDocumentData(documentData);
      } catch (error) {
        console.error('Load failed:', error);
        // Optionally set an error state for user feedback
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [params.id]);

  const handleSave = async (updatedData: any) => {
    try {
      // Update document using PUT API endpoint
      const response = await fetch(`/api/documents/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save document');
      }
      
      const result = await response.json();
      console.log('Document updated successfully:', result);
      
      // Dispatch event to notify dashboard that preview needs to be refreshed
      window.dispatchEvent(new CustomEvent('document-updated', {
        detail: { documentId: params.id, timestamp: Date.now() }
      }));
    } catch (error) {
      console.error('Save failed:', error);
      showToast('Failed to save document', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400 text-sm font-light">Loading document...</div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      margin: 0,
      padding: 0,
      backgroundColor: '#000000'
    }}>
      <UniverEditor
        documentId={params.id as string}
        initialData={documentData}
        title={documentData?.title}
        onSave={handleSave}
      />
    </div>
  );
}