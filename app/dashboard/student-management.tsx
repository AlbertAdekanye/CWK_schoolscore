"use client";

import { useEffect, useState } from "react";

type SchoolClass = {
  id: string;
  level: string;
  section: string;
  display_name: string;
};

type Student = {
  id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  enrollment: {
    class_id: string;
    academic_year: string;
    classes: SchoolClass;
  } | null;
};

export default function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [academicYear, setAcademicYear] = useState("2026/2027");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [gender, setGender] = useState("Male");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [classId, setClassId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchData() {
    setLoading(true);
    setError("");

    try {
      const [studentResponse, classResponse] = await Promise.all([
        fetch("/api/admin/students"),
        fetch("/api/admin/classes"),
      ]);

      const studentData = await studentResponse.json();
      const classData = await classResponse.json();

      if (!studentResponse.ok) {
        throw new Error(studentData.error || "Unable to load students");
      }

      if (!classResponse.ok) {
        throw new Error(classData.error || "Unable to load classes");
      }

      setStudents(studentData.students || []);
      setClasses(classData.classes || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
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
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          middle_name: middleName || null,
          gender,
          date_of_birth: dateOfBirth || null,
          class_id: classId,
          academic_year: academicYear,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to register student");
      }

      setSuccess(
        `Student registered successfully. Admission number: ${data.student.admission_number}`
      );

      setFirstName("");
      setLastName("");
      setMiddleName("");
      setGender("Male");
      setDateOfBirth("");
      setClassId("");

      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(student: Student) {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${student.first_name} ${student.last_name} (${student.admission_number})? This action cannot be undone.`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/students", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: student.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to delete student");
      }

      setSuccess("Student deleted successfully.");

      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete student");
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Student Management</h2>
        <p className="mt-1 text-sm text-gray-500">
          Register students and manage their class placements.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Total students</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {students.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Classes available</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {classes.length}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Academic session</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {academicYear}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Register a student
        </h3>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                First name
              </label>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Last name
              </label>
              <input
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Middle name
              </label>
              <input
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Middle name (optional)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Date of birth
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Academic session
              </label>
              <input
                required
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026/2027"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Assign class
              </label>
              <select
                required
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="">Select a class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.display_name}
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
            disabled={saving || classes.length === 0}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Registering..." : "Register student"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <div>
            <h3 className="font-semibold text-gray-900">Student directory</h3>
            <p className="mt-1 text-sm text-gray-500">
              All registered students in your school.
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
          <p className="p-6 text-sm text-gray-500">Loading students...</p>
        ) : students.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium text-gray-700">
              No students registered yet.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Use the form above to register your first student.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Admission number</th>
                  <th className="px-5 py-3">Student name</th>
                  <th className="px-5 py-3">Gender</th>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Academic session</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-blue-700">
                      {student.admission_number}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-900">
                      {student.last_name}, {student.first_name}{" "}
                      {student.middle_name || ""}
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {student.gender || "Not specified"}
                    </td>

                    <td className="px-5 py-4 text-gray-600">
                      {student.enrollment?.classes?.display_name ||
                        "Not assigned"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-gray-600">
                      {student.enrollment?.academic_year || "N/A"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(student)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
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