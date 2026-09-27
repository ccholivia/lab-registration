import { adminHtml } from "./admin-html";
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_EMAILS: string;
}
type AccessIdentity = { email?: string };
type AccessContext = ExecutionContext & { access?: { getIdentity(): Promise<AccessIdentity | null> } };
type Entry = { fullName: string; matrixNumber: string; classGroup: string; whatsapp: string; slot: string };

const starting: Record<string, number> = { monday1: 14, monday2: 28, monday3: 37, monday4: 25, online: 0 };
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const error = (message: string, status: number) => reply({ error: message }, status);
function parse(input: unknown): Entry | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  const fullName = String(raw.fullName ?? '').trim().replace(/\s+/g, ' ');
  const matrixNumber = String(raw.matrixNumber ?? '').trim().toUpperCase();
  const classGroup = String(raw.classGroup ?? '').trim();
  const whatsapp = String(raw.whatsapp ?? '').trim();
  const slot = String(raw.slot ?? '');
  if (!fullName || fullName.length > 120 || !matrixNumber || matrixNumber.length > 40 ||
      !classGroup || classGroup.length > 60 || !/^\+?[0-9\s()-]{8,20}$/.test(whatsapp) ||
      !Object.hasOwn(starting, slot)) return null;
  return { fullName, matrixNumber, classGroup, whatsapp, slot };
}
async function body(request: Request) {
  try { return parse(await request.json()); } catch { return null; }
}
function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  return !!origin && origin === new URL(request.url).origin;
}
async function adminAllowed(env: Env, ctx: AccessContext) {
  if (!ctx.access || !env.ADMIN_EMAILS) return false;
  const identity = await ctx.access.getIdentity();
  const email = identity?.email?.trim().toLowerCase();
  return !!email && env.ADMIN_EMAILS.split(',').some(item => item.trim().toLowerCase() === email);
}
function idFrom(path: string) {
  const match = path.match(/^\/admin\/api\/registrations\/(\d+)$/);
  const id = match ? Number(match[1]) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
async function counts(env: Env) {
  const rows = await env.DB.prepare('SELECT slot, COUNT(*) AS total FROM registrations GROUP BY slot').all<{slot: string; total: number}>();
  return Object.fromEntries(rows.results.map(row => [row.slot, row.total]));
}
async function register(request: Request, env: Env) {
  if (!sameOrigin(request)) return error('Invalid request origin.', 403);
  const entry = await body(request);
  if (!entry) return error('Please complete every field with valid details.', 400);
  try {
    const limit = entry.slot === 'online' ? null : 40 - starting[entry.slot];
    const result = await env.DB.prepare(`INSERT INTO registrations (full_name,matrix_number,class_group,whatsapp,slot,created_at)
      SELECT ?,?,?,?,?,datetime('now') WHERE ? IS NULL OR
      (SELECT COUNT(*) FROM registrations WHERE slot = ?) < ?`)
      .bind(entry.fullName, entry.matrixNumber, entry.classGroup, entry.whatsapp, entry.slot, limit, entry.slot, limit).run();
    if (!result.meta.changes) return error('This slot has just filled up. Please choose another.', 409);
    return reply({ ok: true, slot: entry.slot });
  } catch (cause) {
    if (String(cause).includes('UNIQUE')) return error('This matrix number is already registered. Contact your lecturer to change your slot.', 409);
    console.error('Registration failure', cause);
    return error('Registration could not be saved. Please try again.', 503);
  }
}
async function list(env: Env) {
  const rows = await env.DB.prepare(`SELECT id, full_name AS fullName, matrix_number AS matrixNumber,
    class_group AS classGroup, whatsapp, slot, created_at AS createdAt
    FROM registrations ORDER BY id DESC`).all();
  return reply({ registrations: rows.results });
}
async function update(request: Request, env: Env, id: number) {
  const entry = await body(request);
  if (!entry) return error('Check all fields and try again.', 400);
  try {
    const limit = entry.slot === 'online' ? null : 40 - starting[entry.slot];
    const result = await env.DB.prepare(`UPDATE registrations SET full_name=?,matrix_number=?,class_group=?,whatsapp=?,slot=?
      WHERE id=? AND (slot=? OR ? IS NULL OR (SELECT COUNT(*) FROM registrations WHERE slot=?) < ?)`)
      .bind(entry.fullName,entry.matrixNumber,entry.classGroup,entry.whatsapp,entry.slot,id,entry.slot,limit,entry.slot,limit).run();
    if (!result.meta.changes) return error('Registration not found or the selected slot is full.', 409);
    return reply({ ok: true });
  } catch (cause) {
    if (String(cause).includes('UNIQUE')) return error('Another student already has that matrix number.', 409);
    console.error('Admin update failure', cause);
    return error('Could not save changes.', 503);
  }
}
async function remove(env: Env, id: number) {
  const result = await env.DB.prepare('DELETE FROM registrations WHERE id=?').bind(id).run();
  if (!result.meta.changes) return error('Registration not found.', 404);
  return reply({ ok: true });
}
export default {
  async fetch(request: Request, env: Env, ctx: AccessContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    try {
      if (pathname === '/api/slots' && request.method === 'GET') return reply({ counts: await counts(env) });
      if (pathname === '/api/register' && request.method === 'POST') return register(request, env);
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        if (!(await adminAllowed(env,ctx))) return error('Lecturer access required. Configure Cloudflare Access and ADMIN_EMAILS.', 403);
        if (pathname === '/admin' && request.method === 'GET') {
          return new Response(adminHtml, { headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' } });
        }
        const id = idFrom(pathname);
        if (pathname === '/admin/api/registrations' && request.method === 'GET') return list(env);
        if (id && (request.method === 'PUT' || request.method === 'DELETE')) {
          if (!sameOrigin(request)) return error('Invalid request origin.',403);
          return request.method === 'PUT' ? update(request,env,id) : remove(env,id);
        }
        return error('Not found.',404);
      }
      if (pathname === '/admin.html') return error('Not found.',404);
      if (pathname === '/api/slots' || pathname === '/api/register' || pathname.startsWith('/api/')) return error('Not found.',404);
      if (request.method !== 'GET' && request.method !== 'HEAD') return error('Method not allowed.',405);
      return env.ASSETS.fetch(request);
    } catch (cause) {
      console.error('Request failure',cause);
      return error('The service is temporarily unavailable. Please try again.',503);
    }
  }
} satisfies ExportedHandler<Env>;
