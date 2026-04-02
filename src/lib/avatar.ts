import { supabase } from '@/lib/supabase';

interface UploadProfileAvatarArgs {
  userId: string;
  uri: string;
  mimeType?: string | null;
}

export async function uploadProfileAvatar({ userId, uri, mimeType }: UploadProfileAvatarArgs) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const filePath = `${userId}/avatar`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(filePath, arrayBuffer, {
      contentType: mimeType ?? 'image/jpeg',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return `${data.publicUrl}?v=${Date.now()}`;
}