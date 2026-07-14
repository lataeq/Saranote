import { chmodSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { canAccessMeeting, canManageTeam, isMeetingParticipant, resolveSpokenOwner, type MeetingAccessRule, type MeetingAudience, type SpecialtyTeam, type TaskStatus, type UserRole } from "@/lib/domain";

export type User = {
  id: number;
  name: string;
  email: string;
  spokenName: string;
  role: UserRole;
  team: SpecialtyTeam | null;
  createdAt: string;
};

export type Meeting = {
  id: number;
  title: string;
  heldAt: string;
  status: "active" | "closed";
  transcript: string;
  team: SpecialtyTeam | null;
  audience: MeetingAudience;
  audienceUserId: number | null;
  audienceUserName: string | null;
  accessRules: MeetingAccessRule[];
  extractedActions: DetectedAction[];
  summary: MeetingSummary;
  processingStatus: "idle" | "processing" | "completed" | "failed";
  processingError: string;
  createdAt: string;
  createdByName: string;
  fileCount: number;
  taskCount: number;
};

export type MeetingSummary = {
  decisions: string[];
  risks: string[];
  important_points: string[];
  follow_ups: string[];
};

export type DetectedAction = {
  task: string;
  owner: string;
  detectedOwner?: string;
  ownerUserId?: number;
  deadline: string | null;
  evidence: { timestamp: string; text: string };
};

export type StoredFile = {
  id: number;
  meetingId: number;
  taskId: number | null;
  originalName: string;
  storedName: string;
  mimeType: string;
  kind: "audio" | "document" | "submission";
  size: number;
  createdAt: string;
  uploadedByName: string;
};

export type Task = {
  id: number;
  meetingId: number;
  meetingTitle: string;
  team: SpecialtyTeam | null;
  audience: MeetingAudience;
  audienceUserId: number | null;
  title: string;
  description: string;
  assigneeId: number;
  assigneeName: string;
  assigneeTeam: SpecialtyTeam | null;
  dueAt: string | null;
  status: TaskStatus;
  submissionText: string;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
  submissionFileId: number | null;
  submissionFileName: string | null;
};

const dataDirectory = process.env.SARANOTE_DATA_DIR
  ? path.resolve(process.env.SARANOTE_DATA_DIR)
  : path.join(process.cwd(), "data");

export const uploadsDirectory = path.join(dataDirectory, "uploads");
let database: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (database) return database;
  mkdirSync(uploadsDirectory, { recursive: true });
  const databasePath = path.join(dataDirectory, "saranote.db");
  const instance = new Database(databasePath);
  chmodSync(databasePath, 0o600);
  instance.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  instance.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('manager', 'employee')),
    access_role TEXT NOT NULL DEFAULT 'team_member',
    team TEXT,
    spoken_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by INTEGER NOT NULL REFERENCES users(id),
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    held_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    transcript TEXT NOT NULL DEFAULT '',
    team TEXT,
    audience TEXT NOT NULL DEFAULT 'all_team',
    audience_user_id INTEGER,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    assignee_id INTEGER NOT NULL REFERENCES users(id),
    due_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'approved', 'rejected')),
    submission_text TEXT NOT NULL DEFAULT '',
    review_note TEXT NOT NULL DEFAULT '',
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS meeting_access_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    team TEXT NOT NULL,
    audience TEXT NOT NULL,
    audience_user_id INTEGER REFERENCES users(id),
    UNIQUE(meeting_id, team)
  );
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('audio', 'document', 'submission')),
    size INTEGER NOT NULL,
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id, status);
  CREATE INDEX IF NOT EXISTS idx_files_meeting ON files(meeting_id);
`);
  const userColumnNames = new Set(
    (instance.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>).map((column) => column.name),
  );
  if (!userColumnNames.has("access_role")) instance.exec("ALTER TABLE users ADD COLUMN access_role TEXT NOT NULL DEFAULT 'team_member'");
  if (!userColumnNames.has("team")) instance.exec("ALTER TABLE users ADD COLUMN team TEXT");
  if (!userColumnNames.has("spoken_name")) instance.exec("ALTER TABLE users ADD COLUMN spoken_name TEXT NOT NULL DEFAULT ''");
  const meetingColumnNames = new Set(
    (instance.prepare("PRAGMA table_info(meetings)").all() as Array<{ name: string }>).map((column) => column.name),
  );
  if (!meetingColumnNames.has("team")) instance.exec("ALTER TABLE meetings ADD COLUMN team TEXT");
  if (!meetingColumnNames.has("audience")) instance.exec("ALTER TABLE meetings ADD COLUMN audience TEXT NOT NULL DEFAULT 'all_team'");
  if (!meetingColumnNames.has("audience_user_id")) instance.exec("ALTER TABLE meetings ADD COLUMN audience_user_id INTEGER");
  if (!meetingColumnNames.has("extracted_actions")) instance.exec("ALTER TABLE meetings ADD COLUMN extracted_actions TEXT NOT NULL DEFAULT '[]'");
  if (!meetingColumnNames.has("processing_status")) instance.exec("ALTER TABLE meetings ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'idle'");
  if (!meetingColumnNames.has("processing_error")) instance.exec("ALTER TABLE meetings ADD COLUMN processing_error TEXT NOT NULL DEFAULT ''");
  if (!meetingColumnNames.has("summary_json")) instance.exec("ALTER TABLE meetings ADD COLUMN summary_json TEXT NOT NULL DEFAULT '{}'");
  instance.exec(`
    INSERT OR IGNORE INTO meeting_access_rules (meeting_id, team, audience, audience_user_id)
    SELECT id, team, audience, audience_user_id FROM meetings WHERE team IS NOT NULL
  `);
  instance.exec("UPDATE users SET access_role = 'manager', team = NULL WHERE role = 'manager'");
  database = instance;
  return instance;
}

function prepare(sql: string) {
  return getDatabase().prepare(sql);
}

const userColumns = `id, name, email, spoken_name AS spokenName, access_role AS role, team, created_at AS createdAt`;
const taskColumns = `
  t.id, t.meeting_id AS meetingId, m.title AS meetingTitle, m.team, m.audience, m.audience_user_id AS audienceUserId,
  t.title, t.description, t.assignee_id AS assigneeId, u.name AS assigneeName, u.team AS assigneeTeam,
  t.due_at AS dueAt, t.status, t.submission_text AS submissionText,
  t.review_note AS reviewNote, t.created_at AS createdAt, t.updated_at AS updatedAt,
  f.id AS submissionFileId, f.original_name AS submissionFileName
`;

export function hasUsers(): boolean {
  return Number((prepare("SELECT COUNT(*) AS count FROM users").get() as { count: number }).count) > 0;
}

export function createUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  team: SpecialtyTeam | null;
  spokenName?: string;
}): number {
  const legacyRole = input.role === "manager" ? "manager" : "employee";
  const result = prepare(
    "INSERT INTO users (name, email, password_hash, role, access_role, team, spoken_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    input.name,
    input.email.toLowerCase(),
    input.passwordHash,
    legacyRole,
    input.role,
    input.role === "manager" ? null : input.team,
    input.spokenName ?? "",
    new Date().toISOString(),
  );
  return Number(result.lastInsertRowid);
}

export function findUserCredentials(email: string): (User & { passwordHash: string }) | undefined {
  return prepare(`SELECT ${userColumns}, password_hash AS passwordHash FROM users WHERE email = ?`).get(
    email.toLowerCase(),
  ) as (User & { passwordHash: string }) | undefined;
}

export function getUser(id: number): User | undefined {
  return prepare(`SELECT ${userColumns} FROM users WHERE id = ?`).get(id) as User | undefined;
}

export function listUsers(team?: SpecialtyTeam): User[] {
  if (team) {
    return prepare(`SELECT ${userColumns} FROM users WHERE team = ? ORDER BY name COLLATE NOCASE`).all(team) as User[];
  }
  return prepare(`SELECT ${userColumns} FROM users ORDER BY name COLLATE NOCASE`).all() as User[];
}

export function updateUserAccess(id: number, role: UserRole, team: SpecialtyTeam | null, spokenName: string): void {
  prepare("UPDATE users SET role = ?, access_role = ?, team = ?, spoken_name = ? WHERE id = ?").run(
    role === "manager" ? "manager" : "employee",
    role,
    role === "manager" ? null : team,
    spokenName,
    id,
  );
  refreshDetectedActionOwners();
}

export function getSetting(key: string): string | undefined {
  return (prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined)?.value;
}

export function setSetting(key: string, value: string, updatedBy: number): void {
  prepare(
    `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  ).run(key, value, updatedBy, new Date().toISOString());
}

export function deleteSetting(key: string): void {
  prepare("DELETE FROM app_settings WHERE key = ?").run(key);
}

export function createSession(tokenHash: string, userId: number, expiresAt: string): void {
  prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    tokenHash,
    userId,
    expiresAt,
  );
}

export function deleteSession(tokenHash: string): void {
  prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
}

export function findSessionUser(tokenHash: string): User | undefined {
  return prepare(
    `SELECT ${userColumns} FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  ).get(tokenHash, new Date().toISOString()) as User | undefined;
}

function meetingAccessRules(meetingId: number): MeetingAccessRule[] {
  return prepare(
    `SELECT r.team, r.audience, r.audience_user_id AS audienceUserId, u.name AS audienceUserName
     FROM meeting_access_rules r LEFT JOIN users u ON u.id = r.audience_user_id
     WHERE r.meeting_id = ? ORDER BY r.id`,
  ).all(meetingId) as MeetingAccessRule[];
}

type StoredMeeting = Omit<Meeting, "accessRules" | "extractedActions" | "summary"> & { extractedActionsJson: string; summaryJson: string };

function hydrateMeeting(row: StoredMeeting): Meeting {
  const { extractedActionsJson, summaryJson, ...meeting } = row;
  let extractedActions: DetectedAction[] = [];
  let summary: MeetingSummary = { decisions: [], risks: [], important_points: [], follow_ups: [] };
  try {
    const parsed = JSON.parse(extractedActionsJson);
    if (Array.isArray(parsed)) extractedActions = parsed as DetectedAction[];
  } catch {}
  try {
    const parsed = JSON.parse(summaryJson) as Partial<MeetingSummary>;
    summary = {
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      important_points: Array.isArray(parsed.important_points) ? parsed.important_points : [],
      follow_ups: Array.isArray(parsed.follow_ups) ? parsed.follow_ups : [],
    };
  } catch {}
  return { ...meeting, accessRules: meetingAccessRules(row.id), extractedActions, summary };
}

export function createMeeting(input: {
  title: string;
  heldAt: string;
  accessRules: MeetingAccessRule[];
  createdBy: number;
}): number {
  const now = new Date().toISOString();
  return getDatabase().transaction(() => {
    const primary = input.accessRules[0];
    const result = prepare(
      "INSERT INTO meetings (title, held_at, team, audience, audience_user_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(input.title, input.heldAt, primary.team, primary.audience, primary.audienceUserId, input.createdBy, now);
    const meetingId = Number(result.lastInsertRowid);
    const insertRule = prepare(
      "INSERT INTO meeting_access_rules (meeting_id, team, audience, audience_user_id) VALUES (?, ?, ?, ?)",
    );
    for (const rule of input.accessRules) insertRule.run(meetingId, rule.team, rule.audience, rule.audienceUserId);
    return meetingId;
  })();
}

export function listMeetings(viewer: Pick<User, "id" | "role" | "team">, search = ""): Meeting[] {
  const pattern = `%${search.trim()}%`;
  const sql =
    `SELECT m.id, m.title, m.held_at AS heldAt, m.status, m.transcript,
      m.team, m.audience, m.audience_user_id AS audienceUserId, au.name AS audienceUserName,
      m.extracted_actions AS extractedActionsJson, m.processing_status AS processingStatus,
      m.processing_error AS processingError, m.summary_json AS summaryJson,
      m.created_at AS createdAt, u.name AS createdByName,
      COUNT(DISTINCT f.id) AS fileCount, COUNT(DISTINCT t.id) AS taskCount
     FROM meetings m JOIN users u ON u.id = m.created_by
     LEFT JOIN users au ON au.id = m.audience_user_id
     LEFT JOIN files f ON f.meeting_id = m.id
     LEFT JOIN tasks t ON t.meeting_id = m.id
     WHERE (m.title LIKE ? OR m.transcript LIKE ?)`;
  const meetings = (prepare(`${sql} GROUP BY m.id ORDER BY m.held_at DESC, m.id DESC`).all(pattern, pattern) as StoredMeeting[]).map(hydrateMeeting);
  return viewer.role === "manager"
    ? meetings
    : meetings.filter((meeting) => canAccessMeeting(viewer.role, viewer.team, viewer.id, meeting.accessRules));
}

export function getMeeting(id: number): Meeting | undefined {
  const row = prepare(
    `SELECT m.id, m.title, m.held_at AS heldAt, m.status, m.transcript,
      m.team, m.audience, m.audience_user_id AS audienceUserId, au.name AS audienceUserName,
      m.extracted_actions AS extractedActionsJson, m.processing_status AS processingStatus,
      m.processing_error AS processingError, m.summary_json AS summaryJson,
      m.created_at AS createdAt, u.name AS createdByName,
      COUNT(DISTINCT f.id) AS fileCount, COUNT(DISTINCT t.id) AS taskCount
     FROM meetings m JOIN users u ON u.id = m.created_by
     LEFT JOIN users au ON au.id = m.audience_user_id
     LEFT JOIN files f ON f.meeting_id = m.id
     LEFT JOIN tasks t ON t.meeting_id = m.id
     WHERE m.id = ? GROUP BY m.id`,
  ).get(id) as StoredMeeting | undefined;
  return row ? hydrateMeeting(row) : undefined;
}

export function updateMeetingTranscript(id: number, transcript: string): void {
  prepare("UPDATE meetings SET transcript = ? WHERE id = ?").run(transcript, id);
}

export function startMeetingProcessing(id: number): void {
  prepare("UPDATE meetings SET processing_status = 'processing', processing_error = '' WHERE id = ?").run(id);
}

export function finishMeetingProcessing(id: number, transcript: string, actions: DetectedAction[], summary: MeetingSummary, createdBy: number): number {
  const resolvedActions = resolveActionOwners(actions);
  return getDatabase().transaction(() => {
    prepare(
      "UPDATE meetings SET transcript = ?, extracted_actions = ?, summary_json = ?, processing_status = 'completed', processing_error = '' WHERE id = ?",
    ).run(transcript, JSON.stringify(resolvedActions), JSON.stringify(summary), id);
    const meeting = getMeeting(id);
    const creator = getUser(createdBy);
    if (!meeting || !creator) return 0;
    let assigned = 0;
    const insert = prepare(
      `INSERT INTO tasks (meeting_id, title, description, assignee_id, due_at, created_by, created_at, updated_at)
       SELECT ?, ?, ?, ?, NULL, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE meeting_id = ? AND title = ? AND assignee_id = ?)`,
    );
    for (const action of resolvedActions) {
      const owner = action.ownerUserId ? getUser(action.ownerUserId) : undefined;
      if (!owner || !canManageTeam(creator.role, creator.team, owner.team) || !isMeetingParticipant(owner.role, owner.team, owner.id, meeting.accessRules)) continue;
      const now = new Date().toISOString();
      const result = insert.run(id, action.task, action.evidence.text, owner.id, createdBy, now, now, id, action.task, owner.id);
      assigned += result.changes;
    }
    return assigned;
  })();
}

function resolveActionOwners(actions: DetectedAction[]): DetectedAction[] {
  const users = listUsers();
  return actions.map((action) => {
    const detectedOwner = action.detectedOwner ?? action.owner;
    const owner = resolveSpokenOwner(detectedOwner, users);
    return owner
      ? { ...action, detectedOwner, owner: owner.name, ownerUserId: owner.id }
      : { ...action, detectedOwner, owner: detectedOwner, ownerUserId: undefined };
  });
}

function refreshDetectedActionOwners(): void {
  const rows = prepare("SELECT id, extracted_actions AS actions FROM meetings WHERE extracted_actions != '[]'").all() as Array<{ id: number; actions: string }>;
  const update = prepare("UPDATE meetings SET extracted_actions = ? WHERE id = ?");
  for (const row of rows) {
    try {
      update.run(JSON.stringify(resolveActionOwners(JSON.parse(row.actions) as DetectedAction[])), row.id);
    } catch {}
  }
}

export function failMeetingProcessing(id: number, error: string): void {
  prepare("UPDATE meetings SET processing_status = 'failed', processing_error = ? WHERE id = ?").run(error, id);
}

export function updateMeetingTeam(id: number, team: SpecialtyTeam): void {
  getDatabase().transaction(() => {
    prepare("UPDATE meetings SET team = ?, audience = 'all_team', audience_user_id = NULL WHERE id = ?").run(team, id);
    prepare("DELETE FROM meeting_access_rules WHERE meeting_id = ?").run(id);
    prepare("INSERT INTO meeting_access_rules (meeting_id, team, audience) VALUES (?, ?, 'all_team')").run(id, team);
  })();
}

export function addFile(input: Omit<StoredFile, "id" | "createdAt" | "uploadedByName"> & { uploadedBy: number }): number {
  const result = prepare(
    `INSERT INTO files (meeting_id, task_id, original_name, stored_name, mime_type, kind, size, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.meetingId,
    input.taskId,
    input.originalName,
    input.storedName,
    input.mimeType,
    input.kind,
    input.size,
    input.uploadedBy,
    new Date().toISOString(),
  );
  return Number(result.lastInsertRowid);
}

export function listMeetingFiles(meetingId: number): StoredFile[] {
  return prepare(
    `SELECT f.id, f.meeting_id AS meetingId, f.task_id AS taskId, f.original_name AS originalName,
      f.stored_name AS storedName, f.mime_type AS mimeType, f.kind, f.size,
      f.created_at AS createdAt, u.name AS uploadedByName
     FROM files f JOIN users u ON u.id = f.uploaded_by
     WHERE f.meeting_id = ? AND f.kind != 'submission' ORDER BY f.created_at DESC`,
  ).all(meetingId) as StoredFile[];
}

export function getStoredFile(id: number): StoredFile | undefined {
  return prepare(
    `SELECT f.id, f.meeting_id AS meetingId, f.task_id AS taskId, f.original_name AS originalName,
      f.stored_name AS storedName, f.mime_type AS mimeType, f.kind, f.size,
      f.created_at AS createdAt, u.name AS uploadedByName
     FROM files f JOIN users u ON u.id = f.uploaded_by WHERE f.id = ?`,
  ).get(id) as StoredFile | undefined;
}

export function createTask(input: {
  meetingId: number;
  title: string;
  description: string;
  assigneeId: number;
  dueAt: string | null;
  createdBy: number;
}): number {
  const now = new Date().toISOString();
  const result = prepare(
    `INSERT INTO tasks (meeting_id, title, description, assignee_id, due_at, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(input.meetingId, input.title, input.description, input.assigneeId, input.dueAt, input.createdBy, now, now);
  return Number(result.lastInsertRowid);
}

export function updateTask(id: number, input: { title: string; description: string; assigneeId: number; dueAt: string | null }): void {
  prepare(
    "UPDATE tasks SET title = ?, description = ?, assignee_id = ?, due_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
  ).run(input.title, input.description, input.assigneeId, input.dueAt, new Date().toISOString(), id);
}

export function deleteTask(id: number): void {
  prepare("DELETE FROM tasks WHERE id = ? AND status = 'pending'").run(id);
}

export function getTask(id: number): Task | undefined {
  return prepare(
    `SELECT ${taskColumns} FROM tasks t
     JOIN meetings m ON m.id = t.meeting_id JOIN users u ON u.id = t.assignee_id
     LEFT JOIN files f ON f.id = (SELECT id FROM files WHERE task_id = t.id AND kind = 'submission' ORDER BY id DESC LIMIT 1)
     WHERE t.id = ?`,
  ).get(id) as Task | undefined;
}

export function listMeetingTasks(meetingId: number): Task[] {
  return prepare(
    `SELECT ${taskColumns} FROM tasks t
     JOIN meetings m ON m.id = t.meeting_id JOIN users u ON u.id = t.assignee_id
     LEFT JOIN files f ON f.id = (SELECT id FROM files WHERE task_id = t.id AND kind = 'submission' ORDER BY id DESC LIMIT 1)
     WHERE t.meeting_id = ? ORDER BY t.created_at DESC`,
  ).all(meetingId) as Task[];
}

export function listUserTasks(user: Pick<User, "id" | "role" | "team">): Task[] {
  const sql = `SELECT ${taskColumns} FROM tasks t
     JOIN meetings m ON m.id = t.meeting_id JOIN users u ON u.id = t.assignee_id
     LEFT JOIN files f ON f.id = (SELECT id FROM files WHERE task_id = t.id AND kind = 'submission' ORDER BY id DESC LIMIT 1)
     WHERE t.assignee_id = ?`;
  const order = " ORDER BY CASE t.status WHEN 'rejected' THEN 0 WHEN 'pending' THEN 1 WHEN 'submitted' THEN 2 ELSE 3 END, t.due_at";
  return prepare(`${sql}${order}`).all(user.id) as Task[];
}

export function listTasksForReview(viewer: Pick<User, "id" | "role" | "team">): Task[] {
  const sql =
    `SELECT ${taskColumns} FROM tasks t
     JOIN meetings m ON m.id = t.meeting_id JOIN users u ON u.id = t.assignee_id
     LEFT JOIN files f ON f.id = (SELECT id FROM files WHERE task_id = t.id AND kind = 'submission' ORDER BY id DESC LIMIT 1)
     WHERE t.status = 'submitted'`;
  if (viewer.role !== "manager") {
    if (!viewer.team) return [];
    const tasks = prepare(`${sql} AND u.team = ? ORDER BY t.updated_at`).all(viewer.team) as Task[];
    return tasks.filter((task) => canAccessMeeting(viewer.role, viewer.team, viewer.id, getMeeting(task.meetingId)?.accessRules ?? []));
  }
  return prepare(`${sql} ORDER BY t.updated_at`).all() as Task[];
}

export function submitTask(id: number, submissionText: string): void {
  prepare(
    "UPDATE tasks SET submission_text = ?, status = 'submitted', review_note = '', updated_at = ? WHERE id = ?",
  ).run(submissionText, new Date().toISOString(), id);
}

export function reviewTask(id: number, status: "approved" | "rejected", note: string): void {
  prepare("UPDATE tasks SET status = ?, review_note = ?, updated_at = ? WHERE id = ?").run(
    status,
    note,
    new Date().toISOString(),
    id,
  );
}

export function dashboardCounts(user: Pick<User, "id" | "role" | "team">): {
  meetings: number;
  myOpenTasks: number;
  reviewQueue: number;
} {
  const meetings = listMeetings(user).length;
  const myOpenTasks = (prepare("SELECT COUNT(*) AS count FROM tasks WHERE assignee_id = ? AND status != 'approved'").get(user.id) as { count: number }).count;
  const reviewQueue = user.role === "team_member" ? 0 : listTasksForReview(user).length;
  return { meetings, myOpenTasks, reviewQueue };
}
