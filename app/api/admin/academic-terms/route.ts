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

    const { data: terms, error } = await adminClient
      .from("academic_terms")
      .select(
        "id, school_id, session_name, term_number, starts_on, ends_on, is_current, created_at",
      )
      .eq("school_id", context.profile.school_id)
      .order("session_name", { ascending: false })
      .order("term_number", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ terms: terms || [] });
  } catch (error) {
    console.error("Fetch academic terms error:", error);

    return NextResponse.json(
      { error: "Unable to fetch academic sessions" },
      { status: 500 },
    );
  }
}

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
    const sessionName = String(body.session_name || "").trim();

    if (!/^\d{4}\/\d{4}$/.test(sessionName)) {
      return NextResponse.json(
        { error: "Enter a valid session, e.g. 2026/2027" },
        { status: 400 },
      );
    }

    const adminClient = createSupabaseAdminClient();

    const { data: existing } = await adminClient
      .from("academic_terms")
      .select("id")
      .eq("school_id", context.profile.school_id)
      .eq("session_name", sessionName)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "This academic session already exists" },
        { status: 409 },
      );
    }

    const { data: currentTerm } = await adminClient
      .from("academic_terms")
      .select("id")
      .eq("school_id", context.profile.school_id)
      .eq("is_current", true)
      .maybeSingle();

    const terms = [1, 2, 3].map((termNumber) => ({
      school_id: context.profile.school_id,
      session_name: sessionName,
      term_number: termNumber,
      is_current: !currentTerm && termNumber === 1,
    }));

    const { data: createdTerms, error } = await adminClient
      .from("academic_terms")
      .insert(terms)
      .select(
        "id, school_id, session_name, term_number, starts_on, ends_on, is_current, created_at",
      );

    if (error) throw error;

    return NextResponse.json(
      {
        message: "Academic session created successfully",
        terms: createdTerms,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create academic session error:", error);

    return NextResponse.json(
      { error: "Unable to create academic session" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getAdminContext();

    if ("error" in context) {
      return NextResponse.json(
        { error: context.error },
        { status: context.status },
      );
    }

    const body = await request.json();
    const termId = String(body.term_id || "");

    if (!termId) {
      return NextResponse.json(
        { error: "Select an academic term" },
        { status: 400 },
      );
    }

    const adminClient = createSupabaseAdminClient();

    const { data: term, error: termError } = await adminClient
      .from("academic_terms")
      .select("id, session_name, term_number")
      .eq("id", termId)
      .eq("school_id", context.profile.school_id)
      .maybeSingle();

    if (termError || !term) {
      return NextResponse.json(
        { error: "Academic term not found" },
        { status: 404 },
      );
    }

    const { error: clearError } = await adminClient
      .from("academic_terms")
      .update({ is_current: false })
      .eq("school_id", context.profile.school_id)
      .eq("is_current", true);

    if (clearError) throw clearError;

    const { error: activateError } = await adminClient
      .from("academic_terms")
      .update({ is_current: true })
      .eq("id", termId)
      .eq("school_id", context.profile.school_id);

    if (activateError) throw activateError;

    return NextResponse.json({
      message: `${term.session_name} Term ${term.term_number} is now current`,
    });
  } catch (error) {
    console.error("Set current academic term error:", error);

    return NextResponse.json(
      { error: "Unable to update current academic term" },
      { status: 500 },
    );
  }
}
