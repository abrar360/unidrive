import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { isValidDocumentId } from '../../../../utils/ids';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Only "<documentId>.svg" / "<documentId>.png": prevents directory traversal
    const match = typeof filename === 'string' ? filename.match(/^(.+)\.(svg|png)$/) : null;
    if (!match || !isValidDocumentId(match[1])) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    const previewPath = join(process.cwd(), 'storage', 'previews', filename);
    
    if (!existsSync(previewPath)) {
      return NextResponse.json(
        { error: 'Preview not found' },
        { status: 404 }
      );
    }

    const fileBuffer = await readFile(previewPath);
    const contentType = filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // 1 hour cache instead of immutable
        'ETag': `"${Date.now()}"`, // Add ETag for better cache validation
      },
    });
    
  } catch (error) {
    console.error('Error serving preview:', error);
    return NextResponse.json(
      { error: 'Failed to serve preview' },
      { status: 500 }
    );
  }
}