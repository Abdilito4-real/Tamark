"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, BookOpen, CalendarDays, Check, Clock3, CreditCard, Download, FileText, ImagePlus, KeyRound, Mail, MapPin, Pencil, Phone, Plus, RefreshCw, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { EmptyState, Notice } from "@/components/ui";
import type { Programme } from "@/lib/programmes";
import { getProgrammeImageUrl } from "@/lib/programme-images";
import { PushNotificationControl } from "@/components/push-notification-control";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ApplicationSubmitAction } from "@/components/application-submit-action";

type JsonRecord = Record<string, unknown>;
type Props = { kind: "student" | "admin"; section: string };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function DashboardManager({ kind, section }: Props) {
  const [data, setData] = useState<JsonRecord[]>([]);
  const [single, setSingle] = useState<JsonRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<JsonRecord | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const endpoints: Record<string, string> = kind === "admin" ? {
      programmes: "/api/admin/programmes",
      applications: "/api/admin/applications",
      students: "/api/admin/students",
      payments: "/api/admin/payments",
      announcements: "/api/admin/announcements",
      schedule: "/api/admin/schedule",
      settings: "/api/admin/settings",
      dashboard: "/api/admin/dashboard",
      reports: "/api/admin/dashboard",
    } : {
      overview: "/api/student/overview",
      applications: "/api/student/applications",
      payments: "/api/student/payments",
      profile: "/api/student/profile",
      schedule: "/api/student/schedule",
      notifications: "/api/student/notifications",
      announcements: "/api/student/announcements",
    };
    const path = endpoints[section];
    if (!path) { setLoading(false); return; }
    setLoading(true); setError("");
    requestJson<{ data?: unknown; email?: string; stats?: JsonRecord; recent?: JsonRecord[]; applications?: JsonRecord[]; payments?: JsonRecord[]; unread?: number }>(path)
      .then((result) => {
        if (!active) return;
        if (section === "profile") setSingle(isRecord(result.data) ? { ...result.data, email: result.email } : null);
        else if (section === "settings") setSingle(isRecord(result.data) ? result.data : null);
        else if (section === "dashboard" || section === "reports") setData((result.recent ?? []) as JsonRecord[]);
        else if (section === "overview") {
          setData(result.applications ?? []);
          setSingle({ stats: result.stats, unread: result.unread, payments: result.payments, applications: result.applications });
        } else setData(Array.isArray(result.data) ? result.data.filter(isRecord) : []);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load dashboard data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, section, refresh]);

  async function mutate(url: string, method: "POST" | "PATCH" | "DELETE", body?: JsonRecord) {
    setSaving(true); setError(""); setMessage("");
    try {
      await requestJson(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      setMessage("Changes saved.");
      setEditing(null);
      setRefresh((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted" role="status">Loading records…</p>;
  return <div className="dashboard-manager">
    {error && <Notice title="Action could not be completed">{error}</Notice>}
    {message && <p className="success-message" role="status"><Check size={16} />{message}</p>}
    {kind === "admin" && section === "programmes" && <ProgrammeManager programmes={data as unknown as Programme[]} editing={editing} setEditing={setEditing} saving={saving} onSave={(body, id) => mutate(`/api/admin/programmes${id ? `/${id}` : ""}`, id ? "PATCH" : "POST", body)} onUnpublish={(id) => void mutate(`/api/admin/programmes/${id}`, "DELETE")} />}
    {kind === "admin" && section === "applications" && <ApplicationsManager records={data} saving={saving} onDecision={(id, status, expectedUpdatedAt) => void mutate(`/api/admin/applications/${id}`, "PATCH", { status, expectedUpdatedAt })} />}
    {kind === "admin" && section === "students" && <StudentsManager records={data} />}
    {kind === "admin" && section === "payments" && <PaymentsManager records={data} />}
    {kind === "admin" && section === "announcements" && <AnnouncementsManager records={data} saving={saving} onSave={(body) => void mutate("/api/admin/announcements", "POST", body)} onUpdate={(id, body) => void mutate(`/api/admin/announcements/${id}`, "PATCH", body)} onDelete={(id) => void mutate(`/api/admin/announcements/${id}`, "DELETE")} />}
    {kind === "admin" && section === "schedule" && <ScheduleManager records={data} saving={saving} onError={setError} onSave={(body) => void mutate("/api/admin/schedule", "POST", body)} onDelete={(id) => void mutate(`/api/admin/schedule/${id}`, "DELETE")} />}
    {kind === "admin" && section === "settings" && <SettingsManager value={single} saving={saving} onSave={(body) => void mutate("/api/admin/settings/organization", "PATCH", body)} />}
    {kind === "admin" && (section === "dashboard" || section === "reports") && <AdminSummary section={section} records={data} onRefresh={() => setRefresh((value) => value + 1)} />}
    {kind === "student" && section === "overview" && <StudentOverview value={single} />}
    {kind === "student" && section === "applications" && <StudentApplications records={data} />}
    {kind === "student" && section === "payments" && <StudentPayments records={data} />}
    {kind === "student" && section === "profile" && <ProfileManager value={single} saving={saving} onSave={(body) => void mutate("/api/student/profile", "PATCH", body)} />}
    {kind === "student" && section === "schedule" && <StudentSchedule records={data} />}
    {kind === "student" && (section === "notifications" || section === "announcements") && <StudentMessages records={data} section={section} onRead={(id, read) => void mutate(`/api/student/notifications/${id}`, "PATCH", { read })} />}
  </div>;
}

function ProgrammeManager({ programmes, editing, setEditing, saving, onSave, onUnpublish }: {
  programmes: Programme[]; editing: JsonRecord | null; setEditing: (value: JsonRecord | null) => void; saving: boolean; onSave: (body: JsonRecord, id?: string) => Promise<void>; onUnpublish: (id: string) => void;
}) {
  return <>
    <div className="manager-heading"><p>List drafts as “Coming soon”; approve fees before opening enrollment.</p><button className="button button-primary" onClick={() => setEditing({})}><Plus size={16} /> Add programme</button></div>
    {editing !== null && <ProgrammeForm value={editing} saving={saving} onCancel={() => setEditing(null)} onSave={(body) => onSave(body, typeof editing.id === "string" ? editing.id : undefined)} />}
    {programmes.length ? <div className="programme-admin-grid">{programmes.map((p) => {
      const imageUrl = getProgrammeImageUrl(p.image_path);
      return <article className="programme-admin-card" key={p.id}>
        <div className="programme-admin-image" role={imageUrl ? "img" : undefined} aria-label={imageUrl ? p.name : undefined} style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}>{!imageUrl && <ImagePlus size={24} aria-hidden="true" />}</div>
        <div className="programme-admin-body">
          <div className="programme-admin-heading"><div><span className="tag">{p.category}</span><h2>{p.name}</h2></div><span className={`status-tag ${p.is_published ? "status-published" : "status-draft"}`}>{p.is_published ? "Published" : "Draft"}</span></div>
          <p className="muted">{p.summary || "Programme description not added yet."}</p>
          <div className="programme-admin-meta"><span>{p.duration || "Duration not set"}</span><strong>{p.price_minor == null ? "Fee not set" : new Intl.NumberFormat(undefined, { style: "currency", currency: p.currency }).format(p.price_minor / 100)}</strong></div>
          <div className="programme-admin-footer"><span>{p.is_listed ? "Visible in catalogue" : "Hidden from catalogue"}</span><div className="table-actions"><button className="button button-outline button-small" onClick={() => setEditing({ ...p, curriculum: p.curriculum.join("\n"), outcomes: p.outcomes.join("\n") })}><Pencil size={14} /> Edit</button>{p.is_published && <button className="button button-outline button-small" onClick={() => onUnpublish(p.id)}>Unpublish</button>}</div></div>
        </div>
      </article>;
    })}</div> : <EmptyState title="No programme records">Use “Add programme” to create a draft course record. Confirm commercial terms before approving its price.</EmptyState>}
  </>;
}

function ProgrammeForm({ value, saving, onCancel, onSave }: { value: JsonRecord; saving: boolean; onCancel: () => void; onSave: (body: JsonRecord) => Promise<void> }) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [form, setForm] = useState({
    name: String(value.name ?? ""), slug: String(value.slug ?? ""), category: String(value.category ?? ""), summary: String(value.summary ?? ""),
    duration: String(value.duration ?? ""), price_minor: value.price_minor == null ? "" : String(Number(value.price_minor) / 100),
    currency: String(value.currency ?? "NGN"), entry_requirements: String(value.entry_requirements ?? ""),
    curriculum: Array.isArray(value.curriculum) ? value.curriculum.join("\n") : String(value.curriculum ?? ""),
    outcomes: Array.isArray(value.outcomes) ? value.outcomes.join("\n") : String(value.outcomes ?? ""),
    price_approved: value.price_approved === true, is_published: value.is_published === true,
    is_listed: value.is_listed !== false,
    image_path: typeof value.image_path === "string" ? value.image_path : "",
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!imageFile) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
  function update(key: string, val: string | boolean) { setForm((current) => ({ ...current, [key]: val })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const cents = form.price_minor === "" ? null : Math.round(Number(form.price_minor) * 100);
    setUploadError("");
    setUploading(true);
    try {
      let imagePath = form.image_path || null;
      if (imageFile) {
        const uploadData = new FormData();
        uploadData.set("image", imageFile);
        const response = await fetch("/api/admin/programme-images", { method: "POST", body: uploadData });
        const result = await response.json() as { path?: string; error?: string };
        if (!response.ok || !result.path) throw new Error(result.error || "Could not upload programme image.");
        imagePath = result.path;
      }
      await onSave({ ...form, image_path: imagePath, price_minor: cents, curriculum: form.curriculum.split("\n").map((s) => s.trim()).filter(Boolean), outcomes: form.outcomes.split("\n").map((s) => s.trim()).filter(Boolean), is_published: form.is_published && form.price_approved && cents !== null });
    } catch (reason) {
      setUploadError(reason instanceof Error ? reason.message : "Could not save programme.");
    } finally {
      setUploading(false);
    }
  }
  const currentImage = previewUrl ?? getProgrammeImageUrl(form.image_path);
  return <form className="form-card manager-form" onSubmit={submit}>
    <h2>{value.id ? "Edit programme" : "New programme draft"}</h2>
    <div className="programme-image-upload">
      <div className="programme-image-preview" role={currentImage ? "img" : undefined} aria-label={currentImage ? "Programme image preview" : undefined} style={currentImage ? { backgroundImage: `url("${currentImage}")` } : undefined}>{!currentImage && <ImagePlus size={28} aria-hidden="true" />}</div>
      <div><label className="field">Programme image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setImageFile(event.target.files?.[0] ?? null); setUploadError(""); }} /></label><small>JPG, PNG, or WebP · maximum 5 MB</small>
        {form.image_path && !imageFile && <button className="text-link remove-image-button" type="button" onClick={() => { update("image_path", ""); setImageFile(null); }}>Remove current image</button>}
      </div>
    </div>
    {uploadError && <p className="wizard-error" role="alert">{uploadError}</p>}
    <div className="form-row"><Field label="Programme name" value={form.name} onChange={(v) => update("name", v)} required /><Field label="URL slug" value={form.slug} onChange={(v) => update("slug", v.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))} required /></div>
    <div className="form-row"><Field label="Category" value={form.category} onChange={(v) => update("category", v)} required /><Field label="Duration" value={form.duration} onChange={(v) => update("duration", v)} /></div>
    <Field label="Summary" value={form.summary} onChange={(v) => update("summary", v)} area />
    <div className="form-row"><Field label="Price (major currency units)" value={form.price_minor} onChange={(v) => update("price_minor", v)} type="number" min="0" step="0.01" /><Field label="Currency code" value={form.currency} onChange={(v) => update("currency", v.toUpperCase())} /></div>
    <Field label="Entry requirements" value={form.entry_requirements} onChange={(v) => update("entry_requirements", v)} />
    <div className="form-row"><Field label="Curriculum (one item per line)" value={form.curriculum} onChange={(v) => update("curriculum", v)} area /><Field label="Learning outcomes (one per line)" value={form.outcomes} onChange={(v) => update("outcomes", v)} area /></div>
    <label className="check-field"><input type="checkbox" checked={form.price_approved} onChange={(e) => update("price_approved", e.target.checked)} /> Commercial price approved by Tamark</label>
    <label className="check-field"><input type="checkbox" checked={form.is_published} disabled={!form.price_approved || form.price_minor === ""} onChange={(e) => update("is_published", e.target.checked)} /> Publish this programme</label>
    <label className="check-field"><input type="checkbox" checked={form.is_listed} onChange={(e) => update("is_listed", e.target.checked)} /> Show in public catalogue (drafts appear as “Coming soon”)</label>
    <div className="wizard-actions"><button className="button button-outline" type="button" onClick={onCancel}>Cancel</button><button className="button button-primary" disabled={saving || uploading}>{uploading ? "Uploading image…" : saving ? "Saving…" : "Save programme"}</button></div>
  </form>;
}

function ApplicationsManager({ records, saving, onDecision }: { records: JsonRecord[]; saving: boolean; onDecision: (id: string, status: string, expectedUpdatedAt: string) => void }) {
  const [filter, setFilter] = useState("all");
  const list = records.filter((row) => filter === "all" || row.status === filter);
  return <>
    <div className="dashboard-filter-bar"><div className="filter-row">{["all", "submitted", "under_review", "approved", "rejected"].map((item) => <button key={item} className="filter-chip" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "All applications" : item.replace("_", " ")}</button>)}</div><span>{list.length} {list.length === 1 ? "record" : "records"}</span></div>
    {list.length ? <div className="application-admin-grid">{list.map((row) => {
      const profile = row.profiles as JsonRecord | null;
      const personal = row.personal_details as JsonRecord | null;
      const name = profile?.full_name || [personal?.firstName, personal?.lastName].filter(Boolean).join(" ") || "Student";
      const programme = row.programmes as JsonRecord | null;
      const contact = row.contact_details as JsonRecord | null;
      const education = row.education_details as JsonRecord | null;
      const submitted = row.submitted_at ?? row.created_at;
      return <article className="admin-application-card" key={String(row.id)}>
        <div className="admin-card-topline"><span className="admin-avatar"><UserRound size={19} /></span><span className={`status-tag student-status ${String(row.status)}`}>{String(row.status).replaceAll("_", " ")}</span></div>
        <h2>{String(name)}</h2>
        <p className="admin-app-programme"><BookOpen size={15} />{String(programme?.name ?? "Training programme")}</p>
        <div className="admin-app-contact">
          {Boolean(contact?.email || profile?.email) && <span><Mail size={14} />{String(contact?.email ?? profile?.email)}</span>}
          {Boolean(contact?.phone) && <span><Phone size={14} />{String(contact?.phone)}</span>}
        </div>
        <div className="admin-app-meta"><span><CalendarDays size={14} />{date(submitted, true)}</span><span><FileText size={14} />{String(education?.qualification ?? "Details received")}</span></div>
        {["submitted", "under_review"].includes(String(row.status)) && <div className="admin-card-actions">
          <button className="button button-outline button-small" disabled={saving || row.status === "under_review"} onClick={() => onDecision(String(row.id), "under_review", String(row.updated_at))}>{row.status === "under_review" ? "In review" : "Start review"}</button>
          <button className="button button-primary button-small" disabled={saving} onClick={() => onDecision(String(row.id), "approved", String(row.updated_at))}>Approve</button>
          <button className="button button-outline button-small danger-button" disabled={saving} onClick={() => onDecision(String(row.id), "rejected", String(row.updated_at))}>Decline</button>
        </div>}
      </article>;
    })}</div> : <EmptyState title="No matching applications">Submitted application records will appear here.</EmptyState>}
  </>;
}

function StudentsManager({ records }: { records: JsonRecord[] }) {
  return records.length ? <div className="student-admin-grid">{records.map((row) => {
    const applicationCount = (row.applications as { count?: number }[] | undefined)?.[0]?.count ?? 0;
    const name = String(row.full_name || "Name not provided");
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";
    return <article className="student-admin-card" key={String(row.id)}>
      <div className="student-admin-card-top"><span className="student-admin-avatar">{initials}</span><span className="student-admin-role">Student</span></div>
      <h2>{name}</h2>
      <p className="student-admin-contact"><Mail size={14} />{String(row.email || "Email not provided")}</p>
      <p className="student-admin-contact"><Phone size={14} />{String(row.phone || "Phone not provided")}</p>
      <div className="student-admin-card-footer"><span><BookOpen size={14} />{applicationCount} {applicationCount === 1 ? "application" : "applications"}</span><span>Joined {date(row.created_at)}</span></div>
    </article>;
  })}</div> : <EmptyState title="No student records">Student accounts will appear here after registration.</EmptyState>;
}

function PaymentsManager({ records }: { records: JsonRecord[] }) {
  return records.length ? <div className="payment-admin-grid">{records.map((row) => {
    const profile = row.profiles as JsonRecord | null;
    const app = row.applications as JsonRecord | null;
    const programme = app?.programmes as JsonRecord | null;
    return <article className="payment-admin-card" key={String(row.id)}>
      <div className="payment-admin-card-top"><span className="payment-admin-icon"><CreditCard size={18} /></span><span className={`status-tag student-status ${String(row.status)}`}>{String(row.status)}</span></div>
      <strong className="payment-admin-amount">{money(Number(row.amount_minor), String(row.currency))}</strong>
      <span className="payment-admin-programme">{String(programme?.name ?? "Training programme")}</span>
      <div className="payment-admin-details"><span><UserRound size={14} />{String(profile?.full_name ?? "Student")}</span><span><Clock3 size={14} />{date(row.verified_at ?? row.created_at, true)}</span></div>
      <div className="payment-reference"><span>Reference</span><code>{String(row.provider_reference)}</code></div>
      {row.status === "successful" && <RefundAction paymentId={String(row.id)} amountMinor={Number(row.amount_minor)} currency={String(row.currency)} />}
    </article>;
  })}</div> : <EmptyState title="No payment records">Payment transactions will appear after checkout starts.</EmptyState>;
}

function RefundAction({ paymentId, amountMinor, currency }: { paymentId: string; amountMinor: number; currency: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed) {
      setError("Confirm that you want to refund the full payment.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<{ status: string }>("/api/admin/finance/refunds", {
        method: "POST",
        body: JSON.stringify({ paymentId, reason, confirm: confirmed }),
      });
      setStatus(result.status);
      setOpen(false);
    } catch (reasonValue) {
      setError(reasonValue instanceof Error ? reasonValue.message : "Could not request the refund.");
    } finally {
      setBusy(false);
    }
  }

  if (status) return <p className="payment-verification-note" role="status">Refund status: {status}. Check provider reconciliation before taking further action.</p>;
  if (!open) return <button className="button button-outline button-small" type="button" onClick={() => setOpen(true)}>Request full refund</button>;
  return <form className="manager-form refund-request-form" onSubmit={(event) => void submit(event)}>
    <p className="muted">Full refund: {money(amountMinor, currency)}. This action contacts Paystack and cannot be undone.</p>
    <label className="field">Refund reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={1000} required /></label>
    <label className="check-field"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm this full refund.</label>
    {error && <p className="wizard-error" role="alert">{error}</p>}
    <div className="table-actions">
      <button className="button button-outline button-small" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
      <button className="button button-primary button-small" type="submit" disabled={busy || !confirmed}>{busy ? "Requesting…" : "Confirm refund"}</button>
    </div>
  </form>;
}

function AnnouncementsManager({ records, saving, onSave, onUpdate, onDelete }: { records: JsonRecord[]; saving: boolean; onSave: (body: JsonRecord) => void; onUpdate: (id: string, body: JsonRecord) => void; onDelete: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [published, setPublished] = useState(false);
  return <>
    <form className="form-card manager-form announcement-composer" onSubmit={(event) => { event.preventDefault(); onSave({ title, body, published }); setTitle(""); setBody(""); setPublished(false); }}>
      <div className="composer-heading"><span className="composer-icon"><Bell size={19} aria-hidden="true" /></span><div><h2>Share an update</h2><p>Keep students informed about approved news and important changes.</p></div></div>
      <Field label="Announcement title" value={title} onChange={setTitle} required /><Field label="Message" value={body} onChange={setBody} area required />
      <label className="check-field"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Publish to students immediately</label>
      <button className="button button-primary" disabled={saving}>{saving ? "Publishing…" : "Create announcement"}</button>
    </form>
    {records.length ? <div className="announcement-admin-grid">{records.map((row) => <article className="announcement-admin-card" key={String(row.id)}>
      <div className="announcement-admin-top"><span className="announcement-admin-icon"><Bell size={17} /></span><span className={`status-tag ${row.published ? "status-published" : "status-draft"}`}>{row.published ? "Published" : "Draft"}</span></div>
      <h3>{String(row.title)}</h3><p>{String(row.body)}</p>
      <div className="announcement-admin-footer"><span>{date(row.published_at ?? row.created_at, true)}</span><div className="table-actions"><button className="button button-outline button-small" disabled={saving} onClick={() => onUpdate(String(row.id), { published: !row.published })}>{row.published ? "Unpublish" : "Publish"}</button><button className="button button-outline button-small danger-button" disabled={saving} onClick={() => onDelete(String(row.id))}><Trash2 size={14} /> Delete</button></div></div>
    </article>)}</div> : <EmptyState title="No announcements">Write an announcement to share approved updates with students.</EmptyState>}
  </>;
}

function ScheduleManager({ records, saving, onError, onSave, onDelete }: { records: JsonRecord[]; saving: boolean; onError: (message: string) => void; onSave: (body: JsonRecord) => void; onDelete: (id: string) => void }) {
  const [programmes, setProgrammes] = useState<JsonRecord[]>([]);
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [details, setDetails] = useState("");
  const [programmeId, setProgrammeId] = useState("");
  useEffect(() => { requestJson<{ data: JsonRecord[] }>("/api/admin/programmes").then((result) => setProgrammes(result.data)).catch((reason: unknown) => onError(reason instanceof Error ? reason.message : "Could not load programmes.")); }, [onError]);
  return <>
    <form className="form-card manager-form schedule-composer" onSubmit={(event) => { event.preventDefault(); onSave({ title, starts_at: new Date(startsAt).toISOString(), ends_at: endsAt ? new Date(endsAt).toISOString() : null, location, details, programme_id: programmeId || null }); setTitle(""); }}>
      <div className="composer-heading"><span className="composer-icon calendar"><CalendarDays size={19} /></span><div><h2>Plan a training session</h2><p>Add confirmed session dates and location for students.</p></div></div><Field label="Session title" value={title} onChange={setTitle} required />
      <label className="field">Programme<select value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}><option value="">All programmes</option>{programmes.map((p) => <option value={String(p.id)} key={String(p.id)}>{String(p.name)}</option>)}</select></label>
      <div className="form-row"><Field label="Starts" type="datetime-local" value={startsAt} onChange={setStartsAt} required /><Field label="Ends (optional)" type="datetime-local" value={endsAt} onChange={setEndsAt} /></div>
      <Field label="Location" value={location} onChange={setLocation} /><Field label="Details" value={details} onChange={setDetails} area />
      <button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Add session"}</button>
    </form>
    {records.length ? <div className="schedule-admin-grid">{records.map((row) => <article className="schedule-admin-card" key={String(row.id)}>
      <div className="schedule-date-tile"><span>{datePart(row.starts_at, "month")}</span><strong>{datePart(row.starts_at, "day")}</strong><small>{datePart(row.starts_at, "weekday")}</small></div>
      <div className="schedule-admin-info"><div className="schedule-admin-title"><div><span className="tag">{String((row.programmes as JsonRecord | null)?.name ?? "All programmes")}</span><h3>{String(row.title)}</h3></div><button className="icon-action danger-button" aria-label={`Remove ${String(row.title)}`} disabled={saving} onClick={() => onDelete(String(row.id))}><Trash2 size={16} /></button></div>
        <div className="schedule-admin-meta"><span><Clock3 size={14} />{date(row.starts_at, true)}{row.ends_at ? ` – ${date(row.ends_at, true)}` : ""}</span><span><MapPin size={14} />{String(row.location || "Location to be confirmed")}</span></div>
        {Boolean(row.details) && <p className="schedule-admin-details">{String(row.details)}</p>}
      </div>
    </article>)}</div> : <EmptyState title="No sessions scheduled">Add a confirmed training session when dates and locations are approved.</EmptyState>}
  </>;
}

function SettingsManager({ value, saving, onSave }: { value: JsonRecord | null; saving: boolean; onSave: (body: JsonRecord) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => { setName(String(value?.organization_name ?? "")); setEmail(String(value?.contact_email ?? "")); setPhone(String(value?.contact_phone ?? "")); }, [value]);
  return <form className="form-card manager-form settings-form" onSubmit={(event) => { event.preventDefault(); onSave({ organization_name: name, contact_email: email, contact_phone: phone }); }}>
    <div className="composer-heading"><span className="composer-icon"><UserRound size={19} /></span><div><h2>Organization information</h2><p>Only enter contact information approved for publication.</p></div></div>
    <Field label="Organization name" value={name} onChange={setName} required /><Field label="Public contact email" type="email" value={email} onChange={setEmail} /><Field label="Public contact phone" type="tel" value={phone} onChange={setPhone} />
    <button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
  </form>;
}

function AdminSummary({ section, records, onRefresh }: { section: string; records: JsonRecord[]; onRefresh: () => void }) {
  const [stats, setStats] = useState<JsonRecord | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [reconciliation, setReconciliation] = useState<JsonRecord | null>(null);
  const [reconciliationError, setReconciliationError] = useState("");
  const [reconciling, setReconciling] = useState(false);
  useEffect(() => {
    let active = true;
    requestJson<{ stats: JsonRecord }>("/api/admin/dashboard")
      .then((value) => { if (active) { setStats(value.stats); setSummaryError(""); } })
      .catch((reason: unknown) => { if (active) setSummaryError(reason instanceof Error ? reason.message : "Could not load live dashboard data."); });
    return () => { active = false; };
  }, [records]);
  if (summaryError) return <Notice title="Could not load dashboard data">{summaryError}</Notice>;
  if (!stats) return <EmptyState title="No live dashboard data">Add approved programmes and connect student activity to populate this dashboard.</EmptyState>;
  const revenue = (stats.revenueByCurrency ?? {}) as Record<string, number>;
  async function runReconciliation() {
    setReconciling(true);
    setReconciliationError("");
    try {
      setReconciliation(await requestJson<JsonRecord>("/api/admin/finance/reconciliation"));
    } catch (reason) {
      setReconciliationError(reason instanceof Error ? reason.message : "Could not run reconciliation.");
    } finally {
      setReconciling(false);
    }
  }
  return <>
    <div className="manager-heading"><p>{section === "reports" ? "Current totals from database records." : "Live operational summary."}</p><button className="button button-outline button-small" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button></div>
    <div className="stats">{([
      ["Students", stats.students], ["Applications", stats.applications], ["Awaiting review", stats.pending],
      ["Successful payments", stats.verifiedPayments],
    ] as [string, unknown][]).map(([label, amount]) => <div className="card stat" key={label}>{label}<b>{Number(amount ?? 0).toLocaleString()}</b></div>)}</div>
    <>
      <h2 className="subheading">Successful payments by currency</h2>
      {Object.keys(revenue).length ? <div className="summary-strip">{Object.entries(revenue).map(([currency, minor]) => <div key={currency}><span>{currency}</span><strong>{money(Number(minor), currency)}</strong></div>)}</div> : <p className="muted">No successful payments recorded.</p>}
    </>
    {section === "reports" && <div className="table-actions">
      <button className="button button-outline" onClick={() => window.location.assign("/api/admin/reports")}>Download current report (CSV) <Download size={15} /></button>
      <button className="button button-outline" type="button" onClick={() => void runReconciliation()} disabled={reconciling}>{reconciling ? "Reconciling…" : "Run reconciliation"} <RefreshCw size={15} /></button>
    </div>}
    {reconciliationError && <p className="wizard-error" role="alert">{reconciliationError}</p>}
    {reconciliation && <section className="student-panel" aria-live="polite">
      <h2>Payment reconciliation</h2>
      <p className="muted">Compared {String(reconciliation.internalRecords ?? 0)} internal and {String(reconciliation.providerRecords ?? 0)} provider records. No records were changed automatically.</p>
      {Array.isArray(reconciliation.discrepancies) && reconciliation.discrepancies.length
        ? <ul>{(reconciliation.discrepancies as JsonRecord[]).map((item, index) => <li key={`${String(item.type)}-${index}`}>{String(item.type).replaceAll("_", " ")} · {String(item.reference)}</li>)}</ul>
        : <p>No payment discrepancies were found for the default date range.</p>}
      <p className="muted">Pending refunds require manual provider review.</p>
    </section>}
    <div className="summary-section-heading"><div><h2 className="subheading">Recent applications</h2><p>Latest activity across the student portal.</p></div><span>{records.length} recent</span></div>
    {records.length ? <div className="summary-app-grid">{records.map((row) => {
      const personal = row.personal_details as JsonRecord | null;
      const programme = row.programmes as JsonRecord | null;
      const name = [personal?.firstName, personal?.lastName].filter(Boolean).join(" ") || "Student";
      return <article className="summary-app-card" key={String(row.id)}>
        <div className="summary-app-top"><span className="admin-avatar"><UserRound size={17} /></span><span className={`status-tag student-status ${String(row.status)}`}>{String(row.status).replaceAll("_", " ")}</span></div>
        <strong>{name}</strong><span className="summary-app-programme"><BookOpen size={14} />{String(programme?.name ?? "Training programme")}</span><small>{date(row.created_at, true)}</small>
      </article>;
    })}</div> : <EmptyState title="No applications yet">Applications will appear here after submission and payment verification.</EmptyState>}
  </>;
}

function StudentOverview({ value }: { value: JsonRecord | null }) {
  const stats = value?.stats as JsonRecord | undefined;
  const apps = (value?.applications ?? []) as JsonRecord[];
  const payments = (value?.payments ?? []) as JsonRecord[];
  return <>
    <div className="student-dashboard-heading">
      <div><span className="eyebrow">YOUR LEARNING JOURNEY</span><h2>Welcome to your portal</h2><p>Keep track of your applications, payments, and training updates.</p></div>
      <Link className="button button-primary" href="/training">Explore programmes <ArrowRight size={16} /></Link>
    </div>
    <div className="stats student-stat-grid">
      <article className="student-stat-card"><span className="student-stat-icon emerald"><BookOpen size={19} /></span><div><span>Applications</span><strong>{Number(stats?.applications ?? apps.length)}</strong></div><Link href="/student/applications" aria-label="View applications"><ArrowRight size={17} /></Link></article>
      <article className="student-stat-card"><span className="student-stat-icon gold"><CreditCard size={19} /></span><div><span>Verified payments</span><strong>{Number(stats?.verifiedPayments ?? 0)}</strong></div><Link href="/student/payments" aria-label="View payments"><ArrowRight size={17} /></Link></article>
      <article className="student-stat-card"><span className="student-stat-icon mint"><Bell size={19} /></span><div><span>Unread notifications</span><strong>{Number(value?.unread ?? 0)}</strong></div><Link href="/student/notifications" aria-label="View notifications"><ArrowRight size={17} /></Link></article>
    </div>
    <div className="student-overview-grid">
      <section className="student-panel">
        <div className="student-panel-heading"><div><h2>Recent applications</h2><p>Your latest application activity</p></div><Link href="/student/applications">View all <ArrowRight size={14} /></Link></div>
        {apps.length ? <div className="student-application-list">{apps.map((row) => {
          const programme = row.programmes as JsonRecord | null;
          const status = String(row.status).replaceAll("_", " ");
          return <article className="student-application-card" key={String(row.id)}>
            <span className="student-application-icon"><BookOpen size={18} /></span>
            <div className="student-application-info"><strong>{String(programme?.name ?? "Training programme")}</strong><span>Updated {date(row.submitted_at ?? row.created_at)}</span></div>
            <span className={`status-tag student-status ${String(row.status)}`}>{status}</span>
          </article>;
        })}</div> : <EmptyState title="No applications yet">Browse programmes and start your application when enrollment opens.</EmptyState>}
      </section>
      <section className="student-panel student-activity-panel">
        <div className="student-panel-heading"><div><h2>Latest payment</h2><p>Your verified transactions</p></div><CreditCard size={19} /></div>
        {payments.length ? payments.slice(0, 2).map((payment) => <div className="student-payment-card" key={String(payment.id)}>
          <span className="student-payment-icon"><CreditCard size={17} /></span><div><strong>{money(Number(payment.amount_minor), String(payment.currency))}</strong><span>{date(payment.created_at, true)}</span></div><span className={`status-tag student-status ${String(payment.status)}`}>{String(payment.status)}</span>
        </div>) : <div className="student-empty-note"><Clock3 size={19} /><p>No payments to show yet.</p></div>}
        <Link className="student-panel-link" href="/student/payments">Payment history <ArrowRight size={15} /></Link>
      </section>
    </div>
  </>;
}

function StudentApplications({ records }: { records: JsonRecord[] }) {
  return records.length ? <div className="student-record-grid">{records.map((row) => {
    const programme = row.programmes as JsonRecord | null;
    const status = String(row.status ?? "pending");
    const payments = (row.payments as JsonRecord[] | null) ?? [];
    const paid = payments.some((payment) => payment.status === "successful" || payment.status === "partially_refunded");
    return <article className="student-record-card" key={String(row.id)}>
      <div className="student-record-card-top"><span className="student-stat-icon emerald"><BookOpen size={18} /></span><span className={`status-tag student-status ${status}`}>{status.replaceAll("_", " ")}</span></div>
      <h2>{String(programme?.name ?? "Training programme")}</h2>
      <p className="student-record-meta"><CalendarDays size={14} />Started {date(row.created_at)}</p>
      <div className="student-record-footer"><span>Added {date(row.created_at)}</span>{status === "draft" && paid ? <ApplicationSubmitAction applicationId={String(row.id)} /> : status === "draft" ? <Link className="button button-primary button-small" href={`/checkout/${row.id}`}>Continue checkout <ArrowRight size={14} /></Link> : <span className="student-record-id">{String(row.application_reference ?? "Application")}</span>}</div>
    </article>;
  })}</div> : <EmptyState title="No applications yet">Your submitted applications will appear here.</EmptyState>;
}

function StudentPayments({ records }: { records: JsonRecord[] }) {
  return records.length ? <div className="student-record-grid payment-record-grid">{records.map((row) => {
    const verified = row.status === "successful";
    return <article className="student-record-card student-payment-record" key={String(row.id)}>
      <div className="student-record-card-top"><span className="student-stat-icon gold"><CreditCard size={18} /></span><span className={`status-tag student-status ${String(row.status)}`}>{String(row.status)}</span></div>
      <span className="payment-record-label">Payment amount</span><strong className="payment-record-amount">{money(Number(row.amount_minor), String(row.currency))}</strong>
      <div className="payment-record-details"><span><Clock3 size={14} />{date(row.verified_at ?? row.created_at, true)}</span><code>{String(row.provider_reference)}</code></div>
      {verified ? <a className="button button-primary button-small receipt-download" href={`/api/payments/receipt?reference=${encodeURIComponent(String(row.provider_reference))}`}><Download size={15} /> Download PDF receipt</a> : <p className="payment-verification-note"><Clock3 size={14} />Receipt available after payment verification.</p>}
    </article>;
  })}</div> : <EmptyState title="No payment records">Verified payments will appear here.</EmptyState>;
}

function ProfileManager({ value, saving, onSave }: { value: JsonRecord | null; saving: boolean; onSave: (body: JsonRecord) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const profile = isRecord(value) ? value : null;
  useEffect(() => { setName(String(profile?.full_name ?? "")); setPhone(String(profile?.phone ?? "")); setEmail(String(value?.email ?? "")); }, [profile, value?.email]);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (newPassword.length < 8) {
      setPasswordError("Use a password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The password entries do not match.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setPasswordError("Account services are not configured.");
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordError(`Could not update password: ${error.message}`);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Your password has been updated.");
  }

  if (!profile) return <EmptyState title="Profile unavailable">Your student profile has not been created. Contact an administrator.</EmptyState>;

  const completion = [Boolean(name.trim()), Boolean(email.trim()), Boolean(phone.trim())].filter(Boolean).length;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "S";
  return <div className="profile-page">
    <section className="profile-hero">
      <div className="profile-hero-person"><span className="profile-avatar">{initials}</span><div><span className="eyebrow">STUDENT ACCOUNT</span><h2>{name || "Complete your profile"}</h2><p>{email}</p><small>Member since {date(profile.created_at)}</small></div></div>
      <div className="profile-completion" aria-label={`Profile ${Math.round(completion / 3 * 100)} percent complete`}>
        <div><span>Profile completion</span><strong>{Math.round(completion / 3 * 100)}%</strong></div>
        <div className="profile-progress-track"><span style={{ width: `${completion / 3 * 100}%` }} /></div>
        <small>{completion === 3 ? "Your contact details are up to date." : "Add your contact details to complete your profile."}</small>
      </div>
    </section>
    <div className="profile-feature-grid">
      <form className="form-card manager-form profile-feature-card" onSubmit={(event) => { event.preventDefault(); onSave({ full_name: name, phone }); }}>
        <div className="composer-heading"><span className="composer-icon"><UserRound size={19} /></span><div><h2>Personal information</h2><p>Manage the details associated with your student account.</p></div></div>
        <Field label="Full name" value={name} onChange={setName} required />
        <Field label="Email address" type="email" value={email} onChange={() => {}} disabled />
        <Field label="Phone number" type="tel" value={phone} onChange={setPhone} />
        <p className="profile-form-note"><ShieldCheck size={15} /> Email is managed by your sign-in provider and cannot be changed here.</p>
        <button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
      </form>
      <form className="form-card manager-form profile-feature-card security-form" onSubmit={(event) => void updatePassword(event)}>
        <div className="composer-heading"><span className="composer-icon security"><KeyRound size={19} /></span><div><h2>Account security</h2><p>Change your sign-in password.</p></div></div>
        <label className="field">New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} required /></label>
        <label className="field">Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></label>
        <p className="profile-form-note"><ShieldCheck size={15} /> Choose at least 8 characters. Your password is updated securely through account services.</p>
        {passwordError && <p className="profile-form-error" role="alert">{passwordError}</p>}
        {passwordMessage && <p className="success-message" role="status"><Check size={15} />{passwordMessage}</p>}
        <button className="button button-outline" disabled={passwordSaving}>{passwordSaving ? "Updating password…" : "Update password"}</button>
      </form>
    </div>
    <aside className="profile-account-note"><ShieldCheck size={17} /><div><strong>Account privacy</strong><p>Your profile is visible only to you and authorized Tamark administrators.</p></div></aside>
  </div>;
}

function StudentSchedule({ records }: { records: JsonRecord[] }) {
  return records.length ? <div className="student-schedule-list">{records.map((row) => <article className="student-schedule-card" key={String(row.id)}>
    <div className="schedule-date-tile"><span>{datePart(row.starts_at, "month")}</span><strong>{datePart(row.starts_at, "day")}</strong><small>{datePart(row.starts_at, "weekday")}</small></div>
    <div className="student-schedule-info"><div className="student-schedule-heading"><div><span className="tag">{String((row.programmes as JsonRecord | null)?.name ?? "All programmes")}</span><h2>{String(row.title)}</h2></div><span className="schedule-confirmed"><Check size={13} />Scheduled</span></div>
      <div className="student-schedule-meta"><span><CalendarDays size={14} />{date(row.starts_at, true)}{row.ends_at ? ` – ${date(row.ends_at, true)}` : ""}</span><span><MapPin size={14} />{String(row.location || "Location to be confirmed")}</span></div>{Boolean(row.details) && <p>{String(row.details)}</p>}
    </div>
  </article>)}</div> : <EmptyState title="No training sessions scheduled">Confirmed training dates will appear here.</EmptyState>;
}

function StudentMessages({ records, section, onRead }: { records: JsonRecord[]; section: string; onRead: (id: string, read: boolean) => void }) {
  return <>
    {section === "notifications" && <PushNotificationControl />}
    {records.length ? <div className="message-list">{records.map((row) => <article className={`message-card ${row.read_at ? "read" : ""}`} key={String(row.id)}>
      <div className="message-header"><h2>{String(row.title)}</h2><time>{date(row.created_at ?? row.published_at, true)}</time></div><p>{String(row.body)}</p>
      {section === "notifications" && <button className="button button-outline button-small" onClick={() => onRead(String(row.id), !row.read_at)}>{row.read_at ? "Mark unread" : "Mark read"}</button>}
    </article>)}</div> : <EmptyState title={section === "notifications" ? "No notifications" : "No announcements"}>Updates will appear here when available.</EmptyState>}
  </>;
}

function Field({ label, value, onChange, type = "text", required = false, area = false, disabled = false, min, step }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; area?: boolean; disabled?: boolean; min?: string; step?: string;
}) {
  return <label className="field">{label}{area ? <textarea value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} disabled={disabled} min={min} step={step} />}</label>;
}

function date(value: unknown, includeTime = false) {
  if (typeof value !== "string" || !value) return "—";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(d);
}

function datePart(value: unknown, part: "month" | "day" | "weekday") {
  if (typeof value !== "string" || !value) return part === "day" ? "—" : "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return part === "day" ? "—" : "";
  if (part === "day") return new Intl.DateTimeFormat(undefined, { day: "2-digit" }).format(parsed);
  if (part === "month") return new Intl.DateTimeFormat(undefined, { month: "short" }).format(parsed).toUpperCase();
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(parsed);
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minor / 100);
}
