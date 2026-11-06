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

    // Get the school's workspace
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

    // Fetch students
    const { data: students, error: studentError } = await adminClient
      .from("students")
      .select(
        `
          id,
          admission_number,
          first_name,
          last_name,
          middle_name,
          gender,
          date_of_birth,
          created_at,
          workspace_id
        `,
      )
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });

    if (studentError) throw studentError;

    // Fetch class enrollments
    const { data: enrollments, error: enrollmentError } = await adminClient
      .from("enrollments")
      .select(
        `
          id,
          student_id,
          class_id,
          academic_year,
          is_active,
          classes (
            id,
            level,
            section,
            display_name
          )
        `,
      )
      .eq("workspace_id", workspace.id);

    if (enrollmentError) throw enrollmentError;

    const result = (students || []).map((student) => ({
      ...student,
      enrollment:
        (enrollments || []).find(
          (enrollment) =>
            enrollment.student_id === student.id && enrollment.is_active,
        ) || null,
    }));

    return NextResponse.json({ students: result });
  } catch (error) {
    console.error("Fetch students error:", error);

    return NextResponse.json(
      { error: "Unable to fetch students" },
      { status: 500 },
    );
  }
}

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

    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const middleName = String(body.middle_name || "").trim();
    const gender = body.gender || null;
    const dateOfBirth = body.date_of_birth || null;
    const classId = String(body.class_id || "");
    const academicYear = String(body.academic_year || "").trim();

    if (!firstName || !lastName || !classId || !academicYear) {
      return NextResponse.json(
        {
          error:
            "First name, last name, class and academic session are required",
        },
        { status: 400 },
      );
    }

    if (gender && !["Male", "Female", "Other"].includes(gender)) {
      return NextResponse.json(
        { error: "Invalid gender selected" },
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

    const { data: selectedClass, error: classError } = await adminClient
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("workspace_id", workspace.id)
      .single();

    if (classError || !selectedClass) {
      return NextResponse.json(
        { error: "Selected class was not found" },
        { status: 404 },
      );
    }

    const { data: term, error: termError } = await adminClient
      .from("academic_terms")
      .select("session_name")
      .eq("school_id", context.profile.school_id)
      .eq("session_name", academicYear)
      .eq("is_current", true)
      .maybeSingle();

    if (termError || !term) {
      return NextResponse.json(
        { error: "Select the academic session with the current term" },
        { status: 400 },
      );
    }

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .insert({
        workspace_id: workspace.id,
        first_name: firstName,
        last_name: lastName,
        middle_name: middleName || null,
        gender,
        date_of_birth: dateOfBirth || null,
      })
      .select(
        "id, admission_number, first_name, last_name, middle_name, gender, date_of_birth",
      )
      .single();

    if (studentError) throw studentError;

    const { error: enrollmentError } = await adminClient
      .from("enrollments")
      .insert({
        workspace_id: workspace.id,
        class_id: selectedClass.id,
        student_id: student.id,
        academic_year: academicYear,
        is_active: true,
      });

    if (enrollmentError) {
      await adminClient.from("students").delete().eq("id", student.id);

      throw enrollmentError;
    }

    return NextResponse.json(
      {
        message: "Student registered successfully",
        student,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Register student error:", error);

    return NextResponse.json(
      { error: "Unable to register student" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getAdminContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const body = await request.json();
    const studentId = String(body.student_id || "").trim();

    if (!studentId) {
      return NextResponse.json(
        { error: "Student ID is required" },
        { status: 400 },
      );
    }

    const adminClient = createSupabaseAdminClient();

    // Find the school's workspace
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

    // Confirm the student belongs to this school
    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, admission_number")
      .eq("id", studentId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    if (studentError) throw studentError;

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Find the student's enrollments
    const { data: enrollments, error: enrollmentFetchError } = await adminClient
      .from("enrollments")
      .select("id")
      .eq("student_id", studentId)
      .eq("workspace_id", workspace.id);

    if (enrollmentFetchError) throw enrollmentFetchError;

    const enrollmentIds = (enrollments || []).map(
      (enrollment) => enrollment.id,
    );

    // Protect existing academic records
    if (enrollmentIds.length > 0) {
      const { count, error: scoreError } = await adminClient
        .from("score_records")
        .select("id", { count: "exact", head: true })
        .in("enrollment_id", enrollmentIds);

      if (scoreError) throw scoreError;

      if (count && count > 0) {
        return NextResponse.json(
          {
            error: "This student has recorded scores and cannot be deleted.",
          },
          { status: 409 },
        );
      }
    }

    // Delete enrollments first
    const { error: deleteEnrollmentError } = await adminClient
      .from("enrollments")
      .delete()
      .eq("student_id", studentId)
      .eq("workspace_id", workspace.id);

    if (deleteEnrollmentError) throw deleteEnrollmentError;

    // Delete the student
    const { error: deleteStudentError } = await adminClient
      .from("students")
      .delete()
      .eq("id", studentId)
      .eq("workspace_id", workspace.id);

    if (deleteStudentError) throw deleteStudentError;

    return NextResponse.json({
      message: "Student deleted successfully",
      student_id: studentId,
    });
  } catch (error) {
    console.error("Delete student error:", error);

    return NextResponse.json(
      { error: "Unable to delete student" },
      { status: 500 },
    );
  }
}