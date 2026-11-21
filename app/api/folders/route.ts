import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { countDocumentsByFolder } from '../../../utils/folder-counts';
import { isValidFolderId } from '../../../utils/ids';

// Generate a unique folder ID using timestamp + random string
function generateFolderId(): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `folder_${timestamp}_${randomString}`;
}

// GET /api/folders          -> top-level folders (home page)
// GET /api/folders?all=true -> every folder, including subfolders, each with
//                              its parentFolderId (used by "Move to...")
export async function GET(request: NextRequest) {
  try {
    const includeSubfolders = request.nextUrl.searchParams.get('all') === 'true';
    const storageDir = join(process.cwd(), 'storage');
    const foldersDir = join(storageDir, 'folders');

    // First run: create the default folders exactly once
    await ensureDefaultFolders();

    // Read all folder files, and count documents live from their metadata
    const [files, documentCounts] = await Promise.all([
      readdir(foldersDir),
      countDocumentsByFolder(),
    ]);
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
            documentCount: documentCounts.get(folderData.id) || 0
          };
        } catch (error) {
          console.error(`Error reading folder file ${file}:`, error);
          return null;
        }
      })
    );

    // Filter out failed reads and (unless ?all=true) subfolders; sort by created date
    const validFolders = folders
      .filter(folder => folder !== null && (includeSubfolders || !folder.parentFolderId))
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
    
    // Optional parent folder: must be a valid ID of an existing folder,
    // otherwise the new folder would be orphaned (listed nowhere)
    let parentFolderId: string | null = null;
    if (body.parentFolderId !== undefined && body.parentFolderId !== null && body.parentFolderId !== '') {
      if (!isValidFolderId(body.parentFolderId)) {
        return NextResponse.json(
          { error: 'Invalid parent folder ID' },
          { status: 400 }
        );
      }
      if (!existsSync(join(process.cwd(), 'storage', 'folders', `${body.parentFolderId}.json`))) {
        return NextResponse.json(
          { error: 'Parent folder not found' },
          { status: 404 }
        );
      }
      parentFolderId = body.parentFolderId;
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
      parentFolderId,
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

// In-flight first-run setup, shared by concurrent requests in this process
let defaultFoldersSetup: Promise<void> | null = null;

// Create the default folders the first time the folders directory is needed.
// Two first loads at once (e.g. React Strict Mode's double fetch, or two tabs)
// used to both see "no folders directory" and create the defaults twice.
function ensureDefaultFolders(): Promise<void> {
  const foldersDir = join(process.cwd(), 'storage', 'folders');
  if (existsSync(foldersDir) && !defaultFoldersSetup) {
    return Promise.resolve();
  }
  if (!defaultFoldersSetup) {
    defaultFoldersSetup = (async () => {
      await mkdir(join(process.cwd(), 'storage'), { recursive: true });
      try {
        // Non-recursive mkdir is atomic: only one caller can create the
        // directory, and only that caller writes the default folders
        await mkdir(foldersDir);
      } catch (error: any) {
        if (error?.code === 'EEXIST') return;
        throw error;
      }
      await createDefaultFolders(foldersDir);
    })().catch((error) => {
      // Allow a retry on the next request
      defaultFoldersSetup = null;
      throw error;
    });
  }
  return defaultFoldersSetup;
}

// Write the default folders into a freshly created folders directory
async function createDefaultFolders(foldersDir: string) {
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