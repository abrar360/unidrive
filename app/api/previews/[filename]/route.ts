import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
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

    // ETag from the file's modification time and size: stable while the
    // preview is unchanged, different once it's regenerated. (It used to be
    // Date.now(), which changed on every request, so it never validated.)
    const stats = await stat(previewPath);
    const etag = `"${stats.mtimeMs.toString(36)}-${stats.size.toString(36)}"`;
    const cacheHeaders = {
      'Cache-Control': 'public, max-age=3600',
      'ETag': etag,
    };

    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: cacheHeaders });
    }

    const fileBuffer = await readFile(previewPath);
    const contentType = filename.endsWith('.svg') ? 'image/svg+xml' : 'image/png';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        ...cacheHeaders,
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