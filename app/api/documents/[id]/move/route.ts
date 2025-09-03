import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const documentId = resolvedParams.id;
    const body = await request.json();
    
    // Validate document ID format
    if (!documentId || !documentId.startsWith('doc_')) {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    // Validate request body
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const folderId = body.folderId; // Can be null to move to root

    // If folderId is provided, validate it exists
    if (folderId !== null && folderId !== undefined) {
      if (typeof folderId !== 'string' || !folderId.startsWith('folder_')) {
        return NextResponse.json(
          { error: 'Invalid folder ID' },
          { status: 400 }
        );
      }

      const storageDir = join(process.cwd(), 'storage');
      const foldersDir = join(storageDir, 'folders');
      const folderPath = join(foldersDir, `${folderId}.json`);
      
      if (!existsSync(folderPath)) {
        return NextResponse.json(
          { error: 'Target folder not found' },
          { status: 404 }
        );
      }
    }

    const storageDir = join(process.cwd(), 'storage');
    const metadataDir = join(storageDir, 'metadata');
    const metadataPath = join(metadataDir, `${documentId}.json`);
    
    // Check if document exists
    if (!existsSync(metadataPath)) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Read current document metadata
    const metadataContent = await readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);
    
    // Get the old folder ID for updating counts
    const oldFolderId = metadata.folderId;

    // Update the document metadata
    if (folderId === null || folderId === undefined) {
      // Moving to root - remove folderId
      delete metadata.folderId;
    } else {
      // Moving to a folder
      metadata.folderId = folderId;
    }
    
    metadata.modifiedAt = new Date().toISOString();

    // Save updated metadata
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Update folder document counts
    await updateFolderCounts(oldFolderId, folderId);

    return NextResponse.json({
      success: true,
      message: 'Document moved successfully',
      document: metadata
    });
    
  } catch (error) {
    console.error('Error moving document:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to update folder document counts
async function updateFolderCounts(oldFolderId: string | undefined, newFolderId: string | null | undefined) {
  const storageDir = join(process.cwd(), 'storage');
  const foldersDir = join(storageDir, 'folders');
  const metadataDir = join(storageDir, 'metadata');

  // Count documents in each folder
  const folderCounts = new Map<string, number>();
  
  if (existsSync(metadataDir)) {
    const metadataFiles = await readdir(metadataDir);
    const documentFiles = metadataFiles.filter(file => file.endsWith('.json'));
    
    for (const file of documentFiles) {
      try {
        const filePath = join(metadataDir, file);
        const content = await readFile(filePath, 'utf-8');
        const metadata = JSON.parse(content);
        
        if (metadata.folderId) {
          const count = folderCounts.get(metadata.folderId) || 0;
          folderCounts.set(metadata.folderId, count + 1);
        }
      } catch (error) {
        console.error(`Error reading document metadata ${file}:`, error);
      }
    }
  }

  // Update folder counts for affected folders
  const foldersToUpdate = [oldFolderId, newFolderId].filter(
    id => id && typeof id === 'string' && id.startsWith('folder_')
  ) as string[];

  for (const folderId of foldersToUpdate) {
    const folderPath = join(foldersDir, `${folderId}.json`);
    
    if (existsSync(folderPath)) {
      try {
        const folderContent = await readFile(folderPath, 'utf-8');
        const folderData = JSON.parse(folderContent);
        
        folderData.documentCount = folderCounts.get(folderId) || 0;
        folderData.modifiedAt = new Date().toISOString();
        
        await writeFile(folderPath, JSON.stringify(folderData, null, 2));
      } catch (error) {
        console.error(`Error updating folder count for ${folderId}:`, error);
      }
    }
  }
}