CREATE POLICY "Users manage own files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);