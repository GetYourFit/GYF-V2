import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** Public bucket for user-uploaded profile pictures — mirrors the pattern the
 *  catalog already uses for its own Supabase Storage bucket
 *  (GYF_MEDIA_BASE_URL). Must exist and be public in the Supabase dashboard
 *  (Storage -> New bucket -> "avatars", public) before this can succeed. */
const AVATAR_BUCKET = "avatars";

/** Uploads a profile picture to Supabase Storage and returns its public URL.
 *
 * One object per user (`${userId}/avatar.<ext>`, upsert: true) so re-uploading
 * replaces the old picture instead of accumulating orphaned files. Runs
 * entirely client-side — the image bytes never pass through our API, only the
 * resulting URL does (saved via `PUT /profile { avatar_url }`).
 */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // Cache-bust: same path on re-upload means the CDN/browser would otherwise
  // keep serving the old bytes under an identical URL.
  return `${data.publicUrl}?v=${Date.now()}`;
}
