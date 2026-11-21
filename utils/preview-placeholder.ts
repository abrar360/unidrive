// Inline placeholder thumbnail, used while a document's preview doesn't exist
// yet or fails to load. Kept free of Node imports so client components can use
// it too. (Previously this pointed at via.placeholder.com, an external service
// that no longer works and that this local-only app shouldn't depend on.)
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">' +
  '<rect width="100%" height="100%" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="1"/>' +
  '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" ' +
  'font-family="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" ' +
  'font-size="14" fill="#9ca3af">No preview yet</text>' +
  '</svg>';

export const PREVIEW_PLACEHOLDER_URL =
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PLACEHOLDER_SVG)}`;
