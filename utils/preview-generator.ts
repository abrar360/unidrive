import { writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

interface UniverDocument {
  body: {
    dataStream: string;
    textRuns: any[];
    paragraphs: any[];
  };
  documentStyle?: {
    pageSize?: {
      width: number;
      height: number;
    };
  };
}

export class DocumentPreviewGenerator {
  /**
   * Extract structured text from Univer document format with proper line breaks
   */
  private extractStructuredText(document: UniverDocument): Array<{text: string, spaceAbove?: number}> {
    if (!document.body || !document.body.dataStream) {
      return [];
    }

    const dataStream = document.body.dataStream;
    const paragraphs = document.body.paragraphs || [];
    
    // For now, let's use a simpler approach that respects the natural line breaks in the data
    // Split on multiple \r sequences which seem to indicate line breaks
    const lines = dataStream
      .split(/\r{2,}/)  // Split on 2 or more \r characters
      .map(line => line.replace(/[\r\n]/g, '').trim())  // Clean up individual lines
      .filter(line => line.length > 0);  // Remove empty lines
    
    // Convert to structured format with spacing
    return lines.map((text, index) => ({
      text,
      spaceAbove: index > 0 ? 5 : 0  // Add some space between lines
    }));
  }

  /**
   * Extract readable text from Univer document format (legacy method for compatibility)
   */
  private extractText(document: UniverDocument): string {
    const structuredLines = this.extractStructuredText(document);
    return structuredLines.map(line => line.text).join('\n');
  }

  /**
   * Generate SVG-based preview for a document
   */
  async generatePreview(documentId: string, document: UniverDocument): Promise<string> {
    const width = 300;
    const height = 200;
    const padding = 20;
    const baseLineHeight = 16;
    const fontSize = 12;

    // Extract structured text content with formatting
    const structuredLines = this.extractStructuredText(document);

    let svgContent = '';
    
    if (structuredLines.length === 0) {
      // Show "Empty Document" placeholder
      svgContent = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="1"/>
          <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" 
                font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" 
                font-size="14" fill="#9ca3af" font-style="italic">Empty Document</text>
        </svg>`;
    } else {
      const maxCharsPerLine = Math.floor((width - padding * 2) / (fontSize * 0.6));
      const textElements: string[] = [];
      let currentY = padding;
      
      for (let lineIndex = 0; lineIndex < structuredLines.length; lineIndex++) {
        const structuredLine = structuredLines[lineIndex];
        
        // Add space above if specified
        if (structuredLine.spaceAbove && structuredLine.spaceAbove > 0) {
          currentY += structuredLine.spaceAbove * 3; // Convert space units to pixels
        }
        
        // Break long lines into multiple display lines
        const words = structuredLine.text.split(/\s+/).filter(word => word.length > 0);
        const displayLines: string[] = [];
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          
          if (testLine.length > maxCharsPerLine) {
            if (currentLine) {
              displayLines.push(currentLine);
              currentLine = word;
            } else {
              displayLines.push(word.substring(0, maxCharsPerLine - 3) + '...');
              currentLine = '';
            }
          } else {
            currentLine = testLine;
          }
        }

        if (currentLine) {
          displayLines.push(currentLine);
        }

        // Add each display line to SVG
        for (const displayLine of displayLines) {
          currentY += baseLineHeight;
          
          // Stop if we exceed the preview height
          if (currentY > height - padding) {
            // Add ellipsis to indicate more content
            if (textElements.length > 0) {
              const lastElement = textElements[textElements.length - 1];
              const ellipsisElement = lastElement.replace('</text>', '...</text>');
              textElements[textElements.length - 1] = ellipsisElement;
            }
            break;
          }

          const escapedLine = displayLine.replace(/[<>&]/g, char => ({
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;'
          }[char] || char));

          textElements.push(
            `<text x="${padding}" y="${currentY}" 
                   font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" 
                   font-size="${fontSize}" fill="#374151">${escapedLine}</text>`
          );
        }
        
        // Note: spaceBelow handling removed for simplicity
        
        // Stop if we exceed the preview height
        if (currentY > height - padding) {
          break;
        }
      }

      svgContent = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="1"/>
          ${textElements.join('\n          ')}
        </svg>`;
    }

    // Save the SVG preview
    const previewsDir = join(process.cwd(), 'storage', 'previews');
    if (!existsSync(previewsDir)) {
      await mkdir(previewsDir, { recursive: true });
    }

    const previewPath = join(previewsDir, `${documentId}.svg`);
    await writeFile(previewPath, svgContent.trim());

    // Add timestamp for cache busting
    const timestamp = Date.now();
    return `/api/previews/${documentId}.svg?t=${timestamp}`;
  }

  /**
   * Generate preview URL without creating the image (for quick API responses)
   */
  async getPreviewUrl(documentId: string): Promise<string> {
    const previewPath = join(process.cwd(), 'storage', 'previews', `${documentId}.svg`);
    
    if (existsSync(previewPath)) {
      try {
        // Get file modification time for cache busting
        const stats = await stat(previewPath);
        const timestamp = stats.mtime.getTime();
        return `/api/previews/${documentId}.svg?t=${timestamp}`;
      } catch (error) {
        console.error('Error getting file stats:', error);
        return `/api/previews/${documentId}.svg?t=${Date.now()}`;
      }
    }
    
    // Return placeholder if preview doesn't exist yet
    return 'https://via.placeholder.com/300x200/f8f9fa/374151?text=Generating...';
  }
}

export const previewGenerator = new DocumentPreviewGenerator();