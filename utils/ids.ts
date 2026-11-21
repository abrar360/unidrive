// IDs are generated as `doc_<timestamp>_<random>` / `folder_<timestamp>_<random>`
// (letters, digits and underscores only). They are joined into file paths, so
// anything else — in particular "/", "\" or ".." — must be rejected to keep
// requests from reaching files outside the storage folders.
const DOCUMENT_ID = /^doc_[A-Za-z0-9_]+$/;
const FOLDER_ID = /^folder_[A-Za-z0-9_]+$/;

export function isValidDocumentId(id: unknown): id is string {
  return typeof id === 'string' && DOCUMENT_ID.test(id);
}

export function isValidFolderId(id: unknown): id is string {
  return typeof id === 'string' && FOLDER_ID.test(id);
}
