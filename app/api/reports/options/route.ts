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
      return NextResponse.json(
        { error: "Report access denied" },
        { status: 403 },
      );
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

    let classes: {
      id: string;
      level: string;
      section: string;
      display_name: string;
    }[] = [];

    if (profile.role === "admin") {
      const { data, error } = await admin
        .from("classes")
        .select("id, level, section, display_name")
        .eq("workspace_id", workspace.id)
        .order("level")
        .order("section");

      if (error) throw error;

      classes = data ?? [];
    } else {
      const [classAssignments, subjectAssignments] = await Promise.all([
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

      if (classAssignments.error || subjectAssignments.error) {
        throw classAssignments.error || subjectAssignments.error;
      }

      const classIds = new Set(
        (classAssignments.data ?? []).map((item) => item.class_id),
      );

      const classSubjectIds = (subjectAssignments.data ?? []).map(
        (item) => item.class_subject_id,
      );

      if (classSubjectIds.length > 0) {
        const { data, error } = await admin
          .from("class_subjects")
          .select("class_id")
          .eq("workspace_id", workspace.id)
          .in("id", classSubjectIds);

        if (error) throw error;

        (data ?? []).forEach((item) => {
          classIds.add(item.class_id);
        });
      }

      if (classIds.size > 0) {
        const { data, error } = await admin
          .from("classes")
          .select("id, level, section, display_name")
          .eq("workspace_id", workspace.id)
          .in("id", [...classIds])
          .order("level")
          .order("section");

        if (error) throw error;

        classes = data ?? [];
      }
    }

    const { data: terms, error: termsError } = await admin
      .from("academic_terms")
      .select("id, session_name, term_number, is_current, starts_on, ends_on")
      .eq("school_id", profile.school_id)
      .order("session_name", { ascending: false })
      .order("term_number", { ascending: true });

    if (termsError) throw termsError;

    return NextResponse.json({
      classes,
      terms: terms ?? [],
    });
  } catch (error) {
    console.error("Reports options API error:", error);

    return NextResponse.json(
      { error: "Unable to load report options" },
      { status: 500 },
    );
  }
}
