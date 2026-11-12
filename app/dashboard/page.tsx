import TeacherScoreEntry from "./teacher-score-entry";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TeacherManagement from "./teacher-management";
import ClassManagement from "./class-management";
import AcademicManagement from "./academic-management";
import StudentManagement from "./student-management";
import SubjectManagement from "./subject-management";
import ClassSubjectManagement from "./class-subject-management";
import TeacherAssignmentManagement from "./teacher-assignment-management";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, school_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });

  const isAdmin = profile.role === "admin";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6 md:px-12">
        <div className="flex items-center gap-3 font-bold text-xl">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-600 text-white">
            S
          </span>
          SchoolScore
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-slate-50"
          >
            Sign out
          </button>
        </form>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="text-xs font-bold tracking-[0.18em] text-blue-600">
          {isAdmin ? "SCHOOL ADMINISTRATOR" : "TEACHER WORKSPACE"}
        </div>

        <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
          Welcome{profile.full_name ? `, ${profile.full_name}` : ""}
        </h1>

        <p className="mt-2 text-slate-500">
          Your school score management overview.
        </p>

        <section className="mt-9 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">Workspaces</p>
            <p className="mt-3 text-3xl font-extrabold">
              {workspaces?.length ?? 0}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">Role</p>
            <p className="mt-3 text-xl font-bold capitalize">{profile.role}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">Subjects in your setup</p>
            <p className="mt-3 text-3xl font-extrabold">2</p>
          </div>
        </section>

        {isAdmin && (
          <div className="mt-12">
            <TeacherManagement />
            <ClassManagement />
            <AcademicManagement />
            <StudentManagement />
            <SubjectManagement />
            <ClassSubjectManagement />
            <TeacherAssignmentManagement />
          </div>
        )}

        {!isAdmin && <TeacherScoreEntry />}

        <section className="mt-12">
          <h2 className="text-xl font-bold">Your workspaces</h2>

          {workspaces?.length ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((workspace) => (
                <article
                  key={workspace.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-xl text-blue-600">
                    ▦
                  </div>

                  <h3 className="mt-5 font-bold">{workspace.name}</h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Classes, students and assessment records.
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <h3 className="font-bold">No workspace available</h3>
              <p className="mt-2 text-sm text-slate-500">
                Your school workspace will appear here when available.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
