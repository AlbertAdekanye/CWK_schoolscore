import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, school_id, role")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile ||
      !profile.school_id ||
      !["admin", "teacher"].includes(profile.role)
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: workspace, error: workspaceError } = await admin
      .from("workspaces")
      .select("id")
      .eq("school_id", profile.school_id)
      .limit(1)
      .maybeSingle();

    if (workspaceError || !workspace) {
      return NextResponse.json(
        { error: "School workspace not found" },
        { status: 404 },
      );
    }

    let allowedClassIds: string[] = [];

    if (profile.role === "admin") {
      const { data: classes, error } = await admin
        .from("classes")
        .select("id, level, section, display_name")
        .eq("workspace_id", workspace.id)
        .order("level")
        .order("section");

      if (error) {
        console.error("Reports options classes error:", error);

        return NextResponse.json(
          { error: "Unable to load classes" },
          { status: 500 },
        );
      }

      const { data: terms, error: termsError } = await admin
        .from("academic_terms")
        .select("id, session_name, term_number, is_current, starts_on, ends_on")
        .eq("school_id", profile.school_id)
        .order("session_name", { ascending: false })
        .order("term_number");

      if (termsError) {
        console.error("Reports options terms error:", termsError);

        return NextResponse.json(
          { error: "Unable to load academic terms" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        classes: classes ?? [],
        terms: terms ?? [],
      });
    }

    // Teachers can access classes assigned directly to them
    // or through their subject assignments.
    const [classAssignmentsResult, subjectAssignmentsResult] =
      await Promise.all([
        admin
          .from("teacher_class_assignments")
          .select("class_id")
          .eq("teacher_id", user.id)
          .eq("workspace_id", workspace.id),

        admin
          .from("subject_teacher_assignments")
          .select("class_subject_id")
          .eq("teacher_id", user.id)
          .eq("workspace_id", workspace.id),
      ]);

    if (classAssignmentsResult.error || subjectAssignmentsResult.error) {
      console.error(
        "Reports teacher assignments error:",
        classAssignmentsResult.error || subjectAssignmentsResult.error,
      );

      return NextResponse.json(
        { error: "Unable to load teacher assignments" },
        { status: 500 },
      );
    }

    allowedClassIds = (classAssignmentsResult.data ?? []).map(
      (item) => item.class_id,
    );

    const classSubjectIds = (subjectAssignmentsResult.data ?? []).map(
      (item) => item.class_subject_id,
    );

    if (classSubjectIds.length > 0) {
      const { data: classSubjects, error } = await admin
        .from("class_subjects")
        .select("class_id")
        .eq("workspace_id", workspace.id)
        .in("id", classSubjectIds);

      if (error) {
        console.error("Reports assigned subjects error:", error);

        return NextResponse.json(
          { error: "Unable to load assigned classes" },
          { status: 500 },
        );
      }

      allowedClassIds.push(
        ...(classSubjects ?? []).map((item) => item.class_id),
      );
    }

    allowedClassIds = [...new Set(allowedClassIds)];

    if (allowedClassIds.length === 0) {
      return NextResponse.json({
        classes: [],
        terms: [],
      });
    }

    const [classesResult, termsResult] = await Promise.all([
      admin
        .from("classes")
        .select("id, level, section, display_name")
        .eq("workspace_id", workspace.id)
        .in("id", allowedClassIds)
        .order("level")
        .order("section"),

      admin
        .from("academic_terms")
        .select("id, session_name, term_number, is_current, starts_on, ends_on")
        .eq("school_id", profile.school_id)
        .order("session_name", { ascending: false })
        .order("term_number"),
    ]);

    if (classesResult.error || termsResult.error) {
      console.error(
        "Reports options query error:",
        classesResult.error || termsResult.error,
      );

      return NextResponse.json(
        { error: "Unable to load report options" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      classes: classesResult.data ?? [],
      terms: termsResult.data ?? [],
    });
  } catch (error) {
    console.error("Reports options API error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
