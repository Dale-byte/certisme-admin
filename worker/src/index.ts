/**
 * CertiSME Admin API — Cloudflare Worker
 *
 * A single-admin backend for the CertiSME Admin dashboard. It stores everything
 * in your storefront GitHub repository: catalog.yaml (products + frameworks),
 * documents, product images and site settings. Every write is a commit, which
 * is what the dashboard's Audit Log shows.
 */
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export interface Env {
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  CATALOG_PATH: string;
  DOCUMENTS_DIR: string;
  IMAGES_DIR: string;
  DEPLOY_WORKFLOW: string;
  ALLOWED_ORIGINS: string;
  ADMIN_USERNAME: string;
  GITHUB_TOKEN: string;
  SESSION_SECRET: string;
  ADMIN_PASSWORD_HASH: string;
  MERCHANT_ID?: string;
  MERCHANT_KEY?: string;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const DOC_EXT = ["docx", "xlsx", "pdf"];
const IMG_EXT = ["png", "jpg", "jpeg", "webp"];
const MAX_DOC = 25 * 1024 * 1024;
const MAX_IMG = 5 * 1024 * 1024;

/* ------------------------------------------------------------------ utils */

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function corsHeaders(env: Env, request: Request): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  const origin = request.headers.get("Origin") ?? "";
  const allow = allowed.includes(origin) ? origin : (allowed[0] ?? "*");
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const s = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

/** Signed, stateless session token: base64url(payload).base64url(hmac) */
async function createToken(env: Env, user: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ sub: user, exp: Date.now() + SESSION_TTL_MS })));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET), enc.encode(payload));
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}

async function requireAuth(env: Env, request: Request): Promise<{ email: string }> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Sign in to continue.");

  const [payload, sig] = token.split(".");
  if (!payload || !sig) throw new HttpError(401, "Your session is invalid. Please sign in again.");

  const expected = b64url(
    new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET), enc.encode(payload))),
  );
  if (!timingSafeEqual(sig, expected)) throw new HttpError(401, "Your session is invalid. Please sign in again.");

  let data: { sub?: string; exp?: number };
  try {
    data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  } catch {
    throw new HttpError(401, "Your session is invalid. Please sign in again.");
  }
  if (!data.exp || data.exp < Date.now()) throw new HttpError(401, "Your session expired. Please sign in again.");
  return { email: data.sub ?? env.ADMIN_USERNAME };
}

/* ----------------------------------------------------------------- github */

const GH = "https://api.github.com";

async function gh(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${GH}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "certisme-admin-api",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
  return res;
}

async function ghJson<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const res = await gh(env, path, init);
  if (!res.ok) {
    const body = await res.text();
    console.error(`GitHub ${init.method ?? "GET"} ${path} failed [${res.status}]: ${body}`);
    if (res.status === 401 || res.status === 403) {
      throw new HttpError(502, "The GitHub token is missing permissions or has expired.");
    }
    if (res.status === 404) throw new HttpError(404, "That file or repository could not be found on GitHub.");
    if (res.status === 409) throw new HttpError(409, "The repository changed while saving. Please try again.");
    throw new HttpError(502, "GitHub rejected the request. Please try again.");
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

function repoPath(env: Env, file: string) {
  return `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${file}?ref=${env.GITHUB_BRANCH}`;
}

interface ContentFile {
  content?: string;
  sha: string;
  size: number;
  path: string;
}

async function readFile(env: Env, file: string): Promise<{ text: string; sha: string } | null> {
  const res = await gh(env, repoPath(env, file));
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error(`GitHub read ${file} failed [${res.status}]: ${await res.text()}`);
    throw new HttpError(502, "Could not read the storefront repository.");
  }
  const data = (await res.json()) as ContentFile;
  const bytes = fromB64url((data.content ?? "").replace(/\n/g, "").replace(/\+/g, "-").replace(/\//g, "_"));
  return { text: new TextDecoder().decode(bytes), sha: data.sha };
}

async function writeFile(
  env: Env,
  file: string,
  bytes: Uint8Array,
  message: string,
  author: string,
): Promise<{ commitUrl: string; sha: string }> {
  const existing = await gh(env, repoPath(env, file));
  const sha = existing.ok ? ((await existing.json()) as ContentFile).sha : undefined;

  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);

  const result = await ghJson<{ commit: { html_url: string; sha: string } }>(
    env,
    `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${file}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: `${message}\n\nvia CertiSME Admin (${author})`,
        content: btoa(binary),
        branch: env.GITHUB_BRANCH,
        ...(sha ? { sha } : {}),
      }),
    },
  );
  return { commitUrl: result.commit.html_url, sha: result.commit.sha };
}

/* ---------------------------------------------------------------- catalog */

interface Framework {
  id: string;
  name: string;
  full_name?: string;
  description?: string;
  color?: string;
}

interface Product {
  id: string;
  framework: string;
  name: string;
  description?: string;
  format: string;
  file_name?: string;
  price: number;
  includes?: string[];
}

interface Catalog {
  site?: Record<string, unknown>;
  frameworks?: Framework[];
  products?: Product[];
  [key: string]: unknown;
}

async function loadCatalog(env: Env): Promise<Catalog> {
  const file = await readFile(env, env.CATALOG_PATH);
  if (!file) return { frameworks: [], products: [] };
  const parsed = (parseYaml(file.text) ?? {}) as Catalog;
  parsed.frameworks ??= [];
  parsed.products ??= [];
  return parsed;
}

async function saveCatalog(env: Env, catalog: Catalog, message: string, author: string) {
  return writeFile(env, env.CATALOG_PATH, enc.encode(stringifyYaml(catalog)), message, author);
}

function requireFields<T extends Record<string, unknown>>(body: T, fields: string[]) {
  for (const f of fields) {
    const v = body[f];
    if (v === undefined || v === null || v === "") throw new HttpError(400, `"${f}" is required.`);
  }
}

function slugOk(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

async function readBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "The request body was not valid JSON.");
  }
}

/* ----------------------------------------------------------------- routes */

async function handle(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();
  const seg = path.split("/").filter(Boolean);

  /* auth */
  if (path === "/auth/login" && method === "POST") {
    const body = await readBody<{ username?: string; password?: string }>(request);
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";
    if (!username || !password) throw new HttpError(400, "Enter your username and password.");
    const hash = await sha256Hex(password);
    const ok =
      timingSafeEqual(username.toLowerCase(), env.ADMIN_USERNAME.toLowerCase()) &&
      timingSafeEqual(hash, env.ADMIN_PASSWORD_HASH.trim().toLowerCase());
    if (!ok) throw new HttpError(401, "That username or password is not correct.");
    return json({ token: await createToken(env, username), user: { email: username, name: "Administrator" } });
  }

  const session = await requireAuth(env, request);

  if (path === "/auth/me" && method === "GET") {
    return json({ email: session.email, name: "Administrator", authorized: true });
  }

  /* frameworks */
  if (path === "/frameworks" && method === "GET") {
    return json((await loadCatalog(env)).frameworks);
  }
  if (path === "/frameworks" && method === "POST") {
    const body = await readBody<Framework>(request);
    requireFields(body as never, ["id", "name"]);
    if (!slugOk(body.id)) throw new HttpError(400, "The framework id must be lowercase words joined by hyphens.");
    const catalog = await loadCatalog(env);
    if (catalog.frameworks!.some((f) => f.id === body.id)) {
      throw new HttpError(409, `A framework with the id "${body.id}" already exists.`);
    }
    catalog.frameworks!.push(body);
    await saveCatalog(env, catalog, `Add framework ${body.id}`, session.email);
    return json(catalog.frameworks);
  }
  if (seg[0] === "frameworks" && seg.length === 2 && (method === "PUT" || method === "DELETE")) {
    const id = decodeURIComponent(seg[1]!);
    const catalog = await loadCatalog(env);
    const index = catalog.frameworks!.findIndex((f) => f.id === id);
    if (index === -1) throw new HttpError(404, `No framework with the id "${id}".`);
    if (method === "DELETE") {
      if (catalog.products!.some((p) => p.framework === id)) {
        throw new HttpError(409, "Remove or reassign the products using this framework first.");
      }
      catalog.frameworks!.splice(index, 1);
      await saveCatalog(env, catalog, `Delete framework ${id}`, session.email);
    } else {
      const body = await readBody<Framework>(request);
      catalog.frameworks![index] = { ...catalog.frameworks![index]!, ...body, id };
      await saveCatalog(env, catalog, `Update framework ${id}`, session.email);
    }
    return json(catalog.frameworks);
  }

  /* products */
  if (path === "/products" && method === "GET") {
    return json((await loadCatalog(env)).products);
  }
  if (path === "/products" && method === "POST") {
    const body = await readBody<Product>(request);
    requireFields(body as never, ["id", "name", "framework", "format", "price"]);
    if (!slugOk(body.id)) throw new HttpError(400, "The product id must be lowercase words joined by hyphens.");
    const catalog = await loadCatalog(env);
    if (catalog.products!.some((p) => p.id === body.id)) {
      throw new HttpError(409, `A product with the id "${body.id}" already exists.`);
    }
    if (!catalog.frameworks!.some((f) => f.id === body.framework)) {
      throw new HttpError(400, `Unknown framework "${body.framework}".`);
    }
    catalog.products!.push({ ...body, price: Number(body.price) });
    await saveCatalog(env, catalog, `Add product ${body.id}`, session.email);
    return json(catalog.products);
  }
  if (seg[0] === "products" && seg.length === 2 && (method === "PUT" || method === "DELETE")) {
    const id = decodeURIComponent(seg[1]!);
    const catalog = await loadCatalog(env);
    const index = catalog.products!.findIndex((p) => p.id === id);
    if (index === -1) throw new HttpError(404, `No product with the id "${id}".`);
    if (method === "DELETE") {
      catalog.products!.splice(index, 1);
      await saveCatalog(env, catalog, `Delete product ${id}`, session.email);
    } else {
      const body = await readBody<Product>(request);
      catalog.products![index] = { ...catalog.products![index]!, ...body, id, price: Number(body.price) };
      await saveCatalog(env, catalog, `Update product ${id}`, session.email);
    }
    return json(catalog.products);
  }

  /* documents */
  if (path === "/documents" && method === "GET") {
    const catalog = await loadCatalog(env);
    const listing = await gh(env, repoPath(env, env.DOCUMENTS_DIR));
    const files: ContentFile[] = listing.ok ? ((await listing.json()) as ContentFile[]) : [];
    const byName = new Map(files.map((f) => [f.path.split("/").pop()!, f]));
    return json(
      catalog.products!.map((product) => {
        const match = [...byName.entries()].find(([name]) => name.startsWith(`${product.id}.`));
        return {
          product_id: product.id,
          product_name: product.name,
          file_name: match?.[0] ?? null,
          size: match?.[1].size ?? null,
          uploaded: Boolean(match),
        };
      }),
    );
  }
  if (path === "/documents" && method === "POST") {
    const productId = url.searchParams.get("product") ?? url.searchParams.get("product_id") ?? "";
    if (!productId) throw new HttpError(400, "Choose a product before uploading.");
    const catalog = await loadCatalog(env);
    const product = catalog.products!.find((p) => p.id === productId);
    if (!product) throw new HttpError(404, `No product with the id "${productId}".`);

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length === 0) throw new HttpError(400, "The uploaded file was empty.");
    if (bytes.length > MAX_DOC) throw new HttpError(413, "Documents must be 25MB or smaller.");

    const type = request.headers.get("Content-Type") ?? "";
    const ext =
      (url.searchParams.get("filename")?.split(".").pop() ?? "").toLowerCase() ||
      (type.includes("wordprocessingml") ? "docx" : type.includes("spreadsheetml") ? "xlsx" : type.includes("pdf") ? "pdf" : "");
    if (!DOC_EXT.includes(ext)) throw new HttpError(400, "Only .docx, .xlsx and .pdf documents are accepted.");

    const file = `${env.DOCUMENTS_DIR}/${productId}.${ext}`;
    const commit = await writeFile(env, file, bytes, `Upload document for ${productId}`, session.email);
    return json({ product_id: productId, file_name: `${productId}.${ext}`, size: bytes.length, ...commit });
  }

  /* images */
  if (seg[0] === "images" && seg.length === 2 && method === "POST") {
    const productId = decodeURIComponent(seg[1]!);
    const catalog = await loadCatalog(env);
    if (!catalog.products!.some((p) => p.id === productId)) {
      throw new HttpError(404, `No product with the id "${productId}".`);
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length === 0) throw new HttpError(400, "The uploaded image was empty.");
    if (bytes.length > MAX_IMG) throw new HttpError(413, "Images must be 5MB or smaller.");

    const type = request.headers.get("Content-Type") ?? "";
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("jpeg") || type.includes("jpg") ? "jpg" : "";
    if (!IMG_EXT.includes(ext)) throw new HttpError(400, "Only .png, .jpg and .webp images are accepted.");

    const file = `${env.IMAGES_DIR}/${productId}.${ext}`;
    const commit = await writeFile(env, file, bytes, `Upload image for ${productId}`, session.email);
    return json({ product_id: productId, path: `/product-images/${productId}.${ext}`, size: bytes.length, ...commit });
  }

  /* settings */
  if (path === "/settings" && method === "GET") {
    const catalog = await loadCatalog(env);
    const site = (catalog.site ?? {}) as Record<string, string>;
    return json({
      site_name: site.name ?? site.site_name ?? "",
      site_url: site.url ?? site.site_url ?? "",
      contact_email: site.contact_email ?? "",
      merchant_id_set: Boolean(env.MERCHANT_ID),
      merchant_key_set: Boolean(env.MERCHANT_KEY),
    });
  }
  if (path === "/settings" && method === "PUT") {
    const body = await readBody<Record<string, string>>(request);
    const catalog = await loadCatalog(env);
    const site = ((catalog.site ??= {}) as Record<string, unknown>);
    if (body.site_name !== undefined) site.name = body.site_name;
    if (body.site_url !== undefined) site.url = body.site_url;
    if (body.contact_email !== undefined) site.contact_email = body.contact_email;
    await saveCatalog(env, catalog, "Update site settings", session.email);
    // merchant_id / merchant_key are secrets and are never stored in the repo.
    return json({
      site_name: (site.name as string) ?? "",
      site_url: (site.url as string) ?? "",
      contact_email: (site.contact_email as string) ?? "",
      merchant_id_set: Boolean(env.MERCHANT_ID),
      merchant_key_set: Boolean(env.MERCHANT_KEY),
      note: body.merchant_id || body.merchant_key
        ? "Payment credentials are stored as Worker secrets — run `wrangler secret put MERCHANT_ID` to change them."
        : undefined,
    });
  }

  /* deploy */
  if (path === "/deploy" && method === "POST") {
    const res = await gh(
      env,
      `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${env.DEPLOY_WORKFLOW}/dispatches`,
      { method: "POST", body: JSON.stringify({ ref: env.GITHUB_BRANCH }) },
    );
    if (!res.ok && res.status !== 204) {
      const body = await res.text();
      console.error(`Workflow dispatch failed [${res.status}]: ${body}`);
      throw new HttpError(502, "Could not start the publish workflow. Check the workflow name and token permissions.");
    }
    const commits = await ghJson<Array<{ sha: string; html_url: string; commit: { message: string } }>>(
      env,
      `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/commits?sha=${env.GITHUB_BRANCH}&per_page=1`,
    );
    const latest = commits[0];
    return json({
      status: "queued",
      message: "Publish started. The live site updates when the build finishes.",
      commit_url: latest?.html_url ?? null,
      commit_sha: latest?.sha ?? null,
    });
  }
  if (path === "/deploy/status" && method === "GET") {
    const runs = await ghJson<{
      workflow_runs: Array<{
        id: number;
        status: string;
        conclusion: string | null;
        html_url: string;
        created_at: string;
        updated_at: string;
        head_sha: string;
      }>;
    }>(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs?per_page=1&branch=${env.GITHUB_BRANCH}`);
    const run = runs.workflow_runs[0];
    if (!run) return json({ status: "unknown", conclusion: null, url: null });
    return json({
      status: run.status,
      conclusion: run.conclusion,
      url: run.html_url,
      run_id: run.id,
      started_at: run.created_at,
      updated_at: run.updated_at,
      commit_sha: run.head_sha,
    });
  }

  /* audit */
  if (path === "/audit" && method === "GET") {
    const commits = await ghJson<
      Array<{
        sha: string;
        html_url: string;
        commit: { message: string; author: { name: string; email: string; date: string } };
      }>
    >(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/commits?sha=${env.GITHUB_BRANCH}&per_page=50`);
    return json(
      commits.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author?.name ?? "unknown",
        date: c.commit.author?.date ?? null,
        url: c.html_url,
      })),
    );
  }

  throw new HttpError(404, "That endpoint does not exist.");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(env, request);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    try {
      const res = await handle(request, env);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status, cors);
      console.error("Unhandled error", error);
      return json({ error: "Something went wrong on the server. Please try again." }, 500, cors);
    }
  },
};
