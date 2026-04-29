import { supabase } from '@/lib/supabase';
import { MAX_UPLOAD_SIZE } from '@/lib/constants';
import { readUploadFile } from '@/lib/uploadFile';

interface UploadProfileAvatarArgs {
  userId: string;
  uri: string;
  mimeType?: string | null;
}

export async function uploadProfileAvatar({ userId, uri, mimeType }: UploadProfileAvatarArgs) {
  const { arrayBuffer, mimeType: resolvedMimeType, size } = await readUploadFile(uri, mimeType);

  if (size > MAX_UPLOAD_SIZE) {
    throw new Error('Image must be under 5 MB');
  }

  const filePath = `${userId}/avatar`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, {
      contentType: resolvedMimeType || 'image/jpeg',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return `${data.publicUrl}?v=${Date.now()}`;
}