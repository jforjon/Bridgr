# Bridgr Setup

## 1) Clone the repository

```bash
git clone <your-repo-url> bridgr
cd bridgr
```

## 2) Install dependencies

```bash
npm install
```

## 3) Configure environment variables

Copy the example file and fill all values:

```bash
cp .env.local.example .env.local
```

Required values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL` (default is `http://localhost:3000`)

## 4) Create the Supabase schema

Use Supabase SQL editor (or Supabase CLI) and run:

`supabase/migrations/001_initial.sql`

If using Supabase CLI:

```bash
supabase db push
```

## 5) Seed initial words data

Insert starter rows into `public.words` for each target language you want to teach. The app expects words in this table for `learn` sessions.

## 6) Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 7) Stripe webhook testing (optional, local)

Use Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Set `STRIPE_WEBHOOK_SECRET` from Stripe CLI output.
