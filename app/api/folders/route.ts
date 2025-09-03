import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Generate a unique folder ID using timestamp + random string
function generateFolderId(): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `folder_${timestamp}_${randomString}`;
}

export async function GET() {
  try {
    const storageDir = join(process.cwd(), 'storage');
    const foldersDir = join(storageDir, 'folders');
    
    // Check if folders directory exists
    if (!existsSync(foldersDir)) {
      // Create default folders if none exist
      await createDefaultFolders();
    }
    
    // Read all folder files
    const files = await readdir(foldersDir);
    const folderFiles = files.filter(file => file.endsWith('.json'));
    
    // Read metadata for each folder
    const folders = await Promise.all(
      folderFiles.map(async (file) => {
        try {
          const filePath = join(foldersDir, file);
          const content = await readFile(filePath, 'utf-8');
          const folderData = JSON.parse(content);
          
          return {
            id: folderData.id,
            name: folderData.name,
            parentFolderId: folderData.parentFolderId || null,
            createdAt: folderData.createdAt,
            modifiedAt: folderData.modifiedAt,
            documentCount: folderData.documentCount || 0
          };
        } catch (error) {
          console.error(`Error reading folder file ${file}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any failed reads, only include root-level folders (no parent), and sort by created date
    const validFolders = folders
      .filter(folder => folder !== null && !folder.parentFolderId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    return NextResponse.json({ folders: validFolders });
    
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Validate name
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Folder name is required and must be a string' },
        { status: 400 }
      );
    }

    // Sanitize name to prevent file system issues
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
    
    // Generate unique folder ID
    const folderId = generateFolderId();
    
    // Ensure storage directories exist
    const storageDir = join(process.cwd(), 'storage');
    const foldersDir = join(storageDir, 'folders');
    
    if (!existsSync(foldersDir)) {
      await mkdir(foldersDir, { recursive: true });
    }
    
    // Prepare folder data
    const folderData = {
      id: folderId,
      name: sanitizedName,
      parentFolderId: body.parentFolderId || null,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      documentCount: 0
    };

    // Write folder data to file
    const folderPath = join(foldersDir, `${folderId}.json`);

    try {
      await writeFile(folderPath, JSON.stringify(folderData, null, 2));
    } catch (fileError) {
      console.error('File write error:', fileError);
      return NextResponse.json(
        { error: 'Failed to save folder to file system' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Folder created successfully',
      folder: folderData
    });
    
  } catch (error) {
    console.error('Folder creation error:', error);
    
    // Handle JSON parsing errors specifically
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

// Helper function to create default folders
async function createDefaultFolders() {
  const storageDir = join(process.cwd(), 'storage');
  const foldersDir = join(storageDir, 'folders');
  
  if (!existsSync(foldersDir)) {
    await mkdir(foldersDir, { recursive: true });
  }

  const defaultFolders = [
    { name: 'Notes' },
    { name: 'Journal' }
  ];

  for (const folder of defaultFolders) {
    const folderId = generateFolderId();
    const folderData = {
      id: folderId,
      name: folder.name,
      parentFolderId: null,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      documentCount: 0
    };

    const folderPath = join(foldersDir, `${folderId}.json`);
    await writeFile(folderPath, JSON.stringify(folderData, null, 2));
  }
}