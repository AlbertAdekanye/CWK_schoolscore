"use client";

import { useCallback, useEffect, useState } from "react";

type AcademicTerm = {
  id: string;
  session_name: string;
  term_number: number;
  starts_on: string | null;
  ends_on: string | null;
  is_current: boolean;
};

export default function AcademicManagement() {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [sessionName, setSessionName] = useState("2026/2027");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchTerms = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/admin/academic-terms");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load academic sessions");
      }

      setTerms(data.terms || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  async function createSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setCreating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/academic-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_name: sessionName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to create session");
      }

      setMessage(data.message);
      await fetchTerms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function setCurrentTerm(termId: string) {
    setUpdatingId(termId);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/academic-terms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term_id: termId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to update current term");
      }

      setMessage(data.message);
      await fetchTerms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUpdatingId(null);
    }
  }

  const sessions = Array.from(new Set(terms.map((term) => term.session_name)));

  const currentTerm = terms.find((term) => term.is_current);

  return (
    <section className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Academic Sessions</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage school sessions and academic terms.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchTerms}
          disabled={loading}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-blue-50 p-5">
          <p className="text-sm font-medium text-blue-700">Academic sessions</p>
          <p className="mt-2 text-3xl font-bold text-blue-950">
            {sessions.length}
          </p>
        </div>

        <div className="rounded-xl bg-emerald-50 p-5">
          <p className="text-sm font-medium text-emerald-700">Current term</p>
          <p className="mt-2 text-xl font-bold text-emerald-950">
            {currentTerm
              ? `${currentTerm.session_name} · Term ${currentTerm.term_number}`
              : "Not configured"}
          </p>
        </div>
      </div>

      <form
        onSubmit={createSession}
        className="space-y-4 rounded-xl border border-gray-200 p-5"
      >
        <div>
          <h3 className="font-semibold text-gray-900">
            Create academic session
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Three terms will be created automatically.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="2026/2027"
            pattern="\d{4}/\d{4}"
            required
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create session"}
          </button>
        </div>
      </form>

      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900">Session directory</h3>
          <p className="mt-1 text-sm text-gray-500">
            Set which term the school is currently using.
          </p>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-gray-500">
            Loading academic sessions...
          </p>
        ) : terms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 py-10 text-center">
            <p className="font-medium text-gray-700">
              No academic sessions yet
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Create your first session above.
            </p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session}
              className="overflow-hidden rounded-xl border border-gray-200"
            >
              <div className="border-b border-gray-200 bg-gray-50 px-5 py-3">
                <h4 className="font-semibold text-gray-900">{session}</h4>
              </div>

              <div className="divide-y divide-gray-100">
                {terms
                  .filter((term) => term.session_name === session)
                  .map((term) => (
                    <div
                      key={term.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-gray-800">
                          Term {term.term_number}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {term.starts_on || "Start date not set"}
                          {" · "}
                          {term.ends_on || "End date not set"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {term.is_current ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Current term
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCurrentTerm(term.id)}
                            disabled={updatingId !== null}
                            className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                          >
                            {updatingId === term.id
                              ? "Updating..."
                              : "Set as current"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
