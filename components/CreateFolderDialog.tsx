import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from './ToastProvider';

interface CreateFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFolderCreated: () => void;
  parentFolderId?: string;
}

const CreateFolderDialog: React.FC<CreateFolderDialogProps> = ({
  isOpen,
  onClose,
  onFolderCreated,
  parentFolderId
}) => {
  const [folderName, setFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { showToast } = useToast();

  // Track when component is mounted (client-side)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setFolderName('');
    }
  }, [isOpen]);

  const handleCreate = async () => {
    const trimmedName = folderName.trim();
    if (!trimmedName) {
      showToast('Folder name cannot be empty', 'error');
      return;
    }

    setIsCreating(true);
    
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: trimmedName,
          parentFolderId: parentFolderId || null
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create folder');
      }
      
      onFolderCreated();
      onClose();
    } catch (error) {
      console.error('Error creating folder:', error);
      showToast(`Failed to create folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
    
    setIsCreating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen || !isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-xl w-full max-w-[380px] mx-4 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center space-x-2.5 mb-3">
            <span className="material-icons text-lg text-blue-400/80">create_new_folder</span>
            <h3 className="text-lg font-medium text-white">Create New Folder</h3>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            Enter a name for your new folder.
          </p>
          
          {/* Input Field */}
          <input
            id="folderName"
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Folder name..."
            className="w-full bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.04] transition-all duration-150"
            autoFocus
            disabled={isCreating}
          />
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={isCreating}
            className="flex-1 px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.04] rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !folderName.trim()}
            className="flex-1 px-4 py-2 text-sm bg-blue-500/90 hover:bg-blue-500 text-white rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isCreating ? (
              <>
                <span className="animate-spin material-icons text-sm mr-1.5">refresh</span>
                Creating...
              </>
            ) : (
              'Create Folder'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
export default CreateFolderDialog;