import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function getAdminContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.role !== "admin") {
    return { error: "Admin access required", status: 403 };
  }

  return { profile };
}

// GET: Fetch classes, subjects and existing assignments
export async function GET() {
  try {
    const context = await getAdminContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const adminClient = createSupabaseAdminClient();

    const { data: workspace, error: workspaceError } = await adminClient
      .from("workspaces")
      .select("id")
      .eq("school_id", context.profile.school_id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "School workspace not found" },
        { status: 404 },
      );
    }

    const [classesResult, subjectsResult, assignmentsResult] =
      await Promise.all([
        adminClient
          .from("classes")
          .select("id, level, section, display_name")
          .eq("workspace_id", workspace.id)
          .order("level")
          .order("section"),

        adminClient
          .from("subjects")
          .select("id, name")
          .eq("school_id", context.profile.school_id)
          .order("name"),

        adminClient
          .from("class_subjects")
          .select(
            `
            id,
            class_id,
            subject_id,
            classes (
              id,
              level,
              section,
              display_name
            ),
            subjects (
              id,
              name
            )
          `,
          )
          .eq("workspace_id", workspace.id),
      ]);

    if (classesResult.error) throw classesResult.error;
    if (subjectsResult.error) throw subjectsResult.error;
    if (assignmentsResult.error) throw assignmentsResult.error;

    return NextResponse.json({
      classes: classesResult.data || [],
      subjects: subjectsResult.data || [],
      assignments: assignmentsResult.data || [],
    });
  } catch (error) {
    console.error("Fetch class subjects error:", error);

    return NextResponse.json(
      { error: "Unable to fetch class subjects" },
      { status: 500 },
    );
  }
}

// POST: Assign a subject to a class
export async function POST(request: Request) {
  try {
    const context = await getAdminContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const body = await request.json();

    const classId = String(body.class_id || "").trim();
    const subjectId = String(body.subject_id || "").trim();

    if (!classId || !subjectId) {
      return NextResponse.json(
        { error: "Class and subject are required" },
        { status: 400 },
      );
    }

    const adminClient = createSupabaseAdminClient();

    const { data: workspace, error: workspaceError } = await adminClient
      .from("workspaces")
      .select("id")
      .eq("school_id", context.profile.school_id)
      .single();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "School workspace not found" },
        { status: 404 },
      );
    }

    const [classResult, subjectResult] = await Promise.all([
      adminClient
        .from("classes")
        .select("id")
        .eq("id", classId)
        .eq("workspace_id", workspace.id)
        .eq("school_id", context.profile.school_id)
        .maybeSingle(),

      adminClient
        .from("subjects")
        .select("id")
        .eq("id", subjectId)
        .eq("school_id", context.profile.school_id)
        .maybeSingle(),
    ]);

    if (classResult.error) throw classResult.error;
    if (subjectResult.error) throw subjectResult.error;

    if (!classResult.data || !subjectResult.data) {
      return NextResponse.json(
        { error: "Selected class or subject was not found" },
        { status: 404 },
      );
    }

    const { data: assignment, error: assignmentError } = await adminClient
      .from("class_subjects")
      .insert({
        workspace_id: workspace.id,
        school_id: context.profile.school_id,
        class_id: classId,
        subject_id: subjectId,
      })
      .select(
        `
          id,
          class_id,
          subject_id,
          classes (
            id,
            level,
            section,
            display_name
          ),
          subjects (
            id,
            name
          )
        `,
      )
      .single();

    if (assignmentError) {
      if (assignmentError.code === "23505") {
        return NextResponse.json(
          { error: "This subject is already assigned to this class" },
          { status: 409 },
        );
      }

      throw assignmentError;
    }

    return NextResponse.json(
      {
        message: "Subject assigned successfully",
        assignment,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Assign subject error:", error);

    return NextResponse.json(
      { error: "Unable to assign subject to class" },
      { status: 500 },
    );
  }
}
