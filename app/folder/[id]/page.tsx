'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import FileItem from '../../../components/FileItem';
import FolderItem from '../../../components/FolderItem';
import CreateFolderDialog from '../../../components/CreateFolderDialog';
import { useToast } from '../../../components/ToastProvider';

interface Document {
  id: string;
  title: string;
  previewUrl: string;
  activity: string;
  date: string;
  type: string;
  createdAt: string;
  modifiedAt: string;
  size: number;
}

interface FolderData {
  id: string;
  name: string;
  parentFolderId?: string;
  createdAt: string;
  modifiedAt: string;
  documentCount: number;
}

interface Subfolder {
  id: string;
  name: string;
  parentFolderId: string;
  createdAt: string;
  modifiedAt: string;
  documentCount: number;
}

export default function FolderView() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.id as string;
  
  const [folder, setFolder] = useState<FolderData | null>(null);
  const [subfolders, setSubfolders] = useState<Subfolder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'dateCreated' | 'dateModified' | 'size'>('dateModified');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const { showToast } = useToast();

  const fetchFolderData = async () => {
    try {
      const response = await fetch(`/api/folders/${folderId}`);
      if (!response.ok) {
        if (response.status === 404) {
          showToast('Folder not found', 'error');
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch folder data');
      }
      const data = await response.json();
      setFolder(data.folder);
      setSubfolders(data.subfolders || []);
      
      // Add preview URLs and activity info to documents
      const documentsWithPreview = data.documents.map((doc: any) => ({
        ...doc,
        previewUrl: `/api/previews/${doc.id}.svg?t=${Date.now()}`,
        activity: 'You created',
        date: new Date(doc.modifiedAt).toLocaleDateString()
      }));
      
      setDocuments(documentsWithPreview);
    } catch (err) {
      console.error('Error fetching folder data:', err);
      showToast('Failed to load folder data', 'error');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (folderId) {
      fetchFolderData();
    }
  }, [folderId]);

  // Filter documents based on search query
  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort filtered documents
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    let aValue: string | number | Date;
    let bValue: string | number | Date;

    switch (sortBy) {
      case 'name':
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
        break;
      case 'dateCreated':
        aValue = new Date(a.createdAt);
        bValue = new Date(b.createdAt);
        break;
      case 'dateModified':
        aValue = new Date(a.modifiedAt);
        bValue = new Date(b.modifiedAt);
        break;
      case 'size':
        aValue = a.size;
        bValue = b.size;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) {
      return sortOrder === 'asc' ? -1 : 1;
    }
    if (aValue > bValue) {
      return sortOrder === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const handleDocumentDelete = (documentId: string) => {
    setDocuments(prevDocuments => 
      prevDocuments.filter(doc => doc.id !== documentId)
    );
    // Update folder document count
    if (folder) {
      setFolder({ ...folder, documentCount: folder.documentCount - 1 });
    }
  };

  const handleMoveToFolder = async (documentId: string, targetFolderId: string | null) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/move`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderId: targetFolderId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to move document');
      }

      // Remove document from current folder view
      handleDocumentDelete(documentId);
    } catch (error) {
      console.error('Error moving document:', error);
      showToast(`Failed to move document: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const handleMoveComplete = () => {
    // Refresh folder data after a document is moved
    fetchFolderData();
  };

  const handleSubfolderClick = (subfolderId: string) => {
    router.push(`/folder/${subfolderId}`);
  };

  const handleSubfolderUpdate = () => {
    fetchFolderData();
  };

  const handleSubfolderDelete = (subfolderId: string) => {
    setSubfolders(prevSubfolders => 
      prevSubfolders.filter(subfolder => subfolder.id !== subfolderId)
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-black items-center justify-center">
        <div className="text-center text-gray-500">
          Loading folder...
        </div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="flex min-h-screen bg-black items-center justify-center">
        <div className="text-center text-gray-500">
          Folder not found
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-black">
      {/* Minimal Sidebar */}
      <aside className="w-60 border-r border-white/[0.08] flex flex-col backdrop-blur-sm">
        <div className="p-5">
          {/* Logo - Simple */}
          <div className="mb-7">
            <h1 className="text-lg font-semibold text-white tracking-tight">UniDrive</h1>
          </div>

          {/* New Button - Simple */}
          <Link href="/document/create">
            <button className="btn-primary w-full mb-7 flex items-center justify-center space-x-2 py-2.5 rounded-lg shadow-sm">
              <span className="material-icons text-base">add</span>
              <span className="font-medium">New</span>
            </button>
          </Link>

          {/* Navigation - Clean */}
          <nav className="space-y-0.5">
            <Link href="/" className="nav-link">
              <span className="material-icons text-[18px] mr-3">home</span>
              Home
            </Link>
            <a href="#" className="nav-link active">
              <span className="material-icons text-[18px] mr-3">folder</span>
              My Drive
            </a>
            <a href="#" className="nav-link">
              <span className="material-icons text-[18px] mr-3">computer</span>
              Computers
            </a>
            
            <div className="h-px bg-white/[0.06] my-3"></div>
            
            <a href="#" className="nav-link">
              <span className="material-icons text-[18px] mr-3">people</span>
              Shared with me
            </a>
            <a href="#" className="nav-link">
              <span className="material-icons text-[18px] mr-3">schedule</span>
              Recent
            </a>
            <a href="#" className="nav-link">
              <span className="material-icons text-[18px] mr-3">star_border</span>
              Starred
            </a>
            
            <div className="h-px bg-white/[0.06] my-3"></div>
            
            <a href="#" className="nav-link">
              <span className="material-icons text-[18px] mr-3">delete</span>
              Trash
            </a>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-white/[0.08] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Back button */}
              <Link 
                href="/"
                className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all duration-200"
              >
                <span className="material-icons text-[20px]">arrow_back</span>
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-white tracking-tight flex items-center space-x-2">
                  <span className="material-icons text-blue-400">folder</span>
                  <span>{folder.name}</span>
                </h1>
                <p className="text-gray-400 text-sm mt-0.5 font-light">
                  {folder.documentCount === 0 ? 'Empty folder' : folder.documentCount === 1 ? '1 document' : `${folder.documentCount} documents`}
                </p>
              </div>
            </div>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-white/[0.05] rounded-lg transition-all duration-200">
              <span className="material-icons text-[20px]">settings</span>
            </button>
          </div>
        </header>

        {/* Search and Content */}
        <div className="flex-1 p-6">
          {/* Search */}
          <div className="mb-8">
            <div className="relative">
              <span className="material-icons absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">search</span>
              <input
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-12 pr-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-white/[0.15] focus:bg-white/[0.06] transition-all duration-200"
                placeholder="Search in folder"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filters and Sort */}
          <div className="flex items-center space-x-3 mb-8">
            <button className="px-4 py-2 bg-white/[0.04] border border-white/[0.08] text-gray-300 text-sm rounded-lg hover:border-white/[0.15] hover:bg-white/[0.06] transition-all duration-200 backdrop-blur-sm flex items-center space-x-2">
              <span>Type</span>
              <span className="material-icons text-sm">keyboard_arrow_down</span>
            </button>
            <button className="px-4 py-2 bg-white/[0.04] border border-white/[0.08] text-gray-300 text-sm rounded-lg hover:border-white/[0.15] hover:bg-white/[0.06] transition-all duration-200 backdrop-blur-sm flex items-center space-x-2">
              <span>People</span>
              <span className="material-icons text-sm">keyboard_arrow_down</span>
            </button>
            <div className="relative group">
              <button
                className="px-4 py-2 bg-white/[0.04] border border-white/[0.08] text-gray-300 text-sm rounded-lg hover:border-white/[0.15] hover:bg-white/[0.06] transition-all duration-200 backdrop-blur-sm flex items-center space-x-2"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <span>
                  {sortBy === 'name' && 'Name'}
                  {sortBy === 'dateCreated' && 'Date created'}
                  {sortBy === 'dateModified' && 'Date modified'}
                  {sortBy === 'size' && 'Size'}
                </span>
                <span className="material-icons text-sm">
                  {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                </span>
              </button>
              <div className="absolute top-full left-0 mt-1 w-48 bg-white/[0.04] border border-white/[0.08] rounded-lg shadow-lg z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 backdrop-blur-sm">
                <button
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/5 ${sortBy === 'name' ? 'text-white' : 'text-gray-400'}`}
                  onClick={() => setSortBy('name')}
                >
                  Name
                </button>
                <button
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/5 ${sortBy === 'dateCreated' ? 'text-white' : 'text-gray-400'}`}
                  onClick={() => setSortBy('dateCreated')}
                >
                  Date created
                </button>
                <button
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/5 ${sortBy === 'dateModified' ? 'text-white' : 'text-gray-400'}`}
                  onClick={() => setSortBy('dateModified')}
                >
                  Date modified
                </button>
                <button
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-white/5 ${sortBy === 'size' ? 'text-white' : 'text-gray-400'}`}
                  onClick={() => setSortBy('size')}
                >
                  Size
                </button>
              </div>
            </div>
          </div>

          {/* Folders */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-300">Folders</h2>
              <button 
                onClick={() => setShowCreateFolderDialog(true)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors duration-200 flex items-center space-x-1"
              >
                <span className="material-icons text-sm">add</span>
                <span className="font-medium">New Folder</span>
              </button>
            </div>
            {subfolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="material-icons text-3xl text-gray-600 mb-2">folder</span>
                <p className="text-xs text-gray-500 font-light">No subfolders yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subfolders.map((subfolder, index) => (
                  <div
                    key={subfolder.id}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <FolderItem
                      id={subfolder.id}
                      name={subfolder.name}
                      createdAt={subfolder.createdAt}
                      modifiedAt={subfolder.modifiedAt}
                      documentCount={subfolder.documentCount}
                      onFolderClick={handleSubfolderClick}
                      onFolderUpdate={handleSubfolderUpdate}
                      onFolderDelete={handleSubfolderDelete}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Documents */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-300">Documents</h2>
              <div className="flex items-center gap-0.5">
                <button className="p-1 text-gray-600 hover:text-gray-400 transition-colors duration-200">
                  <span className="material-icons text-[16px]">view_list</span>
                </button>
                <button className="p-1 text-gray-400 transition-colors duration-200">
                  <span className="material-icons text-[16px]">grid_view</span>
                </button>
              </div>
            </div>
            {searchQuery && filteredDocuments.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <span className="material-icons text-4xl mb-4">search_off</span>
                <p className="text-lg">No results found for "{searchQuery}"</p>
                <p className="text-sm mt-2">Try different keywords or check your spelling</p>
              </div>
            ) : sortedDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="material-icons text-4xl text-gray-600 mb-3">description</span>
                <p className="text-xs text-gray-500 font-light mb-5">No documents in this folder yet</p>
                <div className="flex items-center space-x-2">
                  <Link 
                    href={`/document/create?folderId=${folderId}`}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.07] text-gray-400 hover:text-gray-300 rounded-lg transition-all duration-200"
                  >
                    <span className="material-icons text-sm">add</span>
                    <span className="text-xs font-medium">Create Document</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 auto-rows-max">
                {sortedDocuments.map((file, index) => (
                  <div
                    key={file.id}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <FileItem
                      id={file.id}
                      icon="article"
                      title={file.title}
                      previewUrl={file.previewUrl}
                      activity={file.activity}
                      date={file.date}
                      createdAt={file.createdAt}
                      modifiedAt={file.modifiedAt}
                      size={file.size}
                      folderId={folderId}
                      onDelete={handleDocumentDelete}
                      onMoved={handleMoveComplete}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <CreateFolderDialog
        isOpen={showCreateFolderDialog}
        onClose={() => setShowCreateFolderDialog(false)}
        parentFolderId={folderId}
        onFolderCreated={() => {
          // Refresh folder data after creating a new folder
          fetchFolderData();
        }}
      />
    </div>
  );
}