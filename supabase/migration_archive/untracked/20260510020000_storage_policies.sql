-- Allow authenticated users to upload files
CREATE POLICY "allow_authenticated_insert" ON storage.objects 
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'files');

-- Allow authenticated users to read files
CREATE POLICY "allow_authenticated_select" ON storage.objects 
FOR SELECT TO authenticated USING (bucket_id = 'files');

-- Allow public read access
CREATE POLICY "allow_public_read" ON storage.objects 
FOR SELECT USING (bucket_id = 'files');
