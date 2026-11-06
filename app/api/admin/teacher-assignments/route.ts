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

  const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, school_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return { error: "Forbidden: Admin access required", status: 403 };
  }

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id")
    .eq("school_id", profile.school_id)
    .limit(1)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return { error: "School workspace not found", status: 404 };
  }

  return {
    admin,
    schoolId: profile.school_id,
    workspaceId: workspace.id,
  };
}

// GET: Load teachers, classes, subjects and existing assignments.
export async function GET() {
  try {
    const context = await getAdminContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const { admin, schoolId, workspaceId } = context;

    const [
      teachersResult,
      classesResult,
      subjectsResult,
      classSubjectsResult,
      classAssignmentsResult,
      subjectAssignmentsResult,
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("id, full_name")
        .eq("school_id", schoolId)
        .eq("role", "teacher")
        .order("full_name"),

      admin
        .from("classes")
        .select("id, level, section, display_name")
        .eq("workspace_id", workspaceId)
        .order("level"),

      admin
        .from("subjects")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name"),

      admin
        .from("class_subjects")
        .select("id, class_id, subject_id")
        .eq("workspace_id", workspaceId),

      admin
        .from("teacher_class_assignments")
        .select("id, teacher_id, class_id, assigned_at")
        .eq("workspace_id", workspaceId),

      admin
        .from("subject_teacher_assignments")
        .select("id, teacher_id, class_subject_id, assigned_at")
        .eq("workspace_id", workspaceId),
    ]);

    const results = [
      teachersResult,
      classesResult,
      subjectsResult,
      classSubjectsResult,
      classAssignmentsResult,
      subjectAssignmentsResult,
    ];

    const failedQuery = results.find((result) => result.error);

    if (failedQuery?.error) {
      console.error("Teacher assignments fetch error:", failedQuery.error);

      return NextResponse.json(
        { error: "Unable to fetch teacher assignment data" },
        { status: 500 },
      );
    }

    const teachers = teachersResult.data ?? [];
    const classes = classesResult.data ?? [];
    const subjects = subjectsResult.data ?? [];
    const classSubjects = classSubjectsResult.data ?? [];
    const classAssignments = classAssignmentsResult.data ?? [];
    const subjectAssignments = subjectAssignmentsResult.data ?? [];

    const classSubjectDetails = classSubjects.map((item) => {
      const classInfo = classes.find(
        (classItem) => classItem.id === item.class_id,
      );

      const subjectInfo = subjects.find(
        (subject) => subject.id === item.subject_id,
      );

      return {
        id: item.id,
        class_id: item.class_id,
        subject_id: item.subject_id,
        class_name: classInfo?.display_name ?? "Unknown class",
        subject_name: subjectInfo?.name ?? "Unknown subject",
      };
    });

    const formattedClassAssignments = classAssignments.map((assignment) => {
      const teacher = teachers.find(
        (item) => item.id === assignment.teacher_id,
      );

      const classInfo = classes.find((item) => item.id === assignment.class_id);

      return {
        ...assignment,
        teacher_name: teacher?.full_name ?? "Unknown teacher",
        class_name: classInfo?.display_name ?? "Unknown class",
      };
    });

    const formattedSubjectAssignments = subjectAssignments.map((assignment) => {
      const teacher = teachers.find(
        (item) => item.id === assignment.teacher_id,
      );

      const classSubject = classSubjectDetails.find(
        (item) => item.id === assignment.class_subject_id,
      );

      return {
        ...assignment,
        teacher_name: teacher?.full_name ?? "Unknown teacher",
        class_name: classSubject?.class_name ?? "Unknown class",
        subject_name: classSubject?.subject_name ?? "Unknown subject",
      };
    });

    return NextResponse.json({
      teachers,
      classes,
      classSubjects: classSubjectDetails,
      classAssignments: formattedClassAssignments,
      subjectAssignments: formattedSubjectAssignments,
    });
  } catch (error) {
    console.error("Teacher assignments GET error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

// POST: Assign a class teacher or subject teacher.
export async function POST(request: Request) {
  try {
    const context = await getAdminContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const { admin, schoolId, workspaceId } = context;

    const body = await request.json();

    const { assignment_type, teacher_id, class_id, class_subject_id } = body;

    if (!teacher_id || !assignment_type) {
      return NextResponse.json(
        { error: "Teacher and assignment type are required" },
        { status: 400 },
      );
    }

    if (!["class", "subject"].includes(assignment_type)) {
      return NextResponse.json(
        { error: "Invalid assignment type" },
        { status: 400 },
      );
    }

    // Confirm that the selected user is a teacher in this school.
    const { data: teacher, error: teacherError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", teacher_id)
      .eq("school_id", schoolId)
      .eq("role", "teacher")
      .maybeSingle();

    if (teacherError || !teacher) {
      return NextResponse.json(
        { error: "Selected teacher was not found in this school" },
        { status: 400 },
      );
    }

    if (assignment_type === "class") {
      if (!class_id) {
        return NextResponse.json(
          { error: "Please select a class" },
          { status: 400 },
        );
      }

      const { data: selectedClass, error: classError } = await admin
        .from("classes")
        .select("id")
        .eq("id", class_id)
        .eq("workspace_id", workspaceId)
        .eq("school_id", schoolId)
        .maybeSingle();

      if (classError || !selectedClass) {
        return NextResponse.json(
          { error: "Selected class was not found" },
          { status: 400 },
        );
      }

      const { data, error } = await admin
        .from("teacher_class_assignments")
        .insert({
          school_id: schoolId,
          workspace_id: workspaceId,
          teacher_id,
          class_id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          return NextResponse.json(
            { error: "This teacher is already assigned to this class" },
            { status: 409 },
          );
        }

        console.error("Class teacher assignment error:", error);

        return NextResponse.json(
          { error: "Unable to assign class teacher" },
          { status: 500 },
        );
      }

      return NextResponse.json({
        message: "Class teacher assigned successfully",
        assignment: data,
      });
    }

    if (!class_subject_id) {
      return NextResponse.json(
        { error: "Please select a class and subject" },
        { status: 400 },
      );
    }

    const { data: selectedClassSubject, error: classSubjectError } = await admin
      .from("class_subjects")
      .select("id")
      .eq("id", class_subject_id)
      .eq("workspace_id", workspaceId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (classSubjectError || !selectedClassSubject) {
      return NextResponse.json(
        { error: "Selected class-subject combination was not found" },
        { status: 400 },
      );
    }

    const { data, error } = await admin
      .from("subject_teacher_assignments")
      .insert({
        school_id: schoolId,
        workspace_id: workspaceId,
        teacher_id,
        class_subject_id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "This teacher is already assigned to this subject in this class",
          },
          { status: 409 },
        );
      }

      console.error("Subject teacher assignment error:", error);

      return NextResponse.json(
        { error: "Unable to assign subject teacher" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Subject teacher assigned successfully",
      assignment: data,
    });
  } catch (error) {
    console.error("Teacher assignments POST error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
