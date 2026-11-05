import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, school_id")
    .eq("id", user.id)
    .single();

  const { data: workspaces } = await supabase
    .from("workspaces")
    .select("id, name, created_at")
    .order("created_at", { ascending: true });

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div className="brand"><span className="brand-mark">S</span> SchoolScore</div>
        <form action="/auth/signout" method="post"><button className="button button-light">Sign out</button></form>
      </header>
      <section className="dashboard-content">
        <div className="eyebrow">{profile?.role === "admin" ? "SCHOOL ADMINISTRATOR" : "CORPS MEMBER WORKSPACE"}</div>
        <h1>Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
        <p className="muted">Your school score management overview.</p>

        <div className="stats-grid">
          <div className="stat-card"><span>Workspaces</span><strong>{workspaces?.length ?? 0}</strong></div>
          <div className="stat-card"><span>Role</span><strong className="role-value">{profile?.role ?? "Pending setup"}</strong></div>
          <div className="stat-card"><span>Subjects in your setup</span><strong>2</strong></div>
        </div>

        <div className="section-heading"><h2>Your workspaces</h2></div>
        {workspaces?.length ? (
          <div className="workspace-grid">
            {workspaces.map((workspace) => (
              <article className="workspace-card" key={workspace.id}>
                <div className="workspace-icon">▦</div>
                <h3>{workspace.name}</h3>
                <p>Classes, students and assessment records</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">▦</div>
            <h3>Your workspace is being set up</h3>
            <p>Once the administrator creates your workspace, it will appear here.</p>
          </div>
        )}
      </section>
    </main>
  );
}
