-- Public bucket for email signature logo (run once in Supabase SQL Editor)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('email-assets', 'email-assets', true, 5242880)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

DROP POLICY IF EXISTS "email_assets_all" ON storage.objects;
CREATE POLICY "email_assets_all" ON storage.objects
  FOR ALL USING (bucket_id = 'email-assets') WITH CHECK (bucket_id = 'email-assets');
