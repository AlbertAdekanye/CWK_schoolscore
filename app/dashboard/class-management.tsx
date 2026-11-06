"use client";

import { useCallback, useEffect, useState } from "react";

type SchoolClass = {
  id: string;
  level: string;
  section: string;
  display_name: string;
  workspace_id: string;
  created_at: string;
};

const LEVELS = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

export default function ClassManagement() {
  const [level, setLevel] = useState("JSS1");
  const [section, setSection] = useState("A");

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");

  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true);
    setListError("");

    try {
      const response = await fetch("/api/admin/classes", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load classes.");
      }

      setClasses(result.classes ?? []);
    } catch (err) {
      setListError(
        err instanceof Error ? err.message : "Unable to load classes.",
      );
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  async function createClass(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/classes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ level, section }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to create class.");
      }

      setMessage(result.message);
      await fetchClasses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const groupedClasses = LEVELS.map((classLevel) => ({
    level: classLevel,
    classes: classes.filter((item) => item.level === classLevel),
  })).filter((group) => group.classes.length > 0);

  return (
    <section className="mt-12">
      <div className="mb-7">
        <span className="text-xs font-bold uppercase tracking-widest text-blue-600">
          Academic structure
        </span>

        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
          Class Management
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Create and manage your school's JSS and SSS classes. Students and
          teachers can be assigned after the classes are created.
        </p>
      </div>

      {/* Create class */}
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
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>

          <h3 className="text-lg font-bold text-slate-900">
            Create a new class
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Select a class level and section to create a new class in your
            school.
          </p>

          <div className="mt-6 rounded-xl bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-900">
              Class structure
            </p>

            <p className="mt-2 text-xs leading-5 text-blue-800">
              Supported levels are JSS1 to JSS3 and SSS1 to SSS3. Each level
              currently supports sections A and B.
            </p>
          </div>
        </div>

        <form onSubmit={createClass} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="class-level"
              className="block text-sm font-semibold text-slate-700"
            >
              Class level
            </label>

            <select
              id="class-level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              {LEVELS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="class-section"
              className="block text-sm font-semibold text-slate-700"
            >
              Class section
            </label>

            <select
              id="class-section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium text-slate-500">Class preview</p>

            <p className="mt-1 text-xl font-extrabold text-slate-900">
              {level} {section}
            </p>
          </div>

          {message && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
              {message}
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
            {loading ? "Creating class..." : "Create class"}
            {!loading && <span>→</span>}
          </button>
        </form>
      </div>

      {/* Class directory */}
      <div className="mt-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">School Classes</h3>

            <p className="mt-1 text-sm text-slate-500">
              All classes currently registered in your school.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchClasses}
            disabled={loadingClasses}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingClasses ? "Loading..." : "↻ Refresh"}
          </button>
        </div>

        <div className="mt-5">
          {loadingClasses ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
              <p className="text-sm text-slate-500">Loading classes...</p>
            </div>
          ) : listError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
              <p className="text-sm text-red-600">{listError}</p>

              <button
                type="button"
                onClick={fetchClasses}
                className="mt-4 text-sm font-semibold text-blue-600"
              >
                Try again
              </button>
            </div>
          ) : classes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
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
                    d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"
                  />
                </svg>
              </div>

              <h4 className="mt-4 font-semibold text-slate-900">
                No classes created yet
              </h4>

              <p className="mt-2 text-sm text-slate-500">
                Use the form above to create your first class.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm text-slate-500">Total classes</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">
                    {classes.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm text-slate-500">Junior classes</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">
                    {
                      classes.filter((item) => item.level.startsWith("JSS"))
                        .length
                    }
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm text-slate-500">Senior classes</p>
                  <p className="mt-2 text-3xl font-extrabold text-slate-900">
                    {
                      classes.filter((item) => item.level.startsWith("SSS"))
                        .length
                    }
                  </p>
                </div>
              </div>

              {groupedClasses.map((group) => (
                <div
                  key={group.level}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                    <h4 className="font-bold text-slate-900">{group.level}</h4>
                  </div>

                  <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    {group.classes.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-200 p-5 transition hover:border-blue-200 hover:shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 font-bold text-blue-600">
                            {item.section}
                          </span>

                          <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                            Created
                          </span>
                        </div>

                        <h5 className="mt-4 text-lg font-bold text-slate-900">
                          {item.display_name}
                        </h5>

                        <p className="mt-1 text-xs text-slate-500">
                          Section {item.section}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
