import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const VALID_LEVELS = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

const VALID_SECTIONS = ["A", "B"];

// GET: Retrieve all classes belonging to the school
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
        { error: "Only school administrators can view classes." },
        { status: 403 },
      );
    }

    const adminClient = createSupabaseAdminClient();

    const { data: classes, error: classesError } = await adminClient
      .from("classes")
      .select("id, level, section, display_name, workspace_id, created_at")
      .eq("school_id", profile.school_id)
      .order("level")
      .order("section");

    if (classesError) {
      throw classesError;
    }

    return NextResponse.json({ classes: classes ?? [] });
  } catch (error) {
    console.error("Fetch classes error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve classes." },
      { status: 500 },
    );
  }
}

// POST: Create a new class
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
        { error: "Only school administrators can create classes." },
        { status: 403 },
      );
    }

    const body = await request.json();

    const level = String(body.level || "")
      .trim()
      .toUpperCase();
    const section = String(body.section || "")
      .trim()
      .toUpperCase();

    if (!VALID_LEVELS.includes(level)) {
      return NextResponse.json(
        { error: "Select a valid class level." },
        { status: 400 },
      );
    }

    if (!VALID_SECTIONS.includes(section)) {
      return NextResponse.json(
        { error: "Select a valid class section." },
        { status: 400 },
      );
    }

    const adminClient = createSupabaseAdminClient();

    // Find the school's existing workspace
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

  const displayName = `${level} ${section}`;
    
  const { data: newClass, error: insertError } = await adminClient
    .from("classes")
    .insert({
      workspace_id: workspace.id,
      school_id: profile.school_id,
      level,
      section,
    })
    .select("id, level, section, display_name, workspace_id, created_at")
    .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: `${displayName} already exists.` },
          { status: 409 },
        );
      }

      throw insertError;
    }

    return NextResponse.json(
      {
        message: `${displayName} created successfully.`,
        class: newClass,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create class error:", error);

    return NextResponse.json(
      { error: "Unable to create class." },
      { status: 500 },
    );
  }
}
