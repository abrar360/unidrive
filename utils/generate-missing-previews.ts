import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { previewGenerator } from './preview-generator';

/**
 * Generate previews for all documents that don't have them yet
 */
export async function generateMissingPreviews() {
  try {
    const storageDir = join(process.cwd(), 'storage');
    const documentsDir = join(storageDir, 'documents');
    const previewsDir = join(storageDir, 'previews');
    
    if (!existsSync(documentsDir)) {
      console.log('No documents directory found');
      return;
    }

    // Get all document files
    const files = await readdir(documentsDir);
    const documentFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`Found ${documentFiles.length} documents`);
    
    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (const file of documentFiles) {
      try {
        const documentId = file.replace('.json', '');
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
        
        console.log(`Generated preview for: ${documentData.title || documentId}`);
        
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
        errors++;
      }
    }

    console.log(`\nPreview generation complete:`);
    console.log(`- Generated: ${generated}`);
    console.log(`- Skipped (existing): ${skipped}`);
    console.log(`- Errors: ${errors}`);
    
  } catch (error) {
    console.error('Error in generateMissingPreviews:', error);
  }
}

// Run this if called directly
if (require.main === module) {
  generateMissingPreviews()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}