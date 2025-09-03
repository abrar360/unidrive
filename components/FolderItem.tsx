import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from './ToastProvider';

interface FolderItemProps {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  documentCount: number;
  onFolderClick?: (folderId: string) => void;
  onFolderUpdate?: () => void;
  onFolderDelete?: (folderId: string) => void;
}

const FolderItem: React.FC<FolderItemProps> = ({
  id,
  name,
  createdAt,
  modifiedAt,
  documentCount,
  onFolderClick,
  onFolderUpdate,
  onFolderDelete
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(name);
  const [isHovered, setIsHovered] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);
  const { showToast } = useToast();

  // Track when component is mounted (client-side)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Format date to readable format (e.g., "Jan 1, 2024")
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleFolderClick = () => {
    if (!isRenaming && onFolderClick) {
      onFolderClick(id);
    }
  };

  const handleDeleteClick = async () => {
    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete folder');
      }
      
      if (onFolderDelete) {
        onFolderDelete(id);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      showToast(`Failed to delete folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
    
    setShowDeleteDialog(false);
    setShowMenu(false);
  };

  const handleRenameClick = () => {
    setIsRenaming(true);
    setNewName(name);
    setShowMenu(false);
  };

  const handleRenameSave = async () => {
    if (newName.trim() === name) {
      setIsRenaming(false);
      return;
    }
    
    const trimmedName = newName.trim();
    if (!trimmedName) {
      showToast('Folder name cannot be empty', 'error');
      return;
    }
    
    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: trimmedName }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rename folder');
      }
      
      if (onFolderUpdate) {
        onFolderUpdate();
      }
    } catch (error) {
      console.error('Error renaming folder:', error);
      showToast(`Failed to rename folder: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
    
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setNewName(name);
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSave();
    } else if (e.key === 'Escape') {
      handleRenameCancel();
    }
  };

  return (
    <div 
      className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 hover:border-white/[0.15] hover:bg-white/[0.06] transition-all duration-200 cursor-pointer backdrop-blur-sm group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowMenu(false);
      }}
      onClick={handleFolderClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <span className="material-icons text-gray-400 text-[20px] flex-shrink-0">folder</span>
          {isRenaming ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRenameSave}
              onKeyDown={handleRenameKeyDown}
              className="text-white font-medium text-sm bg-white/[0.05] border border-blue-500/50 rounded-lg px-2.5 py-1.5 flex-1 focus:outline-none focus:border-blue-400 focus:bg-blue-500/10 transition-all selection:bg-blue-500/30"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex-1 min-w-0">
              <span className="text-white font-medium text-sm truncate block">{name}</span>
              <span className="text-gray-500 text-xs">
                {documentCount === 0 ? 'Empty' : documentCount === 1 ? '1 document' : `${documentCount} documents`} • {formatDate(modifiedAt)}
              </span>
            </div>
          )}
        </div>
        {!isRenaming && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              
              // Get button position for proper menu positioning
              const rect = e.currentTarget.getBoundingClientRect();
              const menuWidth = 160;
              const menuHeight = 80;
              
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
            className={`p-1 hover:bg-white/[0.08] rounded-md transition-all duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'} flex-shrink-0`}
          >
            <span className="material-icons text-[16px] text-gray-500 hover:text-white">more_vert</span>
          </button>
        )}
      </div>

      {/* Context Menu - Portal to body to avoid parent overflow clipping */}
      {showMenu && isMounted && createPortal(
        <div 
          className="fixed z-50 bg-white/[0.04] backdrop-blur-sm border border-white/[0.08] rounded-2xl shadow-2xl min-w-44 py-2 overflow-hidden"
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
            className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-all duration-200 ease-out flex items-center space-x-3"
          >
            <span className="material-icons text-base text-blue-400/90">edit</span>
            <span className="font-medium tracking-tight">Rename</span>
          </button>
          <div className="border-t border-white/[0.04] my-1.5"></div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeleteDialog(true);
              setShowMenu(false);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/[0.06] transition-all duration-200 ease-out flex items-center space-x-3"
          >
            <span className="material-icons text-base text-red-400/90">delete</span>
            <span className="font-medium tracking-tight">Delete</span>
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
          <h3 className="text-lg font-medium text-white">Delete Folder</h3>
        </div>
        <p className="text-gray-400 text-sm leading-relaxed">
          Are you sure you want to delete <span className="text-white/80">"{name}"</span>? 
          {documentCount > 0 ? (
            <span className="block mt-2 text-yellow-400/80 text-sm">
              This folder contains {documentCount} document{documentCount === 1 ? '' : 's'}. All contents will be permanently deleted.
            </span>
          ) : (
            <span>This action cannot be undone.</span>
          )}
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
          {documentCount > 0 ? 'Delete All' : 'Delete'}
        </button>
      </div>
    </div>
  </div>,
  document.body
)}
    </div>
  );
};

export default FolderItem;