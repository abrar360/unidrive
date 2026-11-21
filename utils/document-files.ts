import { unlink } from 'fs/promises';
import { join } from 'path';

const storageDir = () => join(process.cwd(), 'storage');

// Remove a file, treating "already gone" as success.
async function removeIfPresent(path: string): Promise<boolean> {
  try {
    await unlink(path);
    return true;
  } catch (error: any) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Delete everything stored for a document: content, metadata and preview
 * (current .svg plus any legacy .png). Missing files are skipped, so a
 * half-deleted or half-written document can still be cleaned up.
 * Returns true if any of the document's files existed.
 *
 * The caller must validate documentId (see utils/ids.ts) before calling.
 */
export async function deleteDocumentFiles(documentId: string): Promise<boolean> {
  const dir = storageDir();
  const results = await Promise.all([
    removeIfPresent(join(dir, 'documents', `${documentId}.json`)),
    removeIfPresent(join(dir, 'metadata', `${documentId}.json`)),
  ]);

  // Previews are best-effort: never fail a delete because of a thumbnail
  await Promise.all(
    ['svg', 'png'].map((ext) =>
      removeIfPresent(join(dir, 'previews', `${documentId}.${ext}`)).catch((error) => {
        console.error(`Preview deletion error for ${documentId}.${ext}:`, error);
        return false;
      })
    )
  );

  return results.some(Boolean);
}
