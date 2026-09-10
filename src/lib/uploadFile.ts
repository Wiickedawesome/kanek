import { File } from 'expo-file-system';

const MIME_BY_EXTENSION: Record<string, string> = {
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function inferMimeType(uri: string, fallbackMimeType?: string | null) {
  if (fallbackMimeType) return fallbackMimeType;

  const cleanUri = uri.split('?')[0] ?? uri;
  const extension = cleanUri.split('.').pop()?.toLowerCase();
  if (!extension) return null;

  return MIME_BY_EXTENSION[extension] ?? null;
}

export function getSafeUploadExtension(uri: string, mimeType?: string | null): string {
  if (!uri.startsWith('blob:') && !uri.startsWith('data:')) {
    const cleanUri = uri.split('?')[0] ?? uri;
    const rawExt = cleanUri.split('.').pop()?.toLowerCase() ?? '';
    if (rawExt && rawExt.length <= 5 && /^[a-z0-9]+$/.test(rawExt)) {
      return rawExt === 'jpeg' ? 'jpg' : rawExt;
    }
  }

  if (mimeType && EXTENSION_BY_MIME[mimeType]) {
    return EXTENSION_BY_MIME[mimeType];
  }

  return 'jpg';
}

export async function readUploadFile(uri: string, fallbackMimeType?: string | null) {
  const inferredMimeType = inferMimeType(uri, fallbackMimeType);

  if (uri.startsWith('data:') || uri.startsWith('blob:') || uri.startsWith('http://') || uri.startsWith('https://')) {
    const response = await fetch(uri);
    const blob = await response.blob();
    return {
      arrayBuffer: await blob.arrayBuffer(),
      mimeType: blob.type || inferredMimeType || 'application/octet-stream',
      size: blob.size,
    };
  }

  try {
    const file = new File(uri);
    const arrayBuffer = await file.arrayBuffer();
    return {
      arrayBuffer,
      mimeType: inferredMimeType || 'application/octet-stream',
      size: file.size ?? arrayBuffer.byteLength,
    };
  } catch {
    const response = await fetch(uri);
    const blob = await response.blob();
    return {
      arrayBuffer: await blob.arrayBuffer(),
      mimeType: blob.type || inferredMimeType || 'application/octet-stream',
      size: blob.size,
    };
  }
}