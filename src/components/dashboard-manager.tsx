"use client";

import { FormEvent, Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell, BookOpen, CalendarDays, Check, Clock3, Download, FileText, ImagePlus, KeyRound, Mail, MapPin, Pencil, Phone, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, Award } from "lucide-react";
import { EmptyState, Notice } from "@/components/ui";
import type { Programme } from "@/lib/programmes";
import { getProgrammeImageUrl } from "@/lib/programme-images";
import { PushNotificationControl } from "@/components/push-notification-control";
import { useToast } from "@/components/toast-provider";
import { PasswordField } from "@/components/password-field";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

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
  const toast = useToast();
  const [data, setData] = useState<JsonRecord[]>([]);
  const [single, setSingle] = useState<JsonRecord | null>(null);
  const [related, setRelated] = useState<JsonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<JsonRecord | null>(null);

  useEffect(() => {
    let active = true;
    const endpoints: Record<string, string> = kind === "admin" ? {
      programmes: "/api/admin/programmes",
      applications: "/api/admin/applications",
      students: "/api/admin/students",
      announcements: "/api/admin/announcements",
      schedule: "/api/admin/schedule",
      settings: "/api/admin/settings",
      gallery: "/api/admin/gallery",
      certificates: "/api/admin/certificates",
      dashboard: "/api/admin/dashboard",
      reports: "/api/admin/dashboard",
    } : {
      overview: "/api/student/overview",
      applications: "/api/student/applications",
      certificates: "/api/student/certificates",
      profile: "/api/student/profile",
      schedule: "/api/student/schedule",
      notifications: "/api/student/notifications",
      announcements: "/api/student/announcements",
    };
    const path = endpoints[section];
    if (!path) { setLoading(false); return; }
    setLoading(true); setError("");
    requestJson<{ data?: unknown; students?: JsonRecord[]; email?: string; stats?: JsonRecord; recent?: JsonRecord[]; applications?: JsonRecord[]; unread?: number }>(path)
      .then((result) => {
        if (!active) return;
        if (section === "profile") setSingle(isRecord(result.data) ? { ...result.data, email: result.email } : null);
        else if (section === "settings") setSingle(isRecord(result.data) ? result.data : null);
        else if (section === "dashboard" || section === "reports") setData((result.recent ?? []) as JsonRecord[]);
        else if (section === "overview") {
          setData(result.applications ?? []);
          setSingle({ stats: result.stats, unread: result.unread, applications: result.applications });
        } else {
          setData(Array.isArray(result.data) ? result.data.filter(isRecord) : []);
          if (section === "certificates") setRelated(result.students ?? []);
        }
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load dashboard data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, section, refresh]);

  async function mutate(url: string, method: "POST" | "PATCH" | "DELETE", body?: JsonRecord) {
    setSaving(true); setError("");
    try {
      await requestJson(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      toast({ kind: "success", title: "Changes saved" });
      setEditing(null);
      setRefresh((value) => value + 1);
    } catch (reason) {
      toast({ kind: "error", title: "Could not save changes", description: reason instanceof Error ? reason.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted" role="status">Loading records…</p>;
  return <div className="dashboard-manager">
    {error && <Notice title="Action could not be completed">{error}</Notice>}
    {kind === "admin" && section === "programmes" && <ProgrammeManager programmes={data as unknown as Programme[]} editing={editing} setEditing={setEditing} saving={saving} onSave={(body, id) => mutate(`/api/admin/programmes${id ? `/${id}` : ""}`, id ? "PATCH" : "POST", body)} onUnpublish={(id) => void mutate(`/api/admin/programmes/${id}`, "DELETE")} />}
    {kind === "admin" && section === "applications" && <ApplicationsManager records={data} saving={saving} onDecision={(id, status, expectedUpdatedAt) => void mutate(`/api/admin/applications/${id}`, "PATCH", { status, expectedUpdatedAt })} />}
    {kind === "admin" && section === "students" && <StudentsManager records={data} />}
    {kind === "admin" && section === "gallery" && <GalleryManager records={data} onRefresh={() => setRefresh((value) => value + 1)} />}
    {kind === "admin" && section === "certificates" && <CertificatesManager records={data} students={related} onRefresh={() => setRefresh((value) => value + 1)} />}
    {kind === "admin" && section === "announcements" && <AnnouncementsManager records={data} saving={saving} onSave={(body) => void mutate("/api/admin/announcements", "POST", body)} onUpdate={(id, body) => void mutate(`/api/admin/announcements/${id}`, "PATCH", body)} onDelete={(id) => void mutate(`/api/admin/announcements/${id}`, "DELETE")} />}
    {kind === "admin" && section === "schedule" && <ScheduleManager records={data} saving={saving} onError={setError} onSave={(body) => void mutate("/api/admin/schedule", "POST", body)} onDelete={(id) => void mutate(`/api/admin/schedule/${id}`, "DELETE")} />}
    {kind === "admin" && section === "settings" && <SettingsManager value={single} saving={saving} onSave={(body) => void mutate("/api/admin/settings/organization", "PATCH", body)} />}
    {kind === "admin" && (section === "dashboard" || section === "reports") && <AdminSummary section={section} records={data} onRefresh={() => setRefresh((value) => value + 1)} />}
    {kind === "student" && section === "overview" && <StudentOverview value={single} />}
    {kind === "student" && section === "applications" && <StudentApplications records={data} />}
    {kind === "student" && section === "certificates" && <StudentCertificates records={data} />}
    {kind === "student" && section === "profile" && <ProfileManager value={single} saving={saving} onSave={(body) => void mutate("/api/student/profile", "PATCH", body)} />}
    {kind === "student" && section === "schedule" && <StudentSchedule records={data} />}
    {kind === "student" && (section === "notifications" || section === "announcements") && <StudentMessages records={data} section={section} onRead={(id, read) => void mutate(`/api/student/notifications/${id}`, "PATCH", { read })} />}
  </div>;
}

function ProgrammeManager({ programmes, editing, setEditing, saving, onSave, onUnpublish }: {
  programmes: Programme[]; editing: JsonRecord | null; setEditing: (value: JsonRecord | null) => void; saving: boolean; onSave: (body: JsonRecord, id?: string) => Promise<void>; onUnpublish: (id: string) => void;
}) {
  return <>
    <div className="manager-heading"><p>Publish a programme when its training information is ready for applications.</p><button className="button button-primary" type="button" onClick={() => setEditing({})}><Plus size={16} /> Add programme</button></div>
    {editing !== null && typeof editing.id !== "string" && <ProgrammeForm value={editing} saving={saving} onCancel={() => setEditing(null)} onSave={(body) => onSave(body)} />}
    {programmes.length ? <div className="data-table-wrap programme-admin-table-wrap">
      <table className="programme-admin-table">
        <caption className="sr-only">Training programmes and management actions</caption>
        <thead><tr><th scope="col">Image</th><th scope="col">Programme details</th><th scope="col">Duration</th><th scope="col">Publication</th><th scope="col">Catalogue</th><th scope="col">Actions</th></tr></thead>
        <tbody>{programmes.map((p) => {
      const imageUrl = getProgrammeImageUrl(p.image_path);
      const isEditing = editing?.id === p.id;
      return <Fragment key={p.id}>
        <tr>
          <td><span className="programme-admin-thumb" role={imageUrl ? "img" : undefined} aria-label={imageUrl ? `${p.name} image` : undefined} style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}>{!imageUrl && <ImagePlus size={22} aria-hidden="true" />}</span></td>
          <td className="programme-admin-details">
            <strong>{p.name}</strong>
            <span className="programme-admin-category">{p.category || "Uncategorized"}</span>
            <span className="programme-admin-slug">/{p.slug}</span>
            <p>{p.summary || "Programme description not added yet."}</p>
          </td>
          <td>{p.duration || "Not set"}</td>
          <td><span className={`status-tag ${p.is_published ? "status-published" : "status-draft"}`}>{p.is_published ? "Published" : "Draft"}</span></td>
          <td><span className={`status-tag programme-catalogue-status ${p.is_listed ? "listed" : "hidden"}`}>{p.is_listed ? "Listed" : "Hidden"}</span></td>
          <td><div className="table-actions programme-admin-actions">
            <button className="button button-outline button-small" type="button" disabled={saving} aria-expanded={isEditing} aria-controls={`programme-edit-${p.id}`} onClick={() => setEditing(isEditing ? null : { ...p, curriculum: p.curriculum.join("\n"), outcomes: p.outcomes.join("\n") })}><Pencil size={14} /> {isEditing ? "Cancel" : "Edit"}</button>
            {p.is_published && <button className="button button-outline button-small" type="button" disabled={saving} onClick={() => onUnpublish(p.id)}>Unpublish</button>}
          </div></td>
        </tr>
        <tr id={`programme-edit-${p.id}`} className="programme-admin-edit-row" hidden={!isEditing}>
          <td colSpan={6}>{isEditing && editing && <ProgrammeForm value={editing} saving={saving} onCancel={() => setEditing(null)} onSave={(body) => onSave(body, p.id)} />}</td>
        </tr>
      </Fragment>;
    })}</tbody>
      </table>
    </div> : <EmptyState title="No programme records">Use “Add programme” to create a draft course record.</EmptyState>}
  </>;
}

function ProgrammeForm({ value, saving, onCancel, onSave }: { value: JsonRecord; saving: boolean; onCancel: () => void; onSave: (body: JsonRecord) => Promise<void> }) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [form, setForm] = useState({
    name: String(value.name ?? ""), slug: String(value.slug ?? ""), category: String(value.category ?? ""), summary: String(value.summary ?? ""),
    duration: String(value.duration ?? ""), entry_requirements: String(value.entry_requirements ?? ""),
    curriculum: Array.isArray(value.curriculum) ? value.curriculum.join("\n") : String(value.curriculum ?? ""),
    outcomes: Array.isArray(value.outcomes) ? value.outcomes.join("\n") : String(value.outcomes ?? ""),
    is_published: value.is_published === true,
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
      await onSave({ ...form, image_path: imagePath, curriculum: form.curriculum.split("\n").map((s) => s.trim()).filter(Boolean), outcomes: form.outcomes.split("\n").map((s) => s.trim()).filter(Boolean) });
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
    <Field label="Entry requirements" value={form.entry_requirements} onChange={(v) => update("entry_requirements", v)} />
    <div className="form-row"><Field label="Curriculum (one item per line)" value={form.curriculum} onChange={(v) => update("curriculum", v)} area /><Field label="Learning outcomes (one per line)" value={form.outcomes} onChange={(v) => update("outcomes", v)} area /></div>
    <label className="check-field"><input type="checkbox" checked={form.is_published} onChange={(e) => update("is_published", e.target.checked)} /> Publish this programme</label>
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
      const name = profile?.full_name || [personal?.firstName, personal?.lastName].filter(Boolean).join(" ") || "Applicant";
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
  const [whatsappPhone, setWhatsappPhone] = useState("");
  useEffect(() => { setName(String(value?.organization_name ?? "")); setEmail(String(value?.contact_email ?? "")); setPhone(String(value?.contact_phone ?? "")); setWhatsappPhone(String(value?.whatsapp_phone || "+234")); }, [value]);
  return <form className="form-card manager-form settings-form" onSubmit={(event) => { event.preventDefault(); onSave({ organization_name: name, contact_email: email, contact_phone: phone, whatsapp_phone: whatsappPhone }); }}>
    <div className="composer-heading"><span className="composer-icon"><UserRound size={19} /></span><div><h2>Organization information</h2><p>Only enter contact information approved for publication.</p></div></div>
    <Field label="Organization name" value={name} onChange={setName} required /><Field label="Public contact email" type="email" value={email} onChange={setEmail} /><Field label="Public contact phone" type="tel" value={phone} onChange={setPhone} />
    <div><Field label="WhatsApp applications number" type="tel" value={whatsappPhone} onChange={setWhatsappPhone} /><small className="settings-help">Nigeria’s +234 country code is prefilled. Enter the remaining digits without the leading 0, or replace it with another country code.</small></div>
    <button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save settings"}</button>
  </form>;
}

function AdminSummary({ section, records, onRefresh }: { section: string; records: JsonRecord[]; onRefresh: () => void }) {
  const [stats, setStats] = useState<JsonRecord | null>(null);
  const [summaryError, setSummaryError] = useState("");
  useEffect(() => {
    let active = true;
    requestJson<{ stats: JsonRecord }>("/api/admin/dashboard")
      .then((value) => { if (active) { setStats(value.stats); setSummaryError(""); } })
      .catch((reason: unknown) => { if (active) setSummaryError(reason instanceof Error ? reason.message : "Could not load live dashboard data."); });
    return () => { active = false; };
  }, [records]);
  if (summaryError) return <Notice title="Could not load dashboard data">{summaryError}</Notice>;
  if (!stats) return <EmptyState title="No live dashboard data">Publish training programmes and connect student activity to populate this dashboard.</EmptyState>;
  return <>
    <div className="manager-heading"><p>{section === "reports" ? "Current student and application totals." : "Live operational summary."}</p><button className="button button-outline button-small" onClick={onRefresh}><RefreshCw size={14} /> Refresh</button></div>
    <div className="stats">{([
      ["Students", stats.students], ["Applications", stats.applications], ["Awaiting review", stats.pending],
    ] as [string, unknown][]).map(([label, amount]) => <div className="card stat" key={label}>{label}<b>{Number(amount ?? 0).toLocaleString()}</b></div>)}</div>
    {section === "reports" && <div className="table-actions">
      <button className="button button-outline" onClick={() => window.location.assign("/api/admin/reports")}>Download current report (CSV) <Download size={15} /></button>
    </div>}
    <div className="summary-section-heading"><div><h2 className="subheading">Recent applications</h2><p>Latest activity across the student portal.</p></div><span>{records.length} recent</span></div>
    {records.length ? <div className="summary-app-grid">{records.map((row) => {
      const personal = row.personal_details as JsonRecord | null;
      const programme = row.programmes as JsonRecord | null;
      const name = [personal?.firstName, personal?.lastName].filter(Boolean).join(" ") || "Student";
      return <article className="summary-app-card" key={String(row.id)}>
        <div className="summary-app-top"><span className="admin-avatar"><UserRound size={17} /></span><span className={`status-tag student-status ${String(row.status)}`}>{String(row.status).replaceAll("_", " ")}</span></div>
        <strong>{name}</strong><span className="summary-app-programme"><BookOpen size={14} />{String(programme?.name ?? "Training programme")}</span><small>{date(row.created_at, true)}</small>
      </article>;
    })}</div> : <EmptyState title="No applications yet">Applications will appear here after students submit their details.</EmptyState>}
  </>;
}

function GalleryManager({ records, onRefresh }: { records: JsonRecord[]; onRefresh: () => void }) {
  const toast = useToast();
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!image) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image) {
      toast({ kind: "error", title: "Choose an image", description: "Select a JPG, PNG, or WebP image to upload." });
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      const title = image.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Gallery photo";
      form.set("title", title.slice(0, 160));
      form.set("description", "");
      form.set("sort_order", "0");
      form.set("is_published", "true");
      form.set("image", image);
      const response = await fetch("/api/admin/gallery", { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not upload gallery image.");
      setImage(null);
      onRefresh();
      toast({ kind: "success", title: "Image uploaded", description: "The image is now available in the gallery." });
    } catch (reason) {
      toast({ kind: "error", title: "Image upload failed", description: reason instanceof Error ? reason.message : "Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return <>
    <form className="form-card manager-form gallery-upload-form" onSubmit={(event) => void upload(event)}>
      <label className="gallery-upload-box">
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose gallery image" onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
            event.currentTarget.value = "";
            setImage(null);
            toast({ kind: "error", title: "Unsupported image format", description: "Choose a JPG, PNG, or WebP image." });
            return;
          }
          if (file && file.size > 5 * 1024 * 1024) {
            event.currentTarget.value = "";
            setImage(null);
            toast({ kind: "error", title: "Image is too large", description: "Choose an image no larger than 5 MB." });
            return;
          }
          setImage(file);
        }} />
        {previewUrl ? <span className="gallery-upload-preview" role="img" aria-label="Selected gallery image preview" style={{ backgroundImage: `url("${previewUrl}")` }} /> : <span className="gallery-upload-empty"><ImagePlus size={28} /><strong>Select an image</strong></span>}
        <span className="gallery-upload-overlay">{image ? "Choose a different image" : "Choose image"}</span>
      </label>
      <p className="gallery-upload-help">JPG, PNG or WebP · Up to 5 MB · Uploaded images appear on the public homepage.</p>
      {image && <p className="gallery-upload-filename">{image.name}</p>}
      <button className="button button-primary" disabled={busy || !image}>{busy ? "Uploading…" : "Upload image"}</button>
    </form>
    {records.length ? <div className="data-table-wrap gallery-admin-table-wrap">
      <table className="gallery-admin-table">
        <caption className="sr-only">Gallery photos and management actions</caption>
        <thead><tr><th scope="col">Image</th><th scope="col">Photo details</th><th scope="col">Order</th><th scope="col">Status</th><th scope="col">Added</th><th scope="col">Actions</th></tr></thead>
        <tbody>{records.map((item) => <GalleryItemEditor key={String(item.id)} item={item} onRefresh={onRefresh} />)}</tbody>
      </table>
    </div> : <EmptyState title="No gallery photos">Upload an approved photo to publish it on the website.</EmptyState>}
  </>;
}

function GalleryItemEditor({ item, onRefresh }: { item: JsonRecord; onRefresh: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(String(item.title ?? ""));
  const [description, setDescription] = useState(String(item.description ?? ""));
  const [sortOrder, setSortOrder] = useState(String(item.sort_order ?? 0));
  const [published, setPublished] = useState(item.is_published === true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const itemId = String(item.id);
  const editId = `gallery-edit-${itemId}`;

  function cancelEdit() {
    setTitle(String(item.title ?? ""));
    setDescription(String(item.description ?? ""));
    setSortOrder(String(item.sort_order ?? 0));
    setPublished(item.is_published === true);
    setEditing(false);
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await requestJson(`/api/admin/gallery/${encodeURIComponent(String(item.id))}`, {
        method: "PATCH",
        body: JSON.stringify({ title, description, sort_order: Number(sortOrder), is_published: published }),
      });
      setEditing(false);
      onRefresh();
      toast({ kind: "success", title: "Photo updated" });
    } catch (reason) {
      toast({ kind: "error", title: "Could not update photo", description: reason instanceof Error ? reason.message : "Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this gallery photo? This also removes the image file.")) return;
    setBusy(true);
    try {
      await requestJson(`/api/admin/gallery/${encodeURIComponent(String(item.id))}`, { method: "DELETE" });
      onRefresh();
      toast({ kind: "success", title: "Photo deleted" });
    } catch (reason) {
      toast({ kind: "error", title: "Could not delete photo", description: reason instanceof Error ? reason.message : "Please try again." });
      onRefresh();
    } finally {
      setBusy(false);
    }
  }
  return <>
    <tr>
      <td>{typeof item.image_url === "string" && <span className="gallery-admin-thumb" role="img" aria-label={title} style={{ backgroundImage: `url("${item.image_url}")` }} />}</td>
      <td className="gallery-admin-details"><strong>{title || "Untitled photo"}</strong><span>{description || "No caption"}</span></td>
      <td>{String(item.sort_order ?? 0)}</td>
      <td><span className={`status-tag gallery-admin-status ${item.is_published === true ? "published" : "unpublished"}`}>{item.is_published === true ? "Published" : "Hidden"}</span></td>
      <td>{date(item.created_at)}</td>
      <td><div className="table-actions">
        <button className="button button-outline button-small" type="button" aria-expanded={editing} aria-controls={editId} disabled={busy} onClick={() => editing ? cancelEdit() : setEditing(true)}><Pencil size={14} /> {editing ? "Cancel" : "Edit"}</button>
        <button className="button button-outline button-small danger-button" type="button" disabled={busy} onClick={() => void remove()}><Trash2 size={14} /> Delete</button>
      </div></td>
    </tr>
    <tr className="gallery-admin-edit-row" hidden={!editing}>
      <td colSpan={6}>
        <form id={editId} className="gallery-admin-edit-form" onSubmit={(event) => void update(event)}>
          <Field label="Image title and alt text" value={title} onChange={setTitle} required />
          <Field label="Caption" value={description} onChange={setDescription} area />
          <Field label="Display order" value={sortOrder} onChange={setSortOrder} type="number" min="0" />
          <label className="check-field"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} /> Published on public homepage</label>
          <div className="wizard-actions">
            <button className="button button-outline button-small" type="button" disabled={busy} onClick={cancelEdit}>Cancel</button>
            <button className="button button-primary button-small" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      </td>
    </tr>
  </>;
}

function CertificatesManager({ records, students, onRefresh }: { records: JsonRecord[]; students: JsonRecord[]; onRefresh: () => void }) {
  const toast = useToast();
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("Certificate of Completion");
  const [programmeName, setProgrammeName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      toast({ kind: "error", title: "Choose a certificate", description: "Select the student's PDF certificate before issuing it." });
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("student_id", studentId);
      form.set("title", title);
      form.set("programme_name", programmeName);
      form.set("certificate", file);
      const response = await fetch("/api/admin/certificates", { method: "POST", body: form });
      const result = await response.json() as { error?: string; warnings?: string[] };
      if (!response.ok) throw new Error(result.error || "Could not issue certificate.");
      toast(result.warnings?.length
        ? { kind: "info", title: "Certificate issued", description: result.warnings.join(" ") }
        : { kind: "success", title: "Certificate issued", description: "The student has been notified." });
      setFile(null);
      onRefresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Please try again.";
      toast({ kind: "error", title: "Could not issue certificate", description: message });
    } finally {
      setBusy(false);
    }
  }

  return <>
    <form className="form-card manager-form" onSubmit={(event) => void issue(event)}>
      <div className="composer-heading"><span className="composer-icon"><Award size={19} /></span><div><h2>Send a certificate</h2><p>Upload an individual PDF. It is stored privately and only that student can download it.</p></div></div>
      <label className="field">Student<select value={studentId} onChange={(event) => setStudentId(event.target.value)} required><option value="">Select a student</option>{students.map((student) => <option value={String(student.id)} key={String(student.id)}>{String(student.full_name || student.email || "Student")} · {String(student.email ?? "no email")}</option>)}</select></label>
      <Field label="Certificate title" value={title} onChange={setTitle} required />
      <Field label="Programme name (optional)" value={programmeName} onChange={setProgrammeName} />
      <label className="field">Certificate PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></label>
      <small>PDF only · maximum 10 MB</small>
      <button className="button button-primary" disabled={busy || students.length === 0}>{busy ? "Issuing…" : "Issue certificate"}</button>
    </form>
    {records.length ? <div className="student-record-grid">{records.map((record) => {
      const student = record.profiles as JsonRecord | null;
      return <article className="student-record-card" key={String(record.id)}><div className="student-record-card-top"><span className="student-stat-icon emerald"><Award size={18} /></span><span className="tag">{date(record.created_at)}</span></div><h2>{String(record.title)}</h2><p>{String(student?.full_name || student?.email || "Student")}</p>{Boolean(record.programme_name) && <p className="muted">{String(record.programme_name)}</p>}</article>;
    })}</div> : <EmptyState title="No certificates issued">Certificates sent to students will appear here.</EmptyState>}
  </>;
}

function StudentCertificates({ records }: { records: JsonRecord[] }) {
  return records.length ? <div className="student-record-grid">{records.map((certificate) => <article className="student-record-card" key={String(certificate.id)}>
    <div className="student-record-card-top"><span className="student-stat-icon emerald"><Award size={18} /></span><span className="tag">{date(certificate.created_at)}</span></div>
    <h2>{String(certificate.title)}</h2>
    {Boolean(certificate.programme_name) && <p className="muted">{String(certificate.programme_name)}</p>}
    <a className="button button-primary button-small" href={`/api/student/certificates/${encodeURIComponent(String(certificate.id))}`}><Download size={15} /> Download certificate</a>
  </article>)}</div> : <EmptyState title="No certificates yet">Certificates issued by Tamark will appear here.</EmptyState>;
}

function StudentOverview({ value }: { value: JsonRecord | null }) {
  const stats = value?.stats as JsonRecord | undefined;
  const apps = (value?.applications ?? []) as JsonRecord[];
  return <>
    <div className="student-dashboard-heading">
      <div><span className="eyebrow">YOUR LEARNING JOURNEY</span><h2>Welcome to your portal</h2><p>Keep track of your applications, certificates, and training updates.</p></div>
      <Link className="button button-primary" href="/training">Explore programmes <ArrowRight size={16} /></Link>
    </div>
    <div className="stats student-stat-grid">
      <article className="student-stat-card"><span className="student-stat-icon emerald"><BookOpen size={19} /></span><div><span>Applications</span><strong>{Number(stats?.applications ?? apps.length)}</strong></div><Link href="/student/applications" aria-label="View applications"><ArrowRight size={17} /></Link></article>
      <article className="student-stat-card"><span className="student-stat-icon gold"><Award size={19} /></span><div><span>Certificates</span><strong>{Number(stats?.certificates ?? 0)}</strong></div><Link href="/student/certificates" aria-label="View certificates"><ArrowRight size={17} /></Link></article>
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
        <div className="student-panel-heading"><div><h2>Certificates</h2><p>Download certificates issued by Tamark.</p></div><Award size={19} /></div>
        <Link className="student-panel-link" href="/student/certificates">View certificates <ArrowRight size={15} /></Link>
      </section>
    </div>
  </>;
}

function StudentApplications({ records }: { records: JsonRecord[] }) {
  return records.length ? <div className="student-record-grid">{records.map((row) => {
    const programme = row.programmes as JsonRecord | null;
    const status = String(row.status ?? "pending");
    return <article className="student-record-card" key={String(row.id)}>
      <div className="student-record-card-top"><span className="student-stat-icon emerald"><BookOpen size={18} /></span><span className={`status-tag student-status ${status}`}>{status.replaceAll("_", " ")}</span></div>
      <h2>{String(programme?.name ?? "Training programme")}</h2>
      <p className="student-record-meta"><CalendarDays size={14} />Started {date(row.created_at)}</p>
      <div className="student-record-footer"><span>Added {date(row.created_at)}</span>{status === "draft" ? <Link className="button button-primary button-small" href="/apply">Continue application <ArrowRight size={14} /></Link> : <span className="student-record-id">{String(row.application_reference ?? "Application")}</span>}</div>
    </article>;
  })}</div> : <EmptyState title="No applications yet">Your submitted applications will appear here.</EmptyState>;
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
        <PasswordField label="New password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} minLength={8} required />
        <PasswordField label="Confirm new password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} minLength={8} required />
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
