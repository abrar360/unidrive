import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useToast } from './ToastProvider';
import MoveToFolderDialog from './MoveToFolderDialog';

interface FileItemProps {
  icon: string;
  title: string;
  previewUrl: string;
  activity: string;
  date: string;
  id?: string;
  createdAt?: string;
  modifiedAt?: string;
  size?: number;
  onDelete?: (id: string) => void;
}

const FileItem: React.FC<FileItemProps> = ({
  icon,
  title,
  previewUrl,
  activity,
  date,
  id,
  createdAt,
  modifiedAt,
  size,
  folderId,
  onDelete,
  onMoved
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(title);
  const [isHovered, setIsHovered] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [imageKey, setImageKey] = useState(0); // For forcing image reload
  const [isMounted, setIsMounted] = useState(false);
  const { showToast } = useToast();

  // Track when component is mounted (client-side)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Listen for document updates to refresh thumbnail
  useEffect(() => {
    const handleDocumentUpdate = (event: any) => {
      const { documentId } = event.detail;
      if (documentId === id) {
        // Force image reload by updating the key
        setImageKey(prev => prev + 1);
      }
    };

    window.addEventListener('document-updated', handleDocumentUpdate);
    return () => {
      window.removeEventListener('document-updated', handleDocumentUpdate);
    };
  }, [id]);

  // Format file size from bytes to human readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date to readable format (e.g., "Jan 1, 2024")
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Check if this is a document type that should be clickable
  const isDocument = icon === 'article' || icon === 'description';
  const documentId = id || `doc-${Math.random().toString(36).substr(2, 9)}`;

  const handleDeleteClick = async () => {
    if (!documentId || !id) return;
    
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }
      
      if (onDelete) {
        onDelete(documentId);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      showToast(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
    
    setShowDeleteDialog(false);
    setShowMenu(false);
  };

  const handleRenameClick = () => {
    setIsRenaming(true);
    setNewTitle(title);
    setShowMenu(false);
  };

  const handleRenameSave = async () => {
    if (!documentId || !id || newTitle.trim() === title) {
      setIsRenaming(false);
      return;
    }
    
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      showToast('Title cannot be empty', 'error');
      return;
    }
    
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: trimmedTitle }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rename document');
      }
      
      // Force page refresh to update the title in the list
      window.location.reload();
    } catch (error) {
      console.error('Error renaming document:', error);
      showToast(`Failed to rename document: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
    
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setNewTitle(title);
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSave();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  const handleDuplicateClick = async () => {
    if (!documentId || !id) return;
    
    try {
      // First, get the current document data
      const getResponse = await fetch(`/api/documents/${documentId}`);
      if (!getResponse.ok) {
        throw new Error('Failed to fetch document data');
      }
      
      const documentData = await getResponse.json();
      
      // Create a duplicate with a new title
      const duplicateTitle = `${documentData.title} (Copy)`;
      
      const createResponse = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: duplicateTitle,
          content: documentData.content || {},
        }),
      });
      
      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Failed to duplicate document');
      }
      
      // Refresh the page to show the new duplicate
      window.location.reload();
    } catch (error) {
      console.error('Error duplicating document:', error);
      showToast(`Failed to duplicate document: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
    
    setShowMenu(false);
  };

  const handleMoveClick = () => {
    setShowMoveDialog(true);
    setShowMenu(false);
  };

  const handleMoveComplete = () => {
    if (onMoved) {
      onMoved();
    }
  };

  const content = (
    <div 
      className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden group relative backdrop-blur-sm hover:border-white/[0.15] hover:bg-white/[0.06] transition-all duration-300 ease-out"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
    >
      {/* Clickable content area */}
      <div className="cursor-pointer" onClick={isDocument ? () => window.location.href = `/document/${documentId}` : undefined}>
        {/* Preview Image */}
        <div className="h-36 bg-gradient-to-br from-gray-900/50 to-black/80 overflow-hidden relative">
          <img 
            key={`${id}-${imageKey}`}
            alt={title}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300 ease-out" 
            src={previewUrl} 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"></div>
        </div>

        {/* Content */}
        <div className="p-4 bg-white/[0.02] border-t border-white/[0.04] relative">
          {/* Title with icon and menu */}
          <div className="flex items-start space-x-2.5 mb-2">
            <span className="material-icons text-sm text-blue-400/90 mt-0.5 flex-shrink-0">
              {icon}
            </span>
            {isRenaming ? (
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onBlur={handleRenameSave}
                onKeyDown={handleRenameKeyDown}
                className="text-sm font-medium text-white bg-white/[0.05] border border-blue-500/50 rounded-lg px-2.5 py-1.5 flex-1 focus:outline-none focus:border-blue-400 focus:bg-blue-500/10 transition-all selection:bg-blue-500/30"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <p className="text-sm font-medium text-white truncate flex-1 leading-tight tracking-tight">
                {title}
              </p>
            )}
            {isDocument && !isRenaming && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Get button position for proper menu positioning
                  const rect = e.currentTarget.getBoundingClientRect();
                  const menuWidth = 160;
                  const menuHeight = 120;
                  
                  // Calculate position relative to button
                  let x = rect.right - menuWidth;
                  let y = rect.bottom + 4;
                  
                  // Ensure menu stays within viewport
                  const viewportWidth = window.innerWidth;
                  const viewportHeight = window.innerHeight;
                  
                  // Adjust x if menu goes off right edge
                  if (x + menuWidth > viewportWidth - 20) {
                    x = viewportWidth - menuWidth - 20;
                  }
                  
                  // Adjust x if menu goes off left edge
                  if (x < 20) {
                    x = 20;
                  }
                  
                  // Adjust y if menu goes off bottom edge
                  if (y + menuHeight > viewportHeight - 20) {
                    y = rect.top - menuHeight - 4; // Show above button instead
                  }
                  
                  
                  setMenuPosition({ x, y });
                  setShowMenu(!showMenu);
                }}
                className={`p-1 hover:bg-white/[0.08] rounded-md transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'} z-20 flex-shrink-0`}
              >
                <span className="material-icons text-sm text-gray-400 hover:text-white">more_vert</span>
              </button>
            )}
          </div>
          
          {/* Metadata */}
          <div className="flex items-center justify-between text-xs">
            <span className="truncate mr-2 text-gray-500 font-light">{activity}</span>
            <span className="text-gray-600 flex-shrink-0 font-light">{date}</span>
          </div>
        </div>
      </div>

      {/* Context Menu - Portal to body to avoid parent overflow clipping */}
      {showMenu && isDocument && isMounted && createPortal(
        <div 
          className="fixed z-50 bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-lg shadow-xl min-w-40 py-1 overflow-hidden"
          style={{
            left: `${menuPosition.x}px`,
            top: `${menuPosition.y}px`,
          }}
          onMouseLeave={() => setShowMenu(false)}
        >
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleRenameClick();
            }}
            className="w-full text-left px-3.5 py-2 text-sm text-white/90 hover:bg-white/[0.05] transition-colors duration-150 flex items-center space-x-2.5"
          >
            <span className="material-icons text-sm text-gray-400">edit</span>
            <span>Rename</span>
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDuplicateClick();
            }}
            className="w-full text-left px-3.5 py-2 text-sm text-white/90 hover:bg-white/[0.05] transition-colors duration-150 flex items-center space-x-2.5"
          >
            <span className="material-icons text-sm text-gray-400">content_copy</span>
            <span>Duplicate</span>
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleMoveClick();
            }}
            className="w-full text-left px-3.5 py-2 text-sm text-white/90 hover:bg-white/[0.05] transition-colors duration-150 flex items-center space-x-2.5"
          >
            <span className="material-icons text-sm text-gray-400">drive_file_move</span>
            <span>Move to...</span>
          </button>
          <div className="border-t border-white/[0.04] my-1"></div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeleteDialog(true);
              setShowMenu(false);
            }}
            className="w-full text-left px-3.5 py-2 text-sm text-white/90 hover:bg-white/[0.05] transition-colors duration-150 flex items-center space-x-2.5"
          >
            <span className="material-icons text-sm text-red-400/80">delete</span>
            <span>Delete</span>
          </button>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Dialog - Portal to body to ensure proper positioning */}
      {showDeleteDialog && isMounted && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-xl w-full max-w-[380px] mx-4 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center space-x-2.5 mb-3">
                <span className="material-icons text-lg text-red-400/80">delete_outline</span>
                <h3 className="text-lg font-medium text-white">Delete Document</h3>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Are you sure you want to delete <span className="text-white/80">"{title}"</span>? This action cannot be undone.
              </p>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDeleteDialog(false);
                }}
                className="flex-1 px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.04] rounded-lg transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteClick();
                }}
                className="flex-1 px-4 py-2 text-sm bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors duration-150"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Move to Folder Dialog */}
      {showMoveDialog && (
        <MoveToFolderDialog
          isOpen={showMoveDialog}
          documentId={documentId}
          documentTitle={title}
          currentFolderId={folderId}
          onClose={() => setShowMoveDialog(false)}
          onMoved={handleMoveComplete}
        />
      )}
    </div>
  );

  return content;
};

export default FileItem;