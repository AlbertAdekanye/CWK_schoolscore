import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function getAdminContext() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, school_id")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.role !== "admin") {
    return { error: "Admin access required", status: 403 };
  }

  return { profile };
}

// GET: Fetch all school subjects
export async function GET() {
  try {
    const context = await getAdminContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const adminClient = createSupabaseAdminClient();

    const { data: subjects, error } = await adminClient
      .from("subjects")
      .select("id, name, created_at")
      .eq("school_id", context.profile.school_id)
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ subjects: subjects || [] });
  } catch (error) {
    console.error("Fetch subjects error:", error);

    return NextResponse.json(
      { error: "Unable to fetch subjects" },
      { status: 500 },
    );
  }
}

// POST: Create a subject
export async function POST(request: Request) {
  try {
    const context = await getAdminContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Subject name is required" },
        { status: 400 },
      );
    }

    const adminClient = createSupabaseAdminClient();

    const { data: subject, error } = await adminClient
      .from("subjects")
      .insert({
        school_id: context.profile.school_id,
        name,
      })
      .select("id, name, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "This subject already exists" },
          { status: 409 },
        );
      }

      throw error;
    }

    return NextResponse.json(
      {
        message: "Subject created successfully",
        subject,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create subject error:", error);

    return NextResponse.json(
      { error: "Unable to create subject" },
      { status: 500 },
    );
  }
}
