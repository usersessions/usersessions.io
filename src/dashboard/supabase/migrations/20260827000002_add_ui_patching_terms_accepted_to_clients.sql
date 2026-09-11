ALTER TABLE us_clients 
ADD COLUMN ui_patching_terms_accepted boolean NOT NULL DEFAULT false,
ADD COLUMN ui_patching_terms_accepted_at timestamptz;
