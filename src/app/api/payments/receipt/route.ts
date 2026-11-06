import { NextResponse, type NextRequest } from "next/server";
import path from "node:path";
import PDFDocument from "pdfkit";
import { getStudentRequestContext } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const context = await getStudentRequestContext();
  if (!context.ok) return NextResponse.json({ error: context.error }, { status: context.status });
  const { supabase, user } = context;
  const requestedReference = request.nextUrl.searchParams.get("reference");
  if (!requestedReference) return NextResponse.json({ error: "Payment reference is required." }, { status: 400 });

  const { data: payment, error } = await supabase.from("payments")
    .select("provider_reference,amount_minor,currency,status,verified_at,created_at,applications(application_reference,personal_details,programmes(name))")
    .eq("provider_reference", requestedReference)
    .eq("student_id", user.id)
    .eq("status", "successful")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load the verified payment." }, { status: 500 });
  if (!payment) return NextResponse.json({ error: "A verified receipt is not available for this payment." }, { status: 404 });

  const application = payment.applications as {
    application_reference?: string | null;
    personal_details?: { firstName?: string; lastName?: string } | null;
    programmes?: { name?: string } | null;
  } | null;
  const programmeName = application?.programmes?.name ?? "Training programme";
  const applicationReference = application?.application_reference ?? "Pending submission";
  const studentReference = `STU-${user.id.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
  const digits = new Intl.NumberFormat("en", { style: "currency", currency: payment.currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const amount = new Intl.NumberFormat("en", { style: "currency", currency: payment.currency }).format(payment.amount_minor / (10 ** digits));
  const studentName = [application?.personal_details?.firstName, application?.personal_details?.lastName]
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    .join(" ") || user.email || "Student";
  const verifiedAt = payment.verified_at ? new Date(payment.verified_at) : new Date();
  const issuedAt = new Date(payment.created_at);
  const safeReference = payment.provider_reference.replace(/[^a-zA-Z0-9_-]/g, "");
  const receiptNumber = `RCP-${safeReference || "PAYMENT"}`;

  const pdf = new PDFDocument({ size: "A4", margin: 0, info: { Title: "Tamark Solar Energy payment receipt", Author: "Tamark Solar Energy" } });
  const chunks: Buffer[] = [];
  const pdfBuffer = new Promise<Buffer>((resolve, reject) => {
    pdf.on("data", (chunk: Buffer | Uint8Array) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });

  const pageWidth = 595.28;
  const left = 54;
  const right = pageWidth - left;
  pdf.rect(0, 0, pageWidth, 238).fill("#102A2A");
  pdf.image(path.join(process.cwd(), "public", "solar-leaf-energy-emblem.png"), left, 36, { fit: [32, 32] });
  pdf.font("Helvetica-Bold").fontSize(18).fillColor("#FFFFFF").text("TAMARK", left + 42, 43);
  pdf.font("Helvetica").fontSize(8).fillColor("#D7E8DE").text("SOLAR ENERGY", left + 43, 65, { characterSpacing: 1.5 });
  pdf.font("Helvetica-Bold").fontSize(25).fillColor("#FFFFFF").text("Payment receipt", left, 112);
  pdf.font("Helvetica").fontSize(10).fillColor("#D7E8DE").text("Your payment has been verified successfully.", left, 151);
  pdf.roundedRect(left, 190, right - left, 94, 12).fill("#FFFFFF");
  pdf.font("Helvetica").fontSize(9).fillColor("#78847F").text("AMOUNT PAID", left + 20, 209);
  pdf.font("Helvetica-Bold").fontSize(25).fillColor("#102A2A").text(amount, left + 20, 228);
  pdf.roundedRect(right - 102, 210, 82, 25, 12).fill("#E8F5EC");
  pdf.font("Helvetica-Bold").fontSize(8).fillColor("#117B4D").text("VERIFIED", right - 102, 219, { width: 82, align: "center" });

  let y = 328;
  pdf.font("Helvetica-Bold").fontSize(12).fillColor("#172522").text("Payment details", left, y);
  y += 24;
  const rows: Array<[string, string]> = [
    ["Receipt number", receiptNumber],
    ["Paid by", studentName],
    ["Student reference", studentReference],
    ["Email", user.email ?? "—"],
    ["Programme", programmeName],
    ["Application reference", applicationReference],
    ["Payment reference", payment.provider_reference],
    ["Payment initiated", Number.isFinite(issuedAt.getTime()) ? issuedAt.toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "—"],
    ["Verified date", Number.isFinite(verifiedAt.getTime()) ? verifiedAt.toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Verified"],
  ];
  for (const [label, value] of rows) {
    pdf.moveTo(left, y + 29).lineTo(right, y + 29).lineWidth(0.6).strokeColor("#E4EBE6").stroke();
    pdf.font("Helvetica").fontSize(9).fillColor("#78847F").text(label, left, y + 9, { width: 150 });
    pdf.font("Helvetica-Bold").fontSize(9).fillColor("#172522").text(value, left + 155, y + 9, { width: right - left - 155, align: "right" });
    y += 42;
  }
  pdf.roundedRect(left, y + 12, right - left, 61, 10).fill("#F3F8F4");
  pdf.font("Helvetica-Bold").fontSize(9).fillColor("#172522").text("Thank you for choosing Tamark Solar Energy.", left + 16, y + 26);
  pdf.font("Helvetica").fontSize(8).fillColor("#78847F").text("This receipt confirms a payment verified by our payment provider.", left + 16, y + 43);
  pdf.font("Helvetica").fontSize(8).fillColor("#78847F").text("Keep this receipt for your records.", left, 780, { width: right - left, align: "center" });
  pdf.end();

  const bytes = await pdfBuffer;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tamark-receipt-${safeReference || "verified-payment"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
