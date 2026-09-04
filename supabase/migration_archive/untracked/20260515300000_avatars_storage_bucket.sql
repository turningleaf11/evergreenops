-- Avatars storage bucket (public read, authenticated uploads to own folder)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatars: users upload to own folder" ON storage.objects;
CREATE POLICY "Avatars: users upload to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatars: users update own" ON storage.objects;
CREATE POLICY "Avatars: users update own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatars: public read" ON storage.objects;
CREATE POLICY "Avatars: public read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');
