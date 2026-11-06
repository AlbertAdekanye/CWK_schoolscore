import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function getTeacherContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, school_id, full_name, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "teacher") {
    return { error: "Teacher access required", status: 403 } as const;
  }

  const { data: workspace, error: workspaceError } = await admin
    .from("workspaces")
    .select("id")
    .eq("school_id", profile.school_id)
    .limit(1)
    .maybeSingle();

  if (workspaceError || !workspace) {
    return { error: "School workspace not found", status: 404 } as const;
  }

  return {
    admin,
    teacherId: profile.id,
    schoolId: profile.school_id,
    workspaceId: workspace.id,
    teacherName: profile.full_name,
  };
}

export async function GET() {
  try {
    const context = await getTeacherContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const { admin, teacherId, schoolId, workspaceId, teacherName } = context;

    // Get this teacher's assignments and the current academic term.
    const [
      classAssignmentsResult,
      subjectAssignmentsResult,
      currentTermResult,
    ] = await Promise.all([
      admin
        .from("teacher_class_assignments")
        .select("id, class_id, assigned_at")
        .eq("teacher_id", teacherId)
        .eq("workspace_id", workspaceId),

      admin
        .from("subject_teacher_assignments")
        .select("id, class_subject_id, assigned_at")
        .eq("teacher_id", teacherId)
        .eq("workspace_id", workspaceId),

      admin
        .from("academic_terms")
        .select("id, session_name, term_number, starts_on, ends_on")
        .eq("school_id", schoolId)
        .eq("is_current", true)
        .maybeSingle(),
    ]);

    const initialResults = [
      classAssignmentsResult,
      subjectAssignmentsResult,
      currentTermResult,
    ];

    const initialError = initialResults.find((result) => result.error);

    if (initialError?.error) {
      console.error(
        "Teacher workspace initial query error:",
        initialError.error,
      );

      return NextResponse.json(
        { error: "Unable to load teacher assignments" },
        { status: 500 },
      );
    }

    const classAssignments = classAssignmentsResult.data ?? [];
    const subjectAssignments = subjectAssignmentsResult.data ?? [];
    const currentTerm = currentTermResult.data;

    const classSubjectIds = subjectAssignments.map(
      (assignment) => assignment.class_subject_id,
    );

    // Resolve the subject assignments to their respective classes.
    let assignedClassSubjects: {
      id: string;
      class_id: string;
      subject_id: string;
    }[] = [];

    if (classSubjectIds.length > 0) {
      const { data, error } = await admin
        .from("class_subjects")
        .select("id, class_id, subject_id")
        .eq("workspace_id", workspaceId)
        .in("id", classSubjectIds);

      if (error) {
        console.error("Teacher class subjects error:", error);

        return NextResponse.json(
          { error: "Unable to load assigned subjects" },
          { status: 500 },
        );
      }

      assignedClassSubjects = data ?? [];
    }

    // Combine classes assigned directly and classes reached through subjects.
    const assignedClassIds = [
      ...new Set([
        ...classAssignments.map((assignment) => assignment.class_id),
        ...assignedClassSubjects.map((item) => item.class_id),
      ]),
    ];

    if (assignedClassIds.length === 0) {
      return NextResponse.json({
        teacher: {
          id: teacherId,
          full_name: teacherName,
        },
        currentTerm,
        classes: [],
        students: [],
        classAssignments: [],
        subjectAssignments: [],
      });
    }

    const [
      classesResult,
      allClassSubjectsResult,
      subjectsResult,
      enrollmentsResult,
    ] = await Promise.all([
      admin
        .from("classes")
        .select("id, level, section, display_name")
        .eq("workspace_id", workspaceId)
        .in("id", assignedClassIds)
        .order("level"),

      admin
        .from("class_subjects")
        .select("id, class_id, subject_id")
        .eq("workspace_id", workspaceId)
        .in("class_id", assignedClassIds),

      admin
        .from("subjects")
        .select("id, name")
        .eq("school_id", schoolId)
        .order("name"),

      currentTerm
        ? admin
            .from("enrollments")
            .select("id, class_id, student_id, academic_year")
            .eq("workspace_id", workspaceId)
            .eq("academic_year", currentTerm.session_name)
            .eq("is_active", true)
            .in("class_id", assignedClassIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const secondResults = [
      classesResult,
      allClassSubjectsResult,
      subjectsResult,
      enrollmentsResult,
    ];

    const secondError = secondResults.find((result) => result.error);

    if (secondError?.error) {
      console.error("Teacher workspace data error:", secondError.error);

      return NextResponse.json(
        { error: "Unable to load classes and students" },
        { status: 500 },
      );
    }

    const classes = classesResult.data ?? [];
    const allClassSubjects = allClassSubjectsResult.data ?? [];
    const subjects = subjectsResult.data ?? [];
    const enrollments = enrollmentsResult.data ?? [];

    const classTeacherIds = new Set(
      classAssignments.map((assignment) => assignment.class_id),
    );

    const subjectTeacherIds = new Set(classSubjectIds);

    // Class teachers can see all subjects in their assigned classes.
    // Subject teachers can only see their assigned subjects.
    const visibleClassSubjects = allClassSubjects.filter((item) => {
      return (
        classTeacherIds.has(item.class_id) || subjectTeacherIds.has(item.id)
      );
    });

    const formattedClassSubjects = visibleClassSubjects.map((item) => {
      const subject = subjects.find(
        (subjectItem) => subjectItem.id === item.subject_id,
      );

      const schoolClass = classes.find(
        (classItem) => classItem.id === item.class_id,
      );

      return {
        id: item.id,
        class_id: item.class_id,
        subject_id: item.subject_id,
        class_name: schoolClass?.display_name ?? "Unknown class",
        subject_name: subject?.name ?? "Unknown subject",
      };
    });

    // Get the actual student records for the active enrollments.
    const studentIds = [...new Set(enrollments.map((item) => item.student_id))];

    let students: {
      id: string;
      first_name: string;
      last_name: string;
      middle_name: string | null;
      admission_number: string | null;
      gender: string | null;
      date_of_birth: string | null;
    }[] = [];

    if (studentIds.length > 0) {
      const { data, error } = await admin
        .from("students")
        .select(
          "id, first_name, last_name, middle_name, admission_number, gender, date_of_birth",
        )
        .eq("workspace_id", workspaceId)
        .in("id", studentIds)
        .order("last_name");

      if (error) {
        console.error("Teacher workspace students error:", error);

        return NextResponse.json(
          { error: "Unable to load student records" },
          { status: 500 },
        );
      }

      students = data ?? [];
    }

    // Combine student details with their enrollment IDs.
    const formattedStudents = enrollments
      .map((enrollment) => {
        const student = students.find(
          (item) => item.id === enrollment.student_id,
        );

        if (!student) return null;

        const schoolClass = classes.find(
          (item) => item.id === enrollment.class_id,
        );

        return {
          ...student,
          enrollment_id: enrollment.id,
          class_id: enrollment.class_id,
          class_name: schoolClass?.display_name ?? "Unknown class",
          academic_year: enrollment.academic_year,
        };
      })
      .filter(Boolean);

    const formattedClassAssignments = classAssignments.map((assignment) => {
      const schoolClass = classes.find(
        (item) => item.id === assignment.class_id,
      );

      return {
        ...assignment,
        class_name: schoolClass?.display_name ?? "Unknown class",
      };
    });

    const formattedSubjectAssignments = subjectAssignments.map((assignment) => {
      const classSubject = formattedClassSubjects.find(
        (item) => item.id === assignment.class_subject_id,
      );

      return {
        ...assignment,
        class_name: classSubject?.class_name ?? "Unknown class",
        subject_name: classSubject?.subject_name ?? "Unknown subject",
      };
    });

    const formattedClasses = classes.map((schoolClass) => ({
      ...schoolClass,
      is_class_teacher: classTeacherIds.has(schoolClass.id),
      subjects: formattedClassSubjects.filter(
        (item) => item.class_id === schoolClass.id,
      ),
      student_count: formattedStudents.filter(
        (student) => student?.class_id === schoolClass.id,
      ).length,
    }));

    return NextResponse.json({
      teacher: {
        id: teacherId,
        full_name: teacherName,
      },
      currentTerm,
      classes: formattedClasses,
      students: formattedStudents,
      classAssignments: formattedClassAssignments,
      subjectAssignments: formattedSubjectAssignments,
    });
  } catch (error) {
    console.error("Teacher workspace GET error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
