-- A tenant can attach one photo to a complaint (for example a leaking pipe).
-- The photo lives in a PRIVATE storage bucket: nobody can open it directly.
-- The tenant's upload and the landlord's viewing both go through the server
-- (/api/complaints/photo and /api/complaints/[id]/photo), which check who is
-- asking. The complaint row only keeps the file's path.

alter table public.complaints
  add column if not exists photo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('complaint-photos', 'complaint-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;
