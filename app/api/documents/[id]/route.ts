import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { previewGenerator } from '../../../../utils/preview-generator';

// GET method to retrieve a specific document by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    
    // Validate document ID format
    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    const storageDir = join(process.cwd(), 'storage');
    const documentsDir = join(storageDir, 'documents');
    const documentPath = join(documentsDir, `${documentId}.json`);

    // Check if document file exists
    if (!existsSync(documentPath)) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Read and parse the document file
    const fileContent = await readFile(documentPath, 'utf-8');
    const documentData = JSON.parse(fileContent);

    return NextResponse.json(documentData);

  } catch (error) {
    console.error('Error fetching document:', error);
    
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Corrupted document file' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT method to update a document's content and metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    
    // Validate document ID format
    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

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

    const storageDir = join(process.cwd(), 'storage');
    const documentsDir = join(storageDir, 'documents');
    const metadataDir = join(storageDir, 'metadata');
    const documentPath = join(documentsDir, `${documentId}.json`);
    const metadataPath = join(metadataDir, `${documentId}.json`);

    // Check if document file exists
    if (!existsSync(documentPath)) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Read existing document data
    const fileContent = await readFile(documentPath, 'utf-8');
    const existingDocument = JSON.parse(fileContent);

    // Prepare updated document data
    const updatedDocument = {
      ...existingDocument,
      title: sanitizedTitle,
      content: body.content || existingDocument.content,
      modifiedAt: new Date().toISOString()
    };

    // Prepare updated metadata
    const updatedMetadata = {
      id: documentId,
      title: sanitizedTitle,
      createdAt: existingDocument.createdAt,
      modifiedAt: updatedDocument.modifiedAt,
      size: JSON.stringify(updatedDocument).length,
      type: 'document',
    };

    // Write updated document and metadata to files
    await writeFile(documentPath, JSON.stringify(updatedDocument, null, 2));
    await writeFile(metadataPath, JSON.stringify(updatedMetadata, null, 2));
    
    // Regenerate preview in background if content was updated
    if (body.content) {
      previewGenerator.generatePreview(documentId, body.content).catch(error => {
        console.error('Preview regeneration error:', error);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Document updated successfully',
      documentId: documentId,
      title: sanitizedTitle,
      modifiedAt: updatedDocument.modifiedAt
    });

  } catch (error) {
    console.error('Document update error:', error);
    
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

// DELETE method to remove a document (for future use)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    
    // Validate document ID format
    if (!documentId || typeof documentId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid document ID' },
        { status: 400 }
      );
    }

    const storageDir = join(process.cwd(), 'storage');
    const documentsDir = join(storageDir, 'documents');
    const metadataDir = join(storageDir, 'metadata');
    const documentPath = join(documentsDir, `${documentId}.json`);
    const metadataPath = join(metadataDir, `${documentId}.json`);

    // Check if document file exists
    if (!existsSync(documentPath)) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete document and metadata files
    await unlink(documentPath);
    await unlink(metadataPath);
    
    // Delete preview file if it exists
    const previewPath = join(process.cwd(), 'storage', 'previews', `${documentId}.png`);
    if (existsSync(previewPath)) {
      await unlink(previewPath).catch(error => {
        console.error('Preview deletion error:', error);
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
      documentId: documentId
    });

  } catch (error) {
    console.error('Document deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}