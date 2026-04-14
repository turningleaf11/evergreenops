INSERT INTO public.workspaces (name, description)
SELECT 'TeamSpace', 'Your team''s collaborative workspace'
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces LIMIT 1);