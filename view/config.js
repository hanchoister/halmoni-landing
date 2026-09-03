// Deployed config for the Care Kit viewer.
//
// This file used to be gitignored, which meant it was never deployed: every
// share-kit link a family sent landed on "Site config missing" instead of the
// care summary. Both values below are safe in a browser — the publishable key
// is designed for it, and RLS enforces access — so it is committed on purpose.
//
// Uses the modern publishable key, NOT the legacy anon JWT, so disabling the
// legacy keys in Supabase cannot break the viewer.
window.HALMONI_SUPABASE_URL = 'https://wyovvbnlhyqfmnvsgket.supabase.co';
window.HALMONI_SUPABASE_ANON_KEY = 'sb_publishable_P2L_Trg6gFipDixjIPH5qA_wXEKVRsW';
