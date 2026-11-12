"use client";

import { useEffect, useMemo, useState } from "react";

type Score = {
  id: string;
  test_score: number | null;
  assignment_score: number | null;
  classwork_score: number | null;
  examination_score: number | null;
  total_score: number;
  grade: string;
};

type Student = {
  id: string;
  admission_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: string;
  enrollment_id: string;
  class_id: string;
  score: Score | null;
};

type ClassSubject = {
  id: string;
  class_id: string;
  subject_id: string;
  subject_name: string;
};

type TeacherClass = {
  id: string;
  level: string;
  section: string;
  display_name: string;
  is_class_teacher: boolean;
  subjects: ClassSubject[];
  student_count: number;
};

type WorkspaceResponse = {
  teacher: {
    id: string;
    full_name: string;
  };
  currentTerm: {
    id: string;
    session_name: string;
    term_number: number;
  } | null;
  classes: TeacherClass[];
  students: Student[];
};

type ScoreForm = {
  testScore: string;
  assignmentScore: string;
  classworkScore: string;
  examinationScore: string;
};

export default function TeacherScoreEntry() {
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [loadingScores, setLoadingScores] = useState(false);
  const [savingEnrollment, setSavingEnrollment] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [scoreForms, setScoreForms] = useState<Record<string, ScoreForm>>({});

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const response = await fetch("/api/teacher/workspace");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load teacher workspace.");
        }

        setWorkspace(data);

       if (data.classes?.length) {
         const firstClass = data.classes[0];

         setSelectedClass(firstClass.id);
         setSelectedSubject(firstClass.subjects?.[0]?.id ?? "");
       }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load workspace.",
        );
      } finally {
        setLoadingWorkspace(false);
      }
    }

    loadWorkspace();
  }, []);

  const currentClass = useMemo(
    () => workspace?.classes.find((item) => item.id === selectedClass),
    [workspace, selectedClass],
  );

  const classSubjects = currentClass?.subjects ?? [];

  // useEffect(() => {
  //   setSelectedSubject(classSubjects[0]?.id ?? "");
  // }, [selectedClass, workspace]);

  useEffect(() => {
    let cancelled = false;

    async function loadScores() {
      if (!selectedClass || !selectedSubject || !workspace?.currentTerm?.id) {
        setStudents([]);
        setScoreForms({});
        return;
      }

      setLoadingScores(true);
      setError("");
      setMessage("");

      try {
        const params = new URLSearchParams({
          classId: selectedClass,
          classSubjectId: selectedSubject,
          termId: workspace.currentTerm.id,
        });

        const response = await fetch(`/api/teacher/scores?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load scores.");
        }

        if (cancelled) return;

        setStudents(data.students ?? []);

        const forms: Record<string, ScoreForm> = {};

        for (const student of data.students ?? []) {
          forms[student.enrollment_id] = {
            testScore: student.score?.test_score?.toString() ?? "",
            assignmentScore: student.score?.assignment_score?.toString() ?? "",
            classworkScore: student.score?.classwork_score?.toString() ?? "",
            examinationScore:
              student.score?.examination_score?.toString() ?? "",
          };
        }

        setScoreForms(forms);
      } catch (err) {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : "Unable to load scores.");
        setStudents([]);
      } finally {
        if (!cancelled) {
          setLoadingScores(false);
        }
      }
    }

    loadScores();

    return () => {
      cancelled = true;
    };
  }, [selectedClass, selectedSubject, workspace?.currentTerm?.id]);

  function updateScore(
    enrollmentId: string,
    field: keyof ScoreForm,
    value: string,
  ) {
    setScoreForms((previous) => ({
      ...previous,
      [enrollmentId]: {
        ...previous[enrollmentId],
        [field]: value,
      },
    }));
  }

  function calculateTotal(enrollmentId: string) {
    const form = scoreForms[enrollmentId];

    if (!form) return null;

    const values = [
      form.testScore,
      form.assignmentScore,
      form.classworkScore,
      form.examinationScore,
    ];

    if (values.every((value) => value.trim() === "")) return null;

    return values.reduce(
      (total, value) => total + (value.trim() === "" ? 0 : Number(value)),
      0,
    );
  }

  function calculateGrade(total: number | null) {
    if (total === null) return "-";
    if (total >= 70) return "A";
    if (total >= 60) return "B";
    if (total >= 50) return "C";
    if (total >= 45) return "D";
    if (total >= 40) return "E";
    return "F";
  }

  async function saveScore(student: Student) {
    const form = scoreForms[student.enrollment_id];

    if (!form || !workspace?.currentTerm?.id) return;

    setError("");
    setMessage("");

    const scoreFields = [
      { label: "Test", value: form.testScore, max: 20 },
      { label: "Assignment", value: form.assignmentScore, max: 10 },
      { label: "Classwork", value: form.classworkScore, max: 10 },
      { label: "Examination", value: form.examinationScore, max: 60 },
    ];

    for (const field of scoreFields) {
      if (field.value.trim() === "") continue;

      const value = Number(field.value);

      if (!Number.isFinite(value) || value < 0 || value > field.max) {
        setError(`${field.label} score must be between 0 and ${field.max}.`);
        return;
      }
    }

    setSavingEnrollment(student.enrollment_id);

    const payload = {
      classId: selectedClass,
      classSubjectId: selectedSubject,
      termId: workspace.currentTerm.id,
      enrollmentId: student.enrollment_id,
      testScore: form.testScore === "" ? null : Number(form.testScore),
      assignmentScore:
        form.assignmentScore === "" ? null : Number(form.assignmentScore),
      classworkScore:
        form.classworkScore === "" ? null : Number(form.classworkScore),
      examinationScore:
        form.examinationScore === "" ? null : Number(form.examinationScore),
    };

    try {
      const response = await fetch("/api/teacher/scores", {
        method: student.score ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          student.score ? { ...payload, scoreId: student.score.id } : payload,
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save scores.");
      }

      setStudents((previous) =>
        previous.map((item) =>
          item.enrollment_id === student.enrollment_id
            ? { ...item, score: data.score }
            : item,
        ),
      );

      setMessage(`${student.first_name}'s scores saved successfully.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save scores.");
    } finally {
      setSavingEnrollment(null);
    }
  }

  if (loadingWorkspace) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading your teaching workspace...
      </div>
    );
  }

  if (error && !workspace) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!workspace?.classes?.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8">
        <h2 className="text-lg font-bold">Score entry</h2>
        <p className="mt-2 text-sm text-slate-500">
          You have not been assigned to any classes or subjects yet.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-bold tracking-widest text-blue-600">
            TEACHER WORKSPACE
          </p>
          <h2 className="mt-2 text-2xl font-extrabold">Score entry</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter and manage student assessment scores.
          </p>
        </div>

        {workspace.currentTerm && (
          <div className="rounded-xl bg-blue-50 px-4 py-3">
            <p className="text-xs text-blue-600">Current academic session</p>
            <p className="mt-1 font-bold text-blue-900">
              {workspace.currentTerm.session_name} · Term{" "}
              {workspace.currentTerm.term_number}
            </p>
          </div>
        )}
      </div>

      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold">
            Select class
          </label>
          <select
            value={selectedClass}
            onChange={(event) => {
              const classId = event.target.value;

              const nextClass = workspace.classes.find(
                (item) => item.id === classId,
              );

              setSelectedClass(classId);
              setSelectedSubject(nextClass?.subjects[0]?.id ?? "");
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {workspace.classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.display_name}
                {item.is_class_teacher ? " (Class Teacher)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Select subject
          </label>
          <select
            value={selectedSubject}
            onChange={(event) => setSelectedSubject(event.target.value)}
            disabled={!classSubjects.length}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          >
            {classSubjects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.subject_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!workspace.currentTerm && (
        <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          No current academic term has been configured.
        </div>
      )}

      {message && (
        <div className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-7 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-4">Student</th>
              <th className="px-3 py-4">Test /20</th>
              <th className="px-3 py-4">Assignment /10</th>
              <th className="px-3 py-4">Classwork /10</th>
              <th className="px-3 py-4">Exam /60</th>
              <th className="px-3 py-4">Total</th>
              <th className="px-3 py-4">Grade</th>
              <th className="px-4 py-4">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loadingScores ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  Loading students and scores...
                </td>
              </tr>
            ) : students.length ? (
              students.map((student) => {
                const total = calculateTotal(student.enrollment_id);

                const fields: {
                  key: keyof ScoreForm;
                  max: number;
                  label: string;
                }[] = [
                  { key: "testScore", max: 20, label: "Test" },
                  { key: "assignmentScore", max: 10, label: "Assignment" },
                  { key: "classworkScore", max: 10, label: "Classwork" },
                  { key: "examinationScore", max: 60, label: "Examination" },
                ];

                return (
                  <tr key={student.enrollment_id}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">
                        {student.first_name} {student.middle_name ?? ""}{" "}
                        {student.last_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {student.admission_number}
                      </p>
                    </td>

                    {fields.map((field) => (
                      <td key={field.key} className="px-3 py-4">
                        <input
                          type="number"
                          min="0"
                          max={field.max}
                          step="0.01"
                          value={
                            scoreForms[student.enrollment_id]?.[field.key] ?? ""
                          }
                          onChange={(event) =>
                            updateScore(
                              student.enrollment_id,
                              field.key,
                              event.target.value,
                            )
                          }
                          aria-label={`${student.first_name} ${field.label}`}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </td>
                    ))}

                    <td className="px-3 py-4 font-bold">
                      {total === null ? "-" : total.toFixed(2)}
                    </td>

                    <td className="px-3 py-4">
                      <span className="rounded-lg bg-blue-50 px-3 py-1 font-bold text-blue-700">
                        {calculateGrade(total)}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() => saveScore(student)}
                        disabled={savingEnrollment === student.enrollment_id}
                        className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingEnrollment === student.enrollment_id
                          ? "Saving..."
                          : student.score
                            ? "Update"
                            : "Save"}
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-slate-500"
                >
                  No active students found in this class.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Assessment breakdown: Test 20, Assignment 10, Classwork 10 and
        Examination 60. Maximum total: 100.
      </p>
    </section>
  );
}
