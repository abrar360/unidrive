import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, unlink, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const folderId = resolvedParams.id;
    
    // Validate folder ID format
    if (!folderId || !folderId.startsWith('folder_')) {
      return NextResponse.json(
        { error: 'Invalid folder ID' },
        { status: 400 }
      );
    }

    const storageDir = join(process.cwd(), 'storage');
    const foldersDir = join(storageDir, 'folders');
    const metadataDir = join(storageDir, 'metadata');
    const folderPath = join(foldersDir, `${folderId}.json`);
    
    // Check if folder exists
    if (!existsSync(folderPath)) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Read folder data
    const folderContent = await readFile(folderPath, 'utf-8');
    const folderData = JSON.parse(folderContent);

    // Get subfolders in this folder
    let subfolders = [];
    if (existsSync(foldersDir)) {
      const folderFiles = await readdir(foldersDir);
      const folderJsonFiles = folderFiles.filter(file => file.endsWith('.json'));
      
      subfolders = await Promise.all(
        folderJsonFiles.map(async (file) => {
          try {
            const filePath = join(foldersDir, file);
            const content = await readFile(filePath, 'utf-8');
            const subfolder = JSON.parse(content);
            
            // Only include folders that belong to this folder
            if (subfolder.parentFolderId === folderId) {
              return {
                id: subfolder.id,
                name: subfolder.name,
                parentFolderId: subfolder.parentFolderId,
                createdAt: subfolder.createdAt,
                modifiedAt: subfolder.modifiedAt,
                documentCount: subfolder.documentCount || 0
              };
            }
            return null;
          } catch (error) {
            console.error(`Error reading subfolder ${file}:`, error);
            return null;
          }
        })
      );
      
      subfolders = subfolders.filter(folder => folder !== null);
    }

    // Get documents in this folder
    let documents = [];
    if (existsSync(metadataDir)) {
      const metadataFiles = await readdir(metadataDir);
      const documentFiles = metadataFiles.filter(file => file.endsWith('.json'));
      
      documents = await Promise.all(
        documentFiles.map(async (file) => {
          try {
            const filePath = join(metadataDir, file);
            const content = await readFile(filePath, 'utf-8');
            const metadata = JSON.parse(content);
            
            // Only include documents that belong to this folder
            if (metadata.folderId === folderId) {
              return {
                id: metadata.id,
                title: metadata.title,
                createdAt: metadata.createdAt,
                modifiedAt: metadata.modifiedAt,
                size: metadata.size,
                type: metadata.type
              };
            }
            return null;
          } catch (error) {
            console.error(`Error reading document metadata ${file}:`, error);
            return null;
          }
        })
      );
      
      documents = documents.filter(doc => doc !== null);
    }

    // Update document count if it has changed
    if (documents.length !== folderData.documentCount) {
      folderData.documentCount = documents.length;
      folderData.modifiedAt = new Date().toISOString();
      await writeFile(folderPath, JSON.stringify(folderData, null, 2));
    }

    return NextResponse.json({
      folder: folderData,
      subfolders: subfolders.sort((a, b) => 
        new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      ),
      documents: documents.sort((a, b) => 
        new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
      )
    });
    
  } catch (error) {
    console.error('Error fetching folder:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folder' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const folderId = resolvedParams.id;
    const body = await request.json();
    
    // Validate folder ID format
    if (!folderId || !folderId.startsWith('folder_')) {
      return NextResponse.json(
        { error: 'Invalid folder ID' },
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

    const storageDir = join(process.cwd(), 'storage');
    const foldersDir = join(storageDir, 'folders');
    const folderPath = join(foldersDir, `${folderId}.json`);
    
    // Check if folder exists
    if (!existsSync(folderPath)) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Read current folder data
    const folderContent = await readFile(folderPath, 'utf-8');
    const folderData = JSON.parse(folderContent);

    // Update name if provided
    if (body.name && typeof body.name === 'string') {
      const sanitizedName = body.name
        .replace(/[<>:"/\\|?*]/g, '')
        .trim()
        .substring(0, 50);
      
      if (!sanitizedName) {
        return NextResponse.json(
          { error: 'Invalid folder name' },
          { status: 400 }
        );
      }
      
      folderData.name = sanitizedName;
      folderData.modifiedAt = new Date().toISOString();
    }

    // Save updated folder data
    await writeFile(folderPath, JSON.stringify(folderData, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Folder updated successfully',
      folder: folderData
    });
    
  } catch (error) {
    console.error('Error updating folder:', error);
    
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

async function deleteDocumentsInFolder(folderId: string): Promise<void> {
  const storageDir = join(process.cwd(), 'storage');
  const documentsDir = join(storageDir, 'documents');
  const metadataDir = join(storageDir, 'metadata');
  
  if (!existsSync(metadataDir)) {
    return;
  }

  const metadataFiles = await readdir(metadataDir);
  const documentFiles = metadataFiles.filter(file => file.endsWith('.json'));
  
  for (const file of documentFiles) {
    try {
      const filePath = join(metadataDir, file);
      const content = await readFile(filePath, 'utf-8');
      const metadata = JSON.parse(content);
      
      // Delete documents that belong to this folder
      if (metadata.folderId === folderId) {
        const documentId = metadata.id;
        
        // Delete document content file
        const documentPath = join(documentsDir, `${documentId}.json`);
        if (existsSync(documentPath)) {
          await unlink(documentPath);
        }
        
        // Delete metadata file
        await unlink(filePath);
        
        console.log(`Deleted document ${documentId} from folder ${folderId}`);
      }
    } catch (error) {
      console.error(`Error deleting document ${file}:`, error);
    }
  }
}

async function deleteSubfoldersInFolder(folderId: string): Promise<void> {
  const storageDir = join(process.cwd(), 'storage');
  const foldersDir = join(storageDir, 'folders');
  
  if (!existsSync(foldersDir)) {
    return;
  }

  const folderFiles = await readdir(foldersDir);
  const subfolderFiles = folderFiles.filter(file => file.endsWith('.json'));
  
  for (const file of subfolderFiles) {
    try {
      const filePath = join(foldersDir, file);
      const content = await readFile(filePath, 'utf-8');
      const subfolder = JSON.parse(content);
      
      // Recursively delete subfolders that belong to this folder
      if (subfolder.parentFolderId === folderId) {
        console.log(`Recursively deleting subfolder ${subfolder.id} from folder ${folderId}`);
        
        // First delete all content in the subfolder (recursive)
        await deleteDocumentsInFolder(subfolder.id);
        await deleteSubfoldersInFolder(subfolder.id);
        
        // Then delete the subfolder itself
        await unlink(filePath);
        
        console.log(`Deleted subfolder ${subfolder.id}`);
      }
    } catch (error) {
      console.error(`Error deleting subfolder ${file}:`, error);
    }
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const folderId = resolvedParams.id;
    
    // Validate folder ID format
    if (!folderId || !folderId.startsWith('folder_')) {
      return NextResponse.json(
        { error: 'Invalid folder ID' },
        { status: 400 }
      );
    }

    const storageDir = join(process.cwd(), 'storage');
    const foldersDir = join(storageDir, 'folders');
    const folderPath = join(foldersDir, `${folderId}.json`);
    
    // Check if folder exists
    if (!existsSync(folderPath)) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Recursively delete all documents in this folder
    await deleteDocumentsInFolder(folderId);
    
    // Recursively delete all subfolders in this folder
    await deleteSubfoldersInFolder(folderId);
    
    // Finally delete the folder itself
    await unlink(folderPath);

    return NextResponse.json({
      success: true,
      message: 'Folder and all contents deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting folder:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}