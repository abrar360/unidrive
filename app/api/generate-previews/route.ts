import { NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { previewGenerator } from '../../../utils/preview-generator';

export async function POST() {
  try {
    const storageDir = join(process.cwd(), 'storage');
    const documentsDir = join(storageDir, 'documents');
    
    if (!existsSync(documentsDir)) {
      return NextResponse.json({ message: 'No documents directory found' });
    }

    // Get all document files
    const files = await readdir(documentsDir);
    const documentFiles = files.filter(file => file.endsWith('.json'));
    
    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of documentFiles) {
      try {
        const documentId = file.replace('.json', '');
        const previewsDir = join(storageDir, 'previews');
        const previewPath = join(previewsDir, `${documentId}.png`);
        
        // Skip if preview already exists
        if (existsSync(previewPath)) {
          skipped++;
          continue;
        }

        // Read document data
        const documentPath = join(documentsDir, file);
        const documentContent = await readFile(documentPath, 'utf-8');
        const documentData = JSON.parse(documentContent);

        // Generate preview
        await previewGenerator.generatePreview(documentId, documentData.content);
        generated++;
        
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Preview generation complete',
      stats: {
        total: documentFiles.length,
        generated,
        skipped,
        errors
      }
    });
    
  } catch (error) {
    console.error('Error in preview generation:', error);
    return NextResponse.json(
      { error: 'Failed to generate previews' },
      { status: 500 }
    );
  }
}