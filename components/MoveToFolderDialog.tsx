import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from './ToastProvider';

interface Folder {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  documentCount: number;
}

interface MoveToFolderDialogProps {
  isOpen: boolean;
  documentId: string;
  documentTitle: string;
  currentFolderId?: string;
  onClose: () => void;
  onMoved: () => void;
}

const MoveToFolderDialog: React.FC<MoveToFolderDialogProps> = ({
  isOpen,
  documentId,
  documentTitle,
  currentFolderId,
  onClose,
  onMoved
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { showToast } = useToast();

  // Track when component is mounted (client-side)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch folders when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchFolders();
      setSelectedFolderId(null);
    }
  }, [isOpen]);

  const fetchFolders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/folders');
      if (!response.ok) {
        throw new Error('Failed to fetch folders');
      }
      const data = await response.json();
      setFolders(data.folders || []);
    } catch (err) {
      console.error('Error fetching folders:', err);
      showToast('Failed to load folders', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async () => {
    if (!documentId) return;

    setIsMoving(true);
    
    try {
      const response = await fetch(`/api/documents/${documentId}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderId: selectedFolderId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to move document');
      }
      
      const targetFolderName = selectedFolderId 
        ? folders.find(f => f.id === selectedFolderId)?.name 
        : 'Root';
      
      onMoved();
      onClose();
    } catch (error) {
      console.error('Error moving document:', error);
      showToast(`Failed to move document: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
    
    setIsMoving(false);
  };

  if (!isOpen || !isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-xl w-full max-w-[380px] mx-4 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center space-x-2.5 mb-3">
            <span className="material-icons text-lg text-blue-400/80">drive_file_move</span>
            <h3 className="text-lg font-medium text-white">Move Document</h3>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Choose a folder to move <span className="text-white/80">"{documentTitle}"</span> to.
          </p>
        </div>
        
        {/* Folder Selection */}
        <div className="px-6 pb-4">
          <label className="block text-xs font-medium text-gray-500 mb-3 uppercase tracking-wider">
            Select Destination
          </label>
          
          {loading ? (
            <div className="space-y-2">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 animate-pulse">
                <div className="h-3 bg-white/[0.04] rounded"></div>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 animate-pulse">
                <div className="h-3 bg-white/[0.04] rounded"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {/* Root option */}
              <label className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors duration-150 cursor-pointer">
                <input
                  type="radio"
                  name="folder"
                  value=""
                  checked={selectedFolderId === null}
                  onChange={() => setSelectedFolderId(null)}
                  className="text-blue-400 bg-transparent border-white/[0.15] focus:ring-blue-400 focus:ring-1"
                  disabled={!currentFolderId}
                />
                <span className="material-icons text-gray-500 text-[16px]">home</span>
                <div className="flex-1">
                  <span className="text-white/90 text-sm">Root</span>
                  <span className="text-gray-500 text-xs block">Main drive</span>
                </div>
              </label>
              
              {/* Folders */}
              {folders.map((folder) => (
                <label 
                  key={folder.id}
                  className="flex items-center space-x-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors duration-150 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="folder"
                    value={folder.id}
                    checked={selectedFolderId === folder.id}
                    onChange={() => setSelectedFolderId(folder.id)}
                    className="text-blue-400 bg-transparent border-white/[0.15] focus:ring-blue-400 focus:ring-1"
                    disabled={currentFolderId === folder.id}
                  />
                  <span className="material-icons text-gray-500 text-[16px]">folder</span>
                  <div className="flex-1">
                    <span className="text-white/90 text-sm">{folder.name}</span>
                    <span className="text-gray-500 text-xs block">
                      {folder.documentCount === 0 ? 'Empty' : folder.documentCount === 1 ? '1 document' : `${folder.documentCount} documents`}
                    </span>
                  </div>
                  {currentFolderId === folder.id && (
                    <span className="text-xs text-blue-400/60 bg-blue-400/10 px-1.5 py-0.5 rounded">Current</span>
                  )}
                </label>
              ))}
              
              {folders.length === 0 && (
                <div className="text-center text-gray-500 py-6">
                  <span className="material-icons text-xl mb-2 opacity-50">folder_open</span>
                  <p className="text-xs">No folders available</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={isMoving}
            className="flex-1 px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.04] rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={isMoving || loading || (selectedFolderId === null && !currentFolderId) || (selectedFolderId === currentFolderId)}
            className="flex-1 px-4 py-2 text-sm bg-blue-500/90 hover:bg-blue-500 text-white rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isMoving ? (
              <>
                <span className="animate-spin material-icons text-xs mr-1.5">refresh</span>
                Moving...
              </>
            ) : (
              'Move Document'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MoveToFolderDialog;