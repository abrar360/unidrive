import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * Count documents per folder from the document metadata files.
 *
 * Folder files also store a documentCount, but it was only refreshed on moves
 * and when a folder was opened, so creates, deletes and saves left it stale.
 * Counting on read keeps every list accurate without having to update the
 * folder file from each endpoint.
 */
export async function countDocumentsByFolder(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const metadataDir = join(process.cwd(), 'storage', 'metadata');
  if (!existsSync(metadataDir)) return counts;

  const files = (await readdir(metadataDir)).filter((file) => file.endsWith('.json'));
  await Promise.all(
    files.map(async (file) => {
      try {
        const metadata = JSON.parse(await readFile(join(metadataDir, file), 'utf-8'));
        if (typeof metadata.folderId === 'string') {
          counts.set(metadata.folderId, (counts.get(metadata.folderId) || 0) + 1);
        }
      } catch (error) {
        console.error(`Error reading document metadata ${file}:`, error);
      }
    })
  );
  return counts;
}
