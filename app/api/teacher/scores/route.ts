import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ScoreValues = {
  test_score: number | null;
  assignment_score: number | null;
  classwork_score: number | null;
  examination_score: number | null;
};

async function getTeacherContext() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized", status: 401 } as const;
  }

  const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, school_id, role")
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
  };
}

async function verifyClassSubjectAccess(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  teacherId: string,
  workspaceId: string,
  classId: string,
  classSubjectId: string,
) {
  const { data: classSubject, error: classSubjectError } = await admin
    .from("class_subjects")
    .select("id, class_id")
    .eq("id", classSubjectId)
    .eq("class_id", classId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (classSubjectError) {
    return { error: "Unable to verify subject", status: 500 } as const;
  }

  if (!classSubject) {
    return { error: "Invalid class or subject", status: 404 } as const;
  }

  const [classAssignment, subjectAssignment] = await Promise.all([
    admin
      .from("teacher_class_assignments")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("workspace_id", workspaceId)
      .eq("class_id", classId)
      .maybeSingle(),

    admin
      .from("subject_teacher_assignments")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("workspace_id", workspaceId)
      .eq("class_subject_id", classSubjectId)
      .maybeSingle(),
  ]);

  if (classAssignment.error || subjectAssignment.error) {
    return {
      error: "Unable to verify teacher assignments",
      status: 500,
    } as const;
  }

  if (!classAssignment.data && !subjectAssignment.data) {
    return {
      error: "You are not assigned to this class or subject",
      status: 403,
    } as const;
  }

  return { success: true } as const;
}

function parseScore(
  value: unknown,
  fieldName: string,
  maximum: number,
): { value: number | null; error?: string } {
  if (value === undefined || value === null || value === "") {
    return { value: null };
  }

  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isFinite(parsed)) {
    return {
      value: null,
      error: `${fieldName} must be a valid number`,
    };
  }

  if (parsed < 0 || parsed > maximum) {
    return {
      value: null,
      error: `${fieldName} must be between 0 and ${maximum}`,
    };
  }

  return { value: parsed };
}

function validateScores(body: Record<string, unknown>) {
  const test = parseScore(body.testScore, "Test score", 20);
  const assignment = parseScore(body.assignmentScore, "Assignment score", 10);
  const classwork = parseScore(body.classworkScore, "Classwork score", 10);
  const examination = parseScore(
    body.examinationScore,
    "Examination score",
    60,
  );

  const error =
    test.error || assignment.error || classwork.error || examination.error;

  if (error) {
    return { error } as const;
  }

  const scores: ScoreValues = {
    test_score: test.value,
    assignment_score: assignment.value,
    classwork_score: classwork.value,
    examination_score: examination.value,
  };

  return { scores } as const;
}

async function verifyTerm(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  schoolId: string,
  termId: string,
) {
  const { data: term, error } = await admin
    .from("academic_terms")
    .select("id, session_name")
    .eq("id", termId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    return { error: "Unable to verify academic term", status: 500 } as const;
  }

  if (!term) {
    return { error: "Invalid academic term", status: 404 } as const;
  }

  return { term } as const;
}

async function verifyEnrollment(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  workspaceId: string,
  classId: string,
  enrollmentId: string,
  academicYear: string,
) {
  const { data: enrollment, error } = await admin
    .from("enrollments")
    .select("id")
    .eq("id", enrollmentId)
    .eq("workspace_id", workspaceId)
    .eq("class_id", classId)
    .eq("academic_year", academicYear)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return {
      error: "Unable to verify student enrollment",
      status: 500,
    } as const;
  }

  if (!enrollment) {
    return {
      error: "Student is not actively enrolled in this class for this session",
      status: 400,
    } as const;
  }

  return { enrollment } as const;
}

// GET: Retrieve student scores for a class, subject and term.
export async function GET(request: Request) {
  try {
    const context = await getTeacherContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const { admin, teacherId, schoolId, workspaceId } = context;

    const { searchParams } = new URL(request.url);

    const classId = searchParams.get("classId");
    const classSubjectId = searchParams.get("classSubjectId");
    const termId = searchParams.get("termId");

    if (!classId || !classSubjectId || !termId) {
      return NextResponse.json(
        { error: "classId, classSubjectId and termId are required" },
        { status: 400 },
      );
    }

    const access = await verifyClassSubjectAccess(
      admin,
      teacherId,
      workspaceId,
      classId,
      classSubjectId,
    );

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const termResult = await verifyTerm(admin, schoolId, termId);

    if ("error" in termResult) {
      return NextResponse.json(
        { error: termResult.error },
        { status: termResult.status },
      );
    }

    const { term } = termResult;

    const { data: enrollments, error: enrollmentError } = await admin
      .from("enrollments")
      .select("id, student_id")
      .eq("workspace_id", workspaceId)
      .eq("class_id", classId)
      .eq("academic_year", term.session_name)
      .eq("is_active", true);

    if (enrollmentError) {
      console.error("Score enrollment query error:", enrollmentError);

      return NextResponse.json(
        { error: "Unable to load enrolled students" },
        { status: 500 },
      );
    }

    const enrollmentList = enrollments ?? [];

    if (enrollmentList.length === 0) {
      return NextResponse.json({ students: [] });
    }

    const enrollmentIds = enrollmentList.map((item) => item.id);
    const studentIds = enrollmentList.map((item) => item.student_id);

    const [studentsResult, scoresResult] = await Promise.all([
      admin
        .from("students")
        .select(
          "id, admission_number, first_name, middle_name, last_name, gender",
        )
        .eq("workspace_id", workspaceId)
        .in("id", studentIds)
        .order("last_name"),

      admin
        .from("score_records")
        .select(
          "id, enrollment_id, test_score, assignment_score, classwork_score, examination_score, total_score, grade, updated_at",
        )
        .eq("workspace_id", workspaceId)
        .eq("class_id", classId)
        .eq("class_subject_id", classSubjectId)
        .eq("term_id", termId)
        .in("enrollment_id", enrollmentIds),
    ]);

    if (studentsResult.error || scoresResult.error) {
      console.error(
        "Score retrieval error:",
        studentsResult.error || scoresResult.error,
      );

      return NextResponse.json(
        { error: "Unable to load student scores" },
        { status: 500 },
      );
    }

    const scoresByEnrollment = new Map(
      (scoresResult.data ?? []).map((score) => [score.enrollment_id, score]),
    );

    const formattedStudents = enrollmentList
      .map((enrollment) => {
        const student = (studentsResult.data ?? []).find(
          (item) => item.id === enrollment.student_id,
        );

        if (!student) return null;

        const score = scoresByEnrollment.get(enrollment.id);

        return {
          ...student,
          enrollment_id: enrollment.id,
          score: score ?? null,
        };
      })
      .filter((student) => student !== null);

    return NextResponse.json({
      classId,
      classSubjectId,
      term,
      students: formattedStudents,
    });
  } catch (error) {
    console.error("Teacher scores GET error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

// POST: Create a new score record.
export async function POST(request: Request) {
  try {
    const context = await getTeacherContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const { admin, teacherId, schoolId, workspaceId } = context;

    const body = await request.json();

    const { classId, classSubjectId, termId, enrollmentId } = body;

    if (!classId || !classSubjectId || !termId || !enrollmentId) {
      return NextResponse.json(
        { error: "Class, subject, term and enrollment are required" },
        { status: 400 },
      );
    }

    const access = await verifyClassSubjectAccess(
      admin,
      teacherId,
      workspaceId,
      classId,
      classSubjectId,
    );

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const termResult = await verifyTerm(admin, schoolId, termId);

    if ("error" in termResult) {
      return NextResponse.json(
        { error: termResult.error },
        { status: termResult.status },
      );
    }

    const enrollmentResult = await verifyEnrollment(
      admin,
      workspaceId,
      classId,
      enrollmentId,
      termResult.term.session_name,
    );

    if ("error" in enrollmentResult) {
      return NextResponse.json(
        { error: enrollmentResult.error },
        { status: enrollmentResult.status },
      );
    }

    const validation = validateScores(body);

    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { data: score, error } = await admin
      .from("score_records")
      .insert({
        workspace_id: workspaceId,
        class_id: classId,
        enrollment_id: enrollmentId,
        class_subject_id: classSubjectId,
        term_id: termId,
        ...validation.scores,
      })
      .select(
        "id, enrollment_id, test_score, assignment_score, classwork_score, examination_score, total_score, grade, updated_at",
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "Scores already exist for this student, subject and term. Use PATCH to update them.",
          },
          { status: 409 },
        );
      }

      console.error("Score insert error:", error);

      return NextResponse.json(
        { error: "Unable to save scores" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: "Scores saved successfully",
        score,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Teacher scores POST error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}

// PATCH: Update an existing score record.
export async function PATCH(request: Request) {
  try {
    const context = await getTeacherContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const { admin, teacherId, schoolId, workspaceId } = context;

    const body = await request.json();

    const { scoreId, classId, classSubjectId, termId, enrollmentId } = body;

    if (!scoreId || !classId || !classSubjectId || !termId || !enrollmentId) {
      return NextResponse.json(
        { error: "Score, class, subject, term and enrollment are required" },
        { status: 400 },
      );
    }

    const access = await verifyClassSubjectAccess(
      admin,
      teacherId,
      workspaceId,
      classId,
      classSubjectId,
    );

    if ("error" in access) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status },
      );
    }

    const termResult = await verifyTerm(admin, schoolId, termId);

    if ("error" in termResult) {
      return NextResponse.json(
        { error: termResult.error },
        { status: termResult.status },
      );
    }

    const enrollmentResult = await verifyEnrollment(
      admin,
      workspaceId,
      classId,
      enrollmentId,
      termResult.term.session_name,
    );

    if ("error" in enrollmentResult) {
      return NextResponse.json(
        { error: enrollmentResult.error },
        { status: enrollmentResult.status },
      );
    }

    const validation = validateScores(body);

    if ("error" in validation) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { data: existingScore, error: existingError } = await admin
      .from("score_records")
      .select("id")
      .eq("id", scoreId)
      .eq("workspace_id", workspaceId)
      .eq("class_id", classId)
      .eq("enrollment_id", enrollmentId)
      .eq("class_subject_id", classSubjectId)
      .eq("term_id", termId)
      .maybeSingle();

    if (existingError) {
      console.error("Existing score lookup error:", existingError);

      return NextResponse.json(
        { error: "Unable to verify existing score" },
        { status: 500 },
      );
    }

    if (!existingScore) {
      return NextResponse.json(
        { error: "Score record not found" },
        { status: 404 },
      );
    }

    const { data: score, error } = await admin
      .from("score_records")
      .update({
        ...validation.scores,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scoreId)
      .eq("workspace_id", workspaceId)
      .select(
        "id, enrollment_id, test_score, assignment_score, classwork_score, examination_score, total_score, grade, updated_at",
      )
      .single();

    if (error) {
      console.error("Score update error:", error);

      return NextResponse.json(
        { error: "Unable to update scores" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Scores updated successfully",
      score,
    });
  } catch (error) {
    console.error("Teacher scores PATCH error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
