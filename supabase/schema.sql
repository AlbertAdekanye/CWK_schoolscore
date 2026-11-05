-- SchoolScore initial schema
-- Run this in Supabase SQL Editor using a trusted project administrator.

create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'corper');
create type public.assessment_grade as enum ('A', 'B', 'C', 'D', 'E', 'F');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete restrict,
  full_name text not null,
  role public.user_role not null default 'corper',
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'My workspace',
  created_at timestamptz not null default now(),
  unique (owner_id, school_id)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  level text not null check (level in ('JSS1','JSS2','JSS3')),
  section text not null check (section in ('A','B')),
  display_name text generated always as (level || ' ' || section) stored,
  created_at timestamptz not null default now(),
  unique (workspace_id, level, section),
  unique (id, workspace_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  admission_number text,
  first_name text not null,
  last_name text not null,
  middle_name text,
  gender text check (gender in ('Male','Female','Other')),
  date_of_birth date,
  created_at timestamptz not null default now(),
  unique (id, workspace_id),
  unique (workspace_id, admission_number)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  class_id uuid not null,
  student_id uuid not null,
  academic_year text not null,
  is_active boolean not null default true,
  enrolled_at timestamptz not null default now(),
  foreign key (class_id, workspace_id) references public.classes(id, workspace_id) on delete cascade,
  foreign key (student_id, workspace_id) references public.students(id, workspace_id) on delete cascade,
  unique (id, class_id, workspace_id),
  unique (student_id, academic_year)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, name),
  unique (id, school_id)
);

create table public.class_subjects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  class_id uuid not null,
  subject_id uuid not null,
  school_id uuid not null references public.schools(id) on delete cascade,
  foreign key (class_id, workspace_id) references public.classes(id, workspace_id) on delete cascade,
  foreign key (subject_id, school_id) references public.subjects(id, school_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id, class_id, workspace_id),
  unique (class_id, subject_id)
);

create table public.academic_terms (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  session_name text not null,
  term_number smallint not null check (term_number between 1 and 3),
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  unique (school_id, session_name, term_number),
  unique (id, school_id)
);

create table public.score_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  class_id uuid not null,
  enrollment_id uuid not null,
  class_subject_id uuid not null,
  term_id uuid not null,
  test_score numeric(5,2) check (test_score between 0 and 20),
  assignment_score numeric(5,2) check (assignment_score between 0 and 10),
  classwork_score numeric(5,2) check (classwork_score between 0 and 10),
  examination_score numeric(5,2) check (examination_score between 0 and 60),
  total_score numeric(6,2) generated always as (
    case
      when test_score is not null
       and assignment_score is not null
       and classwork_score is not null
       and examination_score is not null
      then test_score + assignment_score + classwork_score + examination_score
      else null
    end
  ) stored,
  grade public.assessment_grade generated always as (
    case
      when test_score is null or assignment_score is null
        or classwork_score is null or examination_score is null then null
      when test_score + assignment_score + classwork_score + examination_score >= 70 then 'A'::public.assessment_grade
      when test_score + assignment_score + classwork_score + examination_score >= 60 then 'B'::public.assessment_grade
      when test_score + assignment_score + classwork_score + examination_score >= 50 then 'C'::public.assessment_grade
      when test_score + assignment_score + classwork_score + examination_score >= 45 then 'D'::public.assessment_grade
      when test_score + assignment_score + classwork_score + examination_score >= 40 then 'E'::public.assessment_grade
      else 'F'::public.assessment_grade
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (enrollment_id, class_id, workspace_id)
    references public.enrollments(id, class_id, workspace_id) on delete cascade,
  foreign key (class_subject_id, class_id, workspace_id)
    references public.class_subjects(id, class_id, workspace_id) on delete cascade,
  foreign key (term_id) references public.academic_terms(id) on delete restrict,
  unique (enrollment_id, class_subject_id, term_id)
);

-- Updated timestamp trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger score_records_updated_at
before update on public.score_records
for each row execute function public.set_updated_at();

-- Access helper: a user can access their own workspace; school admins can access
-- workspaces belonging to their school.
create or replace function public.can_access_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    join public.profiles p on p.id = auth.uid()
    where w.id = target_workspace_id
      and (
        w.owner_id = auth.uid()
        or (p.role = 'admin' and p.school_id = w.school_id)
      )
  );
$$;

create or replace function public.is_school_admin(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.school_id = target_school_id
      and p.role = 'admin'
  );
$$;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.subjects enable row level security;
alter table public.class_subjects enable row level security;
alter table public.academic_terms enable row level security;
alter table public.score_records enable row level security;

create policy "school members can read school"
on public.schools for select
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = id));

create policy "users read own profile and admins read school profiles"
on public.profiles for select
using (id = auth.uid() or public.is_school_admin(school_id));

create policy "workspace owners and school admins can read workspaces"
on public.workspaces for select
using (public.can_access_workspace(id));

create policy "corpers create own workspace"
on public.workspaces for insert
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.school_id = school_id
  )
);

create policy "workspace owners and admins update workspaces"
on public.workspaces for update
using (public.can_access_workspace(id))
with check (public.can_access_workspace(id));

create policy "workspace owners and admins delete workspaces"
on public.workspaces for delete
using (public.can_access_workspace(id));

create policy "workspace access classes" on public.classes
for all using (public.can_access_workspace(workspace_id))
with check (public.can_access_workspace(workspace_id));

create policy "workspace access students" on public.students
for all using (public.can_access_workspace(workspace_id))
with check (public.can_access_workspace(workspace_id));

create policy "workspace access enrollments" on public.enrollments
for all using (public.can_access_workspace(workspace_id))
with check (public.can_access_workspace(workspace_id));

create policy "school members read subjects" on public.subjects
for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = school_id)
);

create policy "admins manage subjects" on public.subjects
for all using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

create policy "workspace access class subjects" on public.class_subjects
for all using (public.can_access_workspace(workspace_id))
with check (public.can_access_workspace(workspace_id));

create policy "school members read terms" on public.academic_terms
for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.school_id = school_id)
);

create policy "admins manage terms" on public.academic_terms
for all using (public.is_school_admin(school_id))
with check (public.is_school_admin(school_id));

create policy "workspace access scores" on public.score_records
for all using (public.can_access_workspace(workspace_id))
with check (public.can_access_workspace(workspace_id));

-- Helpful indexes
create index classes_workspace_idx on public.classes(workspace_id);
create index students_workspace_idx on public.students(workspace_id);
create index enrollments_class_idx on public.enrollments(class_id);
create index class_subjects_class_idx on public.class_subjects(class_id);
create index score_records_class_term_idx on public.score_records(class_id, term_id);
create index score_records_workspace_idx on public.score_records(workspace_id);

-- Initial school subjects: run after creating a school and admin profile.
-- Example:
-- insert into public.subjects (school_id, name)
-- values ('YOUR-SCHOOL-UUID', 'PHE'),
--        ('YOUR-SCHOOL-UUID', 'Basic Science');
