import { NextResponse, type NextRequest } from "next/server";
import { getStudentRequestContext } from "@/lib/api-auth";
import { isPastIsoDate } from "@/lib/validation";
import { consumeRateLimit } from "@/lib/api-security";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTextRecord(value: unknown, requiredFields: string[]): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string" && item.length <= 500) && requiredFields.every((field) =>
    typeof value[field] === "string" && value[field].trim().length > 0 && value[field].length <= 500,
  );
}

export async function POST(request: NextRequest) {
  const context = await getStudentRequestContext();
  if (!context.ok) return NextResponse.json({ error: context.error }, { status: context.status });
  const { supabase, user } = context;
  let allowed: boolean;
  try {
    allowed = await consumeRateLimit(`application-save:${user.id}`, 10, 3600);
  } catch {
    return NextResponse.json({ error: "Application services are temporarily unavailable." }, { status: 503 });
  }
  if (!allowed) return NextResponse.json({ error: "Too many application updates. Try again later." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.programmeId !== "string") {
    return NextResponse.json({ error: "Required application details are missing or invalid." }, { status: 400 });
  }
  const applicationId = body.applicationId;
  const expectedUpdatedAt = body.expectedUpdatedAt;
  const validApplicationId = typeof applicationId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(applicationId);
  if ((applicationId !== undefined && !validApplicationId) ||
      (expectedUpdatedAt !== undefined && (typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt)))) ||
      ((applicationId === undefined) !== (expectedUpdatedAt === undefined))) {
    return NextResponse.json({ error: "The saved draft version is invalid. Reload the latest draft before saving." }, { status: 400 });
  }
  const personalDetails = body.personalDetails;
  const contactDetails = body.contactDetails;
  if (!isTextRecord(personalDetails, ["firstName", "lastName", "dateOfBirth", "gender"]) ||
      !isTextRecord(contactDetails, ["email", "phone"])) {
    return NextResponse.json({ error: "Required application details are missing or invalid." }, { status: 400 });
  }
  const email = contactDetails.email.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid contact email." }, { status: 400 });
  const namePattern = /^[\p{L}\p{M}][\p{L}\p{M}'’ -]{0,79}$/u;
  if (!namePattern.test(personalDetails.firstName.trim()) || !namePattern.test(personalDetails.lastName.trim())) {
    return NextResponse.json({ error: "Enter valid first and last names." }, { status: 400 });
  }
  if (!["Female", "Male", "Prefer not to say"].includes(personalDetails.gender)) {
    return NextResponse.json({ error: "Select a valid gender option." }, { status: 400 });
  }
  const dateOfBirth = personalDetails.dateOfBirth;
  if (!isPastIsoDate(dateOfBirth)) {
    return NextResponse.json({ error: "Enter a valid date of birth in the past." }, { status: 400 });
  }
  if (!/^\d{7,15}$/.test(contactDetails.phone)) return NextResponse.json({ error: "Enter a phone number containing 7–15 digits only." }, { status: 400 });
  if (typeof contactDetails.address === "string" && contactDetails.address.length > 300) {
    return NextResponse.json({ error: "Address must be 300 characters or fewer." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("save_student_application", {
    p_programme_id: body.programmeId,
    p_personal_details: personalDetails,
    p_contact_details: contactDetails,
    p_application_id: validApplicationId ? applicationId : null,
    p_expected_updated_at: expectedUpdatedAt ?? null,
  });
  if (error) {
    if (error.code === "40001" || error.message.includes("Application draft changed")) {
      const { data: currentDraft, error: draftError } = await supabase.from("applications")
        .select("id,updated_at,personal_details,contact_details")
        .eq("student_id", user.id)
        .eq("programme_id", body.programmeId)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (draftError) {
        console.error("Could not load the current application draft after a version conflict:", draftError.message);
        return NextResponse.json({ error: "Your draft changed in another session. Reload the application before saving." }, { status: 409 });
      }
      if (currentDraft) {
        return NextResponse.json({
          error: "Your draft changed in another session. Review the latest saved version before continuing.",
          currentDraft,
        }, { status: 409 });
      }
      return NextResponse.json({
        error: "Your draft changed in another session. Review the latest saved version before continuing.",
      }, { status: 409 });
    }
    if (error.message.includes("active application already exists")) {
      return NextResponse.json({ error: "An active application already exists for this programme." }, { status: 409 });
    }
    if (error.message.includes("unavailable for application")) {
      return NextResponse.json({ error: "This programme is unavailable or its fee is not approved." }, { status: 400 });
    }
    console.error("Could not save application draft:", error.message);
    return NextResponse.json({ error: "Could not save your application. Please try again." }, { status: 500 });
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.application_id !== "string" || typeof result.updated_at !== "string") {
    return NextResponse.json({ error: "Application draft was not saved." }, { status: 500 });
  }
  return NextResponse.json({
    applicationId: result.application_id,
    updatedAt: result.updated_at,
  }, { status: validApplicationId ? 200 : 201 });
}
