import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { consumeRateLimit, writeAuditLog } from "@/lib/api-security";
import { createSupabaseServerClient } from "@/lib/supabase";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isPastIsoDate } from "@/lib/validation";

type TextRecord = Record<string, string>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTextRecord(value: unknown, requiredFields: string[]): value is TextRecord {
  return isRecord(value) &&
    Object.values(value).every((item) => typeof item === "string" && item.length <= 500) &&
    requiredFields.every((field) => typeof value[field] === "string" && value[field].trim().length > 0);
}

function sameApplication(
  existing: { programme_id: string; personal_details: Record<string, unknown>; contact_details: Record<string, unknown> },
  programmeId: string,
  personalDetails: TextRecord,
  contactDetails: TextRecord,
) {
  return existing.programme_id === programmeId &&
    ["firstName", "lastName", "dateOfBirth", "gender"].every((key) => existing.personal_details?.[key] === personalDetails[key]) &&
    ["email", "phone", "address"].every((key) => (existing.contact_details?.[key] ?? "") === (contactDetails[key] ?? ""));
}

function responseForSubmission(applicationReference: string, whatsappPhone: string, name: string, programmeName: string) {
  const whatsappDigits = whatsappPhone.replace(/\D/g, "");
  const message = [
    "Hello Tamark Solar Energy, I have submitted a training application.",
    `Name: ${name}`,
    `Programme: ${programmeName}`,
    `Application reference: ${applicationReference}`,
  ].join("\n");
  return NextResponse.json({
    applicationReference,
    whatsappUrl: `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(message)}`,
  });
}

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return NextResponse.json({ error: "Application details are too large." }, { status: 413 });
  }

  const clientIp = request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  let allowed: boolean;
  try {
    allowed = await consumeRateLimit(`guest-application:${clientIp}`, 5, 3600);
  } catch (error) {
    console.error("Could not apply the guest application rate limit:", error);
    return NextResponse.json({ error: "Application services are temporarily unavailable." }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Too many application attempts. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (
    !isRecord(body) ||
    typeof body.idempotencyKey !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.idempotencyKey) ||
    typeof body.programmeId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.programmeId)
  ) {
    return NextResponse.json({ error: "Required application details are missing or invalid." }, { status: 400 });
  }
  const personalDetails = body.personalDetails;
  const contactDetails = body.contactDetails;
  if (
    !isTextRecord(personalDetails, ["firstName", "lastName", "dateOfBirth", "gender"]) ||
    !isTextRecord(contactDetails, ["email", "phone"])
  ) {
    return NextResponse.json({ error: "Required application details are missing or invalid." }, { status: 400 });
  }

  const normalizedPersonalDetails = {
    firstName: personalDetails.firstName.trim(),
    lastName: personalDetails.lastName.trim(),
    dateOfBirth: personalDetails.dateOfBirth,
    gender: personalDetails.gender,
  };
  const normalizedContactDetails = {
    email: contactDetails.email.trim(),
    phone: contactDetails.phone,
    address: (contactDetails.address ?? "").trim(),
  };
  const namePattern = /^[\p{L}\p{M}][\p{L}\p{M}'’ -]{0,79}$/u;
  if (!namePattern.test(normalizedPersonalDetails.firstName) || !namePattern.test(normalizedPersonalDetails.lastName)) {
    return NextResponse.json({ error: "Enter valid first and last names." }, { status: 400 });
  }
  if (!["Female", "Male", "Prefer not to say"].includes(normalizedPersonalDetails.gender)) {
    return NextResponse.json({ error: "Select a valid gender option." }, { status: 400 });
  }
  if (!isPastIsoDate(normalizedPersonalDetails.dateOfBirth)) {
    return NextResponse.json({ error: "Enter a valid date of birth in the past." }, { status: 400 });
  }
  if (!/^\S+@\S+\.\S+$/.test(normalizedContactDetails.email) || normalizedContactDetails.email.length > 254) {
    return NextResponse.json({ error: "Enter a valid contact email." }, { status: 400 });
  }
  if (!/^\d{7,15}$/.test(normalizedContactDetails.phone)) {
    return NextResponse.json({ error: "Enter a phone number containing 7–15 digits only." }, { status: 400 });
  }
  if (normalizedContactDetails.address.length > 300) {
    return NextResponse.json({ error: "Address must be 300 characters or fewer." }, { status: 400 });
  }

  let emailAllowed: boolean;
  try {
    emailAllowed = await consumeRateLimit(`guest-application-email:${normalizedContactDetails.email.toLowerCase()}`, 5, 3600);
  } catch (error) {
    console.error("Could not apply the guest application email rate limit:", error);
    return NextResponse.json({ error: "Application services are temporarily unavailable." }, { status: 503 });
  }
  if (!emailAllowed) {
    return NextResponse.json({ error: "Too many applications were submitted with this email. Try again later." }, { status: 429 });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ error: "Application services are not configured." }, { status: 503 });

  const { data: organization, error: settingsError } = await db
    .from("organization_settings")
    .select("whatsapp_phone")
    .eq("id", true)
    .maybeSingle();
  if (settingsError) {
    console.error("Could not load the saved WhatsApp application destination:", settingsError.message);
    return NextResponse.json({ error: "Could not load Tamark's WhatsApp contact. Please contact the administrator." }, { status: 503 });
  }
  const whatsappPhone = typeof organization?.whatsapp_phone === "string" ? organization.whatsapp_phone.trim() : "";
  if (!/^[1-9]\d{7,14}$/.test(whatsappPhone.replace(/\D/g, ""))) {
    return NextResponse.json({ error: "Tamark's WhatsApp contact is not configured. Please contact the administrator." }, { status: 503 });
  }

  const { data: programme, error: programmeError } = await db
    .from("programmes")
    .select("name")
    .eq("id", body.programmeId)
    .eq("is_published", true)
    .maybeSingle();
  if (programmeError) {
    console.error("Could not verify the selected public training programme:", programmeError.message);
    return NextResponse.json({ error: "Could not verify the selected programme." }, { status: 503 });
  }
  if (!programme) return NextResponse.json({ error: "This programme is not currently open for applications." }, { status: 400 });

  const { data: existing, error: existingError } = await db
    .from("applications")
    .select("id,application_reference,programme_id,personal_details,contact_details")
    .eq("public_submission_key", body.idempotencyKey)
    .maybeSingle();
  if (existingError) {
    console.error("Could not check the guest application retry key:", existingError.message);
    if (existingError.code === "42703" && existingError.message.includes("public_submission_key")) {
      return NextResponse.json({
        error: "Account-free applications are not enabled in the database yet. Apply supabase/security_financial_09_guest_applications.sql, then retry your application.",
      }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not verify this application submission." }, { status: 503 });
  }
  if (existing) {
    if (!existing.application_reference || !sameApplication(existing, body.programmeId, normalizedPersonalDetails, normalizedContactDetails)) {
      return NextResponse.json({ error: "This submission key was already used for different application details." }, { status: 409 });
    }
    return responseForSubmission(existing.application_reference, whatsappPhone, `${normalizedPersonalDetails.firstName} ${normalizedPersonalDetails.lastName}`, programme.name);
  }

  let studentId: string | null = null;
  const sessionClient = await createSupabaseServerClient();
  if (sessionClient) {
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError && authError.name !== "AuthSessionMissingError") {
      console.error("Could not verify an optional applicant session; continuing as a guest:", authError.message);
    } else if (user) {
      const { data: profile, error: profileError } = await db
        .from("profiles")
        .select("role,suspended_at")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) {
        console.error("Could not load an optional applicant profile; continuing as a guest:", profileError.message);
      } else if (profile?.role === "student" && !profile.suspended_at) {
        studentId = user.id;
      }
    }
  }

  const applicationReference = `TAM-${randomUUID().replaceAll("-", "").toUpperCase()}`;
  const { data: application, error: insertError } = await db
    .from("applications")
    .insert({
      student_id: studentId,
      programme_id: body.programmeId,
      status: "submitted",
      application_reference: applicationReference,
      public_submission_key: body.idempotencyKey,
      personal_details: normalizedPersonalDetails,
      contact_details: normalizedContactDetails,
      submitted_at: new Date().toISOString(),
    })
    .select("id,application_reference")
    .single();

  if (insertError?.code === "23505") {
    const { data: retried, error: retryError } = await db
      .from("applications")
      .select("application_reference,programme_id,personal_details,contact_details")
      .eq("public_submission_key", body.idempotencyKey)
      .maybeSingle();
    if (retryError) {
      console.error("Could not load the concurrent guest application retry:", retryError.message);
      return NextResponse.json({ error: "Could not verify this application submission." }, { status: 503 });
    }
    if (retried?.application_reference && sameApplication(retried, body.programmeId, normalizedPersonalDetails, normalizedContactDetails)) {
      return responseForSubmission(retried.application_reference, whatsappPhone, `${normalizedPersonalDetails.firstName} ${normalizedPersonalDetails.lastName}`, programme.name);
    }
  }
  if (insertError || !application?.application_reference) {
    console.error("Could not save guest application:", insertError?.message ?? "No application was returned.");
    return NextResponse.json({ error: "Could not save your application. Please try again." }, { status: 500 });
  }

  try {
    await writeAuditLog({
      actorId: studentId,
      eventType: "application.guest_submitted",
      relatedRecordId: application.id,
      metadata: { application_reference: application.application_reference },
    });
  } catch (error) {
    console.error("Guest application was saved, but its audit event could not be recorded:", error);
  }

  return responseForSubmission(application.application_reference, whatsappPhone, `${normalizedPersonalDetails.firstName} ${normalizedPersonalDetails.lastName}`, programme.name);
}
