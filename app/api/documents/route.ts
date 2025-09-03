import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { previewGenerator } from '../../../utils/preview-generator';

// Generate a unique document ID using timestamp + random string
function generateDocumentId(): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  return `doc_${timestamp}_${randomString}`;
}

export async function GET() {
  try {
    const storageDir = join(process.cwd(), 'storage');
    const metadataDir = join(storageDir, 'metadata');
    
    // Check if metadata directory exists
    if (!existsSync(metadataDir)) {
      return NextResponse.json({ documents: [] });
    }
    
    // Read all metadata files
    const files = await readdir(metadataDir);
    const documentFiles = files.filter(file => file.endsWith('.json'));
    
    // Read metadata for each document
    const documents = await Promise.all(
      documentFiles.map(async (file) => {
        try {
          const filePath = join(metadataDir, file);
          const content = await readFile(filePath, 'utf-8');
          const metadata = JSON.parse(content);
          
          return {
            id: metadata.id,
            title: metadata.title,
            createdAt: metadata.createdAt,
            modifiedAt: metadata.modifiedAt,
            size: metadata.size,
            type: metadata.type,
            folderId: metadata.folderId, // Include folderId for filtering moved documents
            previewUrl: await previewGenerator.getPreviewUrl(metadata.id),
            activity: 'You created',
            date: new Date(metadata.modifiedAt).toLocaleDateString()
          };
        } catch (error) {
          console.error(`Error reading metadata file ${file}:`, error);
          return null;
        }
      })
    );
    
    // Filter out any failed reads and sort by modified date
    const validDocuments = documents
      .filter(doc => doc !== null)
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    
    return NextResponse.json({ documents: validDocuments });
    
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    
    // Basic validation
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Validate title if provided
    if (body.title && typeof body.title !== 'string') {
      return NextResponse.json(
        { error: 'Title must be a string' },
        { status: 400 }
      );
    }

    // Sanitize title to prevent file system issues
    const sanitizedTitle = body.title
      ? body.title.replace(/[<>:"/\\|?*]/g, '').trim().substring(0, 100)
      : 'Untitled Document';
    
    // Generate unique document ID
    const documentId = generateDocumentId();
    
    // Ensure storage directories exist
    const storageDir = join(process.cwd(), 'storage');
    const documentsDir = join(storageDir, 'documents');
    const metadataDir = join(storageDir, 'metadata');
    
    if (!existsSync(documentsDir)) {
      await mkdir(documentsDir, { recursive: true });
    }
    if (!existsSync(metadataDir)) {
      await mkdir(metadataDir, { recursive: true });
    }
    
    // Prepare document data with default structure if not provided
    const documentData = {
      id: documentId,
      title: sanitizedTitle,
      content: body.content || {
        body: {
          dataStream: '',
          textRuns: [],
          paragraphs: [{ startIndex: 0 }],
        },
        documentStyle: {
          pageSize: { width: 595, height: 842 },
          marginTop: 72,
          marginBottom: 72,
          marginRight: 90,
          marginLeft: 90,
        },
      },
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
    };

    // Prepare metadata
    const metadata = {
      id: documentId,
      title: documentData.title,
      createdAt: documentData.createdAt,
      modifiedAt: documentData.modifiedAt,
      size: JSON.stringify(documentData).length,
      type: 'document',
    };

    // Write document data and metadata to files
    const documentPath = join(documentsDir, `${documentId}.json`);
    const metadataPath = join(metadataDir, `${documentId}.json`);

    try {
      await writeFile(documentPath, JSON.stringify(documentData, null, 2));
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      // Generate preview in background (don't await to keep API fast)
      previewGenerator.generatePreview(documentId, documentData.content).catch(error => {
        console.error('Preview generation error:', error);
      });
    } catch (fileError) {
      console.error('File write error:', fileError);
      return NextResponse.json(
        { error: 'Failed to save document to file system' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Document saved successfully',
      documentId: documentId,
      title: documentData.title,
      filePath: documentPath
    });
    
  } catch (error) {
    console.error('Document creation error:', error);
    
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