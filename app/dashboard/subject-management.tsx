"use client";

import { useEffect, useState } from "react";

type Subject = {
  id: string;
  name: string;
  created_at: string;
};

export default function SubjectManagement() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchSubjects() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/subjects");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to fetch subjects");
      }

      setSubjects(data.subjects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSubjects();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create subject");
      }

      setSuccess(`${data.subject.name} added successfully.`);
      setName("");

      await fetchSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Subject Management</h2>
        <p className="mt-1 text-sm text-gray-500">
          Create and manage the subjects offered by your school.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total subjects</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {subjects.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Status</p>
          <p className="mt-2 text-lg font-semibold text-green-600">
            Subject management active
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Add a subject</h3>

        <form onSubmit={handleSubmit} className="mt-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter subject name e.g. Mathematics"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add subject"}
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {success}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div>
            <h3 className="font-semibold text-gray-900">Subject directory</h3>
            <p className="mt-1 text-sm text-gray-500">
              All subjects registered in your school.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchSubjects}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading subjects...</p>
        ) : subjects.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-gray-700">No subjects added yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              Add your first subject using the form above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {subjects.map((subject, index) => (
              <div
                key={subject.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
                  {index + 1}
                </div>

                <div>
                  <p className="font-medium text-gray-900">{subject.name}</p>
                  <p className="text-xs text-gray-500">
                    Added {new Date(subject.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
