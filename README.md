# SchoolScore starter

SchoolScore is a multi-user student assessment management app.

## Stack
- Next.js 15 / React 19 / TypeScript
- Supabase Auth
- Supabase PostgreSQL with Row Level Security
- Responsive CSS

## Current foundation
- Landing page
- Email/password sign-in
- Authenticated dashboard shell
- Supabase browser/server clients
- Database schema for schools, profiles, private workspaces, classes, students, enrollments, subjects, terms and score records
- RLS policies for workspace ownership and school administrator access
- Database-calculated totals and grades

## Local setup

1. Install Node.js 20 or later.
2. Create a Supabase project.
3. In Supabase SQL Editor, run `supabase/schema.sql`.
4. Add your Supabase URL and anon/publishable key to `.env.local` using `.env.example`.
5. Install dependencies and start the app:

```bash
npm install
npm run dev
```

6. Open http://localhost:3000.

## Important setup note

This starter intentionally does not include public self-registration or a service-role key. The school administrator and corper accounts should be provisioned through a trusted admin workflow. Never expose the Supabase service-role key in browser code.

Before production:
- Add an admin-only server route or Supabase Edge Function to invite corpers and create their profiles/workspaces.
- Create the initial school and first admin profile through a trusted setup process.
- Add audit logging for score changes.
- Add class/student/subject CRUD pages and score-entry UI.
- Add term-specific report generation and CSV/XLSX/PDF exports.
- Test RLS with separate admin and corper accounts before importing real student data.

## Data model decisions

Each corper owns a workspace. The corper can only access that workspace. A school admin can access all workspaces associated with their school for administration and school-wide reporting.

Students are enrolled into classes by academic year. Subject assignments are attached to a class. A score record belongs to one enrollment, class-subject assignment and academic term.

The four assessment marks are stored separately:
- Test: 0–20
- Assignment: 0–10
- Classwork: 0–10
- Examination: 0–60

The database computes the total and grade only after all four marks are present. The default grade thresholds are defined in the generated grade expression in `supabase/schema.sql`; change them there if the school uses a different grading policy.
