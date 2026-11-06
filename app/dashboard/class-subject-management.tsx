"use client";

import { useEffect, useState } from "react";

type SchoolClass = {
  id: string;
  level: string;
  section: string;
  display_name: string;
};

type Subject = {
  id: string;
  name: string;
};

type Assignment = {
  id: string;
  class_id: string;
  subject_id: string;
  classes: SchoolClass;
  subjects: Subject;
};

export default function ClassSubjectManagement() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchData() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/class-subjects");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to fetch class subjects");
      }

      setClasses(data.classes || []);
      setSubjects(data.subjects || []);
      setAssignments(data.assignments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/class-subjects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          class_id: classId,
          subject_id: subjectId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to assign subject");
      }

      setSuccess("Subject assigned to class successfully.");

      setSubjectId("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const groupedAssignments = classes.map((schoolClass) => ({
    ...schoolClass,
    subjects: assignments.filter(
      (assignment) => assignment.class_id === schoolClass.id,
    ),
  }));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          Class-Subject Management
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Assign subjects to the classes that offer them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total classes</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {classes.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Available subjects</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {subjects.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Subject assignments</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {assignments.length}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Assign subject to class
        </h3>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Select class
              </label>

              <select
                required
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Choose a class</option>

                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Select subject
              </label>

              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Choose a subject</option>

                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {success && (
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || classes.length === 0 || subjects.length === 0}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Assigning..." : "Assign subject"}
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div>
            <h3 className="font-semibold text-gray-900">
              Class subject directory
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Subjects assigned to each class.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading assignments...</p>
        ) : classes.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">
            No classes available. Create classes first.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {groupedAssignments.map((schoolClass) => (
              <div key={schoolClass.id} className="p-5">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">
                    {schoolClass.display_name}
                  </h4>

                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    {schoolClass.subjects.length} subjects
                  </span>
                </div>

                {schoolClass.subjects.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-400">
                    No subjects assigned yet.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {schoolClass.subjects.map((assignment) => (
                      <span
                        key={assignment.id}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                      >
                        {assignment.subjects?.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
