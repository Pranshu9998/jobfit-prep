# JobFit Prep

JobFit Prep turns one confirmed master resume and one job description into a transparent fit analysis, a guarded tailored resume, and a grounded interview-preparation pack.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in the Gemini and Supabase values.
2. Apply `supabase/migrations/202607190001_jobfit_beta.sql` in the Supabase SQL editor.
3. Add `http://localhost:3000/auth/callback` to the Supabase Auth redirect URLs.
4. Run `pnpm install` and `pnpm dev`.

## Vercel

Import the GitHub repository into Vercel and add these environment variables for Preview and Production:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

After Vercel assigns a domain, add `https://YOUR-DOMAIN/auth/callback` to the Supabase Auth redirect URLs.

Uploaded binary resumes and API keys are never stored in Supabase. User workspace records are protected by Row Level Security.
