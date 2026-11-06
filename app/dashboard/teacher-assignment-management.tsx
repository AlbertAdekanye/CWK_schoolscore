"use client";

import { useEffect, useState } from "react";

type Teacher = {
  id: string;
  full_name: string;
};

type SchoolClass = {
  id: string;
  display_name: string;
  level: string;
  section: string;
};

type ClassSubject = {
  id: string;
  class_id: string;
  subject_id: string;
  class_name: string;
  subject_name: string;
};

type ClassAssignment = {
  id: string;
  teacher_id: string;
  class_id: string;
  teacher_name: string;
  class_name: string;
  assigned_at: string;
};

type SubjectAssignment = {
  id: string;
  teacher_id: string;
  class_subject_id: string;
  teacher_name: string;
  class_name: string;
  subject_name: string;
  assigned_at: string;
};

type AssignmentData = {
  teachers: Teacher[];
  classes: SchoolClass[];
  classSubjects: ClassSubject[];
  classAssignments: ClassAssignment[];
  subjectAssignments: SubjectAssignment[];
};

export default function TeacherAssignmentManagement() {
  const [data, setData] = useState<AssignmentData>({
    teachers: [],
    classes: [],
    classSubjects: [],
    classAssignments: [],
    subjectAssignments: [],
  });

  const [assignmentType, setAssignmentType] = useState<"class" | "subject">(
    "subject",
  );

  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [classSubjectId, setClassSubjectId] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchAssignments() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/teacher-assignments");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load assignments");
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAssignments();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (!teacherId) {
      setError("Please select a teacher.");
      return;
    }

    if (assignmentType === "class" && !classId) {
      setError("Please select a class.");
      return;
    }

    if (assignmentType === "subject" && !classSubjectId) {
      setError("Please select a class and subject.");
      return;
    }

    try {
      setSubmitting(true);

      const payload =
        assignmentType === "class"
          ? {
              assignment_type: "class",
              teacher_id: teacherId,
              class_id: classId,
            }
          : {
              assignment_type: "subject",
              teacher_id: teacherId,
              class_subject_id: classSubjectId,
            };

      const response = await fetch("/api/admin/teacher-assignments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to create assignment");
      }

      setSuccess(result.message || "Assignment created successfully.");

      setTeacherId("");
      setClassId("");
      setClassSubjectId("");

      await fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedClassSubjects = data.classSubjects.filter(
    (item) => item.class_id === classId,
  );

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Teacher Assignments
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Assign teachers to classes and subjects.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAssignments}
          disabled={loading}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Assignment statistics */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-blue-50 p-4">
          <p className="text-sm text-blue-700">Available Teachers</p>
          <p className="mt-2 text-2xl font-bold text-blue-900">
            {data.teachers.length}
          </p>
        </div>

        <div className="rounded-xl bg-purple-50 p-4">
          <p className="text-sm text-purple-700">Class Teachers</p>
          <p className="mt-2 text-2xl font-bold text-purple-900">
            {data.classAssignments.length}
          </p>
        </div>

        <div className="rounded-xl bg-green-50 p-4">
          <p className="text-sm text-green-700">Subject Teachers</p>
          <p className="mt-2 text-2xl font-bold text-green-900">
            {data.subjectAssignments.length}
          </p>
        </div>
      </div>

      {/* Assignment form */}
      <div className="mb-8 rounded-xl border border-gray-200 p-5">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          Create Assignment
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Assignment Type
            </label>

            <select
              value={assignmentType}
              onChange={(e) => {
                setAssignmentType(e.target.value as "class" | "subject");
                setClassId("");
                setClassSubjectId("");
                setError("");
                setSuccess("");
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="subject">Subject Teacher</option>
              <option value="class">Class Teacher</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Select Teacher
            </label>

            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Choose a teacher</option>

              {data.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                </option>
              ))}
            </select>

            {data.teachers.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No teachers are available. Invite a teacher first.
              </p>
            )}
          </div>

          {assignmentType === "class" ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Select Class
              </label>

              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Choose a class</option>

                {data.classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.display_name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Select Class
                </label>

                <select
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setClassSubjectId("");
                  }}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Choose a class</option>

                  {data.classes.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Select Subject
                </label>

                <select
                  value={classSubjectId}
                  onChange={(e) => setClassSubjectId(e.target.value)}
                  required
                  disabled={!classId}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  <option value="">Choose a subject</option>

                  {selectedClassSubjects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.subject_name}
                    </option>
                  ))}
                </select>

                {classId && selectedClassSubjects.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No subjects have been assigned to this class yet.
                  </p>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={
              submitting ||
              loading ||
              data.teachers.length === 0 ||
              (assignmentType === "class"
                ? !classId
                : !classId || !classSubjectId)
            }
            className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {submitting ? "Assigning..." : "Create Assignment"}
          </button>
        </form>
      </div>

      {/* Existing class teacher assignments */}
      <div className="mb-8">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Class Teacher Assignments
          </h3>
          <p className="text-sm text-gray-500">
            Teachers responsible for overseeing classes.
          </p>
        </div>

        {data.classAssignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
            <p className="text-sm text-gray-500">
              No class teachers have been assigned yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[450px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Teacher</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">Assigned</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {data.classAssignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {assignment.teacher_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {assignment.class_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(assignment.assigned_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Existing subject teacher assignments */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Subject Teacher Assignments
          </h3>
          <p className="text-sm text-gray-500">
            Teachers responsible for individual subjects.
          </p>
        </div>

        {data.subjectAssignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center">
            <p className="text-sm text-gray-500">
              No subject teachers have been assigned yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Teacher</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Assigned</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {data.subjectAssignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {assignment.teacher_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {assignment.class_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {assignment.subject_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(assignment.assigned_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
