import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// GET: Fetch all teachers in the administrator's school
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, school_id, role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin" ||
      !profile.school_id
    ) {
      return NextResponse.json(
        { error: "Only school administrators can view teachers." },
        { status: 403 },
      );
    }

    const adminClient = createSupabaseAdminClient();

    // Get teacher profiles belonging to this school
    const { data: teachers, error: teachersError } = await adminClient
      .from("profiles")
      .select("id, full_name, role, school_id")
      .eq("school_id", profile.school_id)
      .eq("role", "teacher")
      .order("full_name");

    if (teachersError) {
      throw teachersError;
    }

    // Get email addresses from Supabase Auth
    const authUsers = [];
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw error;
      }

      authUsers.push(...data.users);

      if (data.users.length < perPage) {
        break;
      }

      page++;
    }

    const authUserMap = new Map(
      authUsers.map((authUser) => [
        authUser.id,
        {
          email: authUser.email ?? "",
          confirmedAt: authUser.email_confirmed_at,
          lastSignInAt: authUser.last_sign_in_at,
        },
      ]),
    );
    
    const result = (teachers ?? []).map((teacher) => {
      const authUser = authUserMap.get(teacher.id);
    
      let status = "Invitation pending";
    
      if (authUser?.lastSignInAt) {
        status = "Active";
      } else if (authUser?.confirmedAt) {
        status = "Email confirmed";
      }
    
      return {
        ...teacher,
        email: authUser?.email ?? "",
        status,
      };
    });

    return NextResponse.json({ teachers: result });
  } catch (error) {
    console.error("Fetch teachers error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve teachers." },
      { status: 500 },
    );
  }
}

// POST: Invite a new teacher
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, school_id, role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin" ||
      !profile.school_id
    ) {
      return NextResponse.json(
        { error: "Only school administrators can invite teachers." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Full name and email are required." },
        { status: 400 },
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    const adminClient = createSupabaseAdminClient();

    const { data: workspace, error: workspaceError } = await adminClient
      .from("workspaces")
      .select("id")
      .eq("school_id", profile.school_id)
      .limit(1)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "No workspace was found for this school." },
        { status: 404 },
      );
    }

    const origin = new URL(request.url).origin;

    const { data: invitation, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          school_id: profile.school_id,
          role: "teacher",
        },
        redirectTo: `${origin}/auth/callback`,
      });

    if (inviteError || !invitation.user) {
      return NextResponse.json(
        { error: inviteError?.message || "Unable to invite teacher." },
        { status: 400 },
      );
    }

    const { error: insertError } = await adminClient.from("profiles").insert({
      id: invitation.user.id,
      school_id: profile.school_id,
      full_name: fullName,
      role: "teacher",
    });

    if (insertError) {
      await adminClient.auth.admin.deleteUser(invitation.user.id);

      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        message: "Teacher invitation sent successfully.",
        teacher: {
          id: invitation.user.id,
          full_name: fullName,
          email,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Teacher invitation error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
