"use client";

import { useCallback, useEffect, useState } from "react";

type Teacher = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: "Invitation pending" | "Email confirmed" | "Active";
};

export default function TeacherManagement() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");

  const fetchTeachers = useCallback(async () => {
    setLoadingTeachers(true);
    setListError("");

    try {
      const response = await fetch("/api/admin/teachers", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load teachers.");
      }

      setTeachers(result.teachers ?? []);
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : "Unable to load teachers.",
      );
    } finally {
      setLoadingTeachers(false);
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  async function inviteTeacher(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName, email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to invite teacher.");
      }

      setMessage(result.message);
      setFullName("");
      setEmail("");

      await fetchTeachers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-12">
      <div className="mb-7">
        <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
          School administration
        </span>

        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
          Teacher Management
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Invite teachers to your school and manage their access. You can assign
          classes and subjects after registration.
        </p>
      </div>

      {/* Invitation form */}
      <div className="grid gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[1fr_1.5fr] md:p-8">
        <div>
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-3v6m3-3h-6"
              />
            </svg>
          </div>

          <h3 className="text-lg font-bold text-slate-900">Invite a teacher</h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Send an email invitation to a teacher. Once they accept, their
            account will be added to your school.
          </p>

          <div className="mt-6 rounded-xl bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              What happens next?
            </p>

            <p className="mt-2 text-xs leading-5 text-blue-800">
              The teacher receives an invitation link by email and can use it to
              access SchoolScore.
            </p>
          </div>
        </div>

        <form onSubmit={inviteTeacher} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="teacher-name"
              className="block text-sm font-semibold text-slate-700"
            >
              Full name
            </label>

            <input
              id="teacher-name"
              type="text"
              placeholder="Enter teacher's full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="teacher-email"
              className="block text-sm font-semibold text-slate-700"
            >
              Email address
            </label>

            <input
              id="teacher-email"
              type="email"
              placeholder="teacher@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {message && (
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              <span className="font-bold">✓</span>
              <p>{message}</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? "Sending invitation..." : "Send invitation"}
            {!loading && <span>→</span>}
          </button>
        </form>
      </div>

      {/* Teacher directory */}
      <div className="mt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Registered Teachers
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Manage teachers registered under your school.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchTeachers}
            disabled={loadingTeachers}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <span>{loadingTeachers ? "Loading..." : "↻ Refresh"}</span>
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loadingTeachers ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm text-slate-500">Loading teachers...</p>
            </div>
          ) : listError ? (
            <div className="px-6 py-14 text-center">
              <p className="text-sm text-red-600">{listError}</p>

              <button
                type="button"
                onClick={fetchTeachers}
                className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Try again
              </button>
            </div>
          ) : teachers.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-7 w-7"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-3v6m3-3h-6"
                  />
                </svg>
              </div>

              <h4 className="mt-4 font-semibold text-slate-900">
                No teachers yet
              </h4>

              <p className="mt-2 text-sm text-slate-500">
                Teachers you invite will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 px-6 py-4">
                <p className="text-sm font-medium text-slate-600">
                  {teachers.length}{" "}
                  {teachers.length === 1 ? "teacher" : "teachers"} found
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {teachers.map((teacher) => (
                  <div
                    key={teacher.id}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 font-bold text-blue-600">
                        {teacher.full_name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>

                      <div>
                        <h4 className="font-semibold text-slate-900">
                          {teacher.full_name}
                        </h4>

                        <p className="mt-1 text-sm text-slate-500">
                          {teacher.email || "No email available"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${
                        teacher.status === "Active"
                          ? "bg-green-50 text-green-700"
                          : teacher.status === "Email confirmed"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {teacher.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
