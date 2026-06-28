# TOISA - Tender Operations Intelligence System

A standalone Next.js 14 application that helps South African contractors discover tenders, track submissions, and manage compliance documents.

## Features

- **Dashboard Overview** - Stats, upcoming deadlines, compliance status, recent activity
- **Tender Discovery** - Scrape eTenders.gov.za and discover relevant opportunities
- **Pipeline Tracker** - Kanban board to track tender submissions through stages
- **Compliance Manager** - Track B-BBEE, SARS, CIDB, and other compliance documents
- **Email Alerts** - Daily digest and compliance expiry notifications via Resend
- **Gmail Integration** - Auto-import tender emails (prototype)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: Supabase
- **Email**: Resend
- **Scraping**: Jina AI Reader
- **UI**: shadcn/ui + Tailwind CSS
- **Auth**: Supabase Email Magic Link

## Setup

### 1. Supabase Setup

Create tables in your Supabase project:

```sql
-- Tenders table
CREATE TABLE toisa_tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_portal TEXT NOT NULL,
  tender_number TEXT,
  title TEXT NOT NULL,
  description TEXT,
  url TEXT,
  category TEXT,
  location TEXT,
  closing_date TIMESTAMPTZ,
  estimated_value NUMERIC,
  status TEXT DEFAULT 'new',
  relevance_score INT DEFAULT 5,
  raw_data JSONB,
  discovered_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pipeline items table
CREATE TABLE toisa_pipeline_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id UUID REFERENCES toisa_tenders(id),
  subject TEXT NOT NULL,
  sender TEXT,
  body TEXT,
  stage TEXT DEFAULT 'discovered',
  deadline TIMESTAMPTZ,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  won_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Compliance documents table
CREATE TABLE toisa_compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT,
  issue_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'valid',
  alert_30d BOOLEAN DEFAULT true,
  alert_14d BOOLEAN DEFAULT true,
  alert_7d BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User profile table
CREATE TABLE toisa_user_profile (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  company_name TEXT DEFAULT 'Mahlasela Za (Pty) Ltd',
  email TEXT,
  bbee_level INT DEFAULT 4,
  cidb_grade INT DEFAULT 1,
  service_categories TEXT[] DEFAULT ARRAY['MARC', 'Construction', 'Water Tank'],
  provinces TEXT[] DEFAULT ARRAY['Mpumalanga', 'Gauteng', 'Limpopo'],
  preferred_alerts TEXT DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE toisa_tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE toisa_pipeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE toisa_compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE toisa_user_profile ENABLE ROW LEVEL SECURITY;

-- RLS Policies (allow authenticated users)
CREATE POLICY "Allow authenticated" ON toisa_tenders FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated" ON toisa_pipeline_items FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated" ON toisa_compliance_documents FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated" ON toisa_user_profile FOR ALL TO authenticated USING (true);
```

### 2. Environment Variables

Create `.env.local` with your values:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
RESEND_API_KEY=re_your_resend_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Install & Run

```bash
cd toisa
npm install
npm run dev
```

### 4. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Set environment variables in Vercel dashboard.

## Routes

- `/` - Landing page with login option
- `/login` - Magic link login
- `/dashboard` - Main dashboard
- `/dashboard/tenders` - Tender discovery feed
- `/dashboard/pipeline` - Submission tracker
- `/dashboard/compliance` - Document manager
- `/dashboard/settings` - Profile settings

## API Routes

- `POST /api/scrape` - Scrape tender portals
- `POST /api/email/sync` - Sync Gmail emails
- `POST /api/alerts/send-digest` - Send daily digest
- `POST /api/alerts/send-compliance` - Send compliance alerts
- `GET /api/cron/daily-digest` - Daily cron job (Vercel Cron)

## Demo Account

For testing:
- Email: mahlaselaza98@gmail.com
- (Magic link auth - check email for link)

## License

Proprietary - For Mahlasela Za (Pty) Ltd use only.
