-- Allow authenticated users to upload files to their own folder in the 'aimeet' bucket
CREATE POLICY "Allow authenticated users to upload to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'aimeet' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to download files from their own folder in the 'aimeet' bucket
CREATE POLICY "Allow authenticated users to read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'aimeet' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);
