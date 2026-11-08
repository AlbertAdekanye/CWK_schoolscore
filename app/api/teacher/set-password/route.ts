import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // Verify the currently logged-in user.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    // Verify that the current user is a school admin.
    const { data: adminProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, school_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !adminProfile || adminProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { teacherId, password } = body;

    if (
      typeof teacherId !== "string" ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return NextResponse.json(
        {
          error:
            "A valid teacher ID and password of at least 8 characters are required.",
        },
        { status: 400 },
      );
    }

    // Ensure the administrator has a school assigned.
    if (!adminProfile.school_id) {
      return NextResponse.json(
        { error: "Your administrator account has no school assigned." },
        { status: 400 },
      );
    }

    // Use the server-side admin client to verify the teacher.
    // This avoids RLS hiding the teacher's profile.
    const adminClient = createSupabaseAdminClient();

    const { data: teacherProfile, error: teacherError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", teacherId)
      .eq("school_id", adminProfile.school_id)
      .eq("role", "teacher")
      .maybeSingle();

    if (teacherError || !teacherProfile) {
      return NextResponse.json(
        { error: "Teacher not found in your school." },
        { status: 404 },
      );
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      teacherId,
      {
        password,
      },
    );

    if (updateError) {
      console.error("Teacher password update failed:", updateError.message);

      return NextResponse.json(
        { error: "Unable to update teacher password." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Teacher password updated successfully.",
    });
  } catch (error) {
    console.error("Set teacher password error:", error);

    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
