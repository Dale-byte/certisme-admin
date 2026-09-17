/**
 * Server-only GitHub access for the CertiSME storefront repo.
 * All calls go through the Lovable connector gateway; the dashboard never
 * sees a token. Every save is a commit on the main branch, which triggers
 * the repo's deploy workflow and then Cloudflare.
 */
import { parse, stringify } from "yaml";
import { createHmac, timingSafeEqual } from "node:crypto";

const OWNER = "Dale-byte";
const REPO = "CertiSME";
const BRANCH = "main";
const CATALOG_PATH = "tools/certisme/data/catalog.yaml";
const DOCUMENTS_DIR = "tools/certisme/documents";
const IMAGES_DIR = "tools/certisme/src/product-images";
const DEPLOY_WORKFLOW = "deploy-catalog.yml";

const GATEWAY = "https://connector-gateway.lovable.dev/github";

export class AuthError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "AuthError";
  }
}

type GhOptions = { method?: string; body?: unknown; raw?: boolean };

async function gh<T>(path: string, opts: GhOptions = {}): Promise<T> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GITHUB_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("The GitHub connection is not set up yet.");
  }
  const res = await fetch(`${GATEWAY}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connectionKey,
      Accept: "application/vnd.github+json",
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : null,
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "GitHub refused the request. Reconnect the GitHub integration with repository access.",
      );
    }
    if (res.status === 404) throw new Error("not-found");
    if (res.status === 409 || res.status === 422) {
      throw new Error(
        "GitHub could not save the change — the file may have been edited elsewhere. Reload and try again.",
      );
    }
    throw new Error(`GitHub request failed (${res.status}). ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Sessions (stateless HMAC tokens, 24h) ───────────────────────────────────

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function login(username: string, password: string): { token: string; email: string } {
  const expectedUser = process.env["ADMIN_USERNAME"] ?? "";
  const expectedPass = process.env["ADMIN_PASSWORD"] ?? "";
  const secret = process.env["SESSION_SECRET"];
  if (!secret || !expectedUser || !expectedPass) {
    throw new Error("Sign-in is not configured yet. Set the admin username and password.");
  }
  const userOk =
    username.length === expectedUser.length &&
    timingSafeEqual(Buffer.from(username), Buffer.from(expectedUser));
  const passOk =
    password.length === expectedPass.length &&
    timingSafeEqual(Buffer.from(password), Buffer.from(expectedPass));
  if (!userOk || !passOk) throw new AuthError("Incorrect username or password.");

  const payload = b64url(JSON.stringify({ u: username, exp: Date.now() + SESSION_TTL_MS }));
  return { token: `${payload}.${sign(payload, secret)}`, email: username };
}

export function requireAuth(token: string | undefined): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret || !token) throw new AuthError();
  const dot = token.lastIndexOf(".");
  if (dot <= 0) throw new AuthError();
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AuthError();
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      u?: string;
      exp?: number;
    };
    if (!parsed.exp || parsed.exp < Date.now()) throw new AuthError();
    return parsed.u ?? "admin";
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError();
  }
}

// ── Catalog ─────────────────────────────────────────────────────────────────

export type RepoFramework = {
  id: string;
  name: string;
  full_name: string;
  summary?: string;
  badge?: string;
};

export type RepoProduct = {
  id: string;
  framework: string;
  name: string;
  description: string;
  format: "docx" | "xlsx" | "pdf";
  file: string;
  price: number;
  includes: string[];
};

export type Catalog = {
  site: { name: string; url: string; contact_email: string; [k: string]: unknown };
  payment?: { merchant_id?: string; merchant_key?: string; [k: string]: unknown };
  frameworks: RepoFramework[];
  products: RepoProduct[];
  [k: string]: unknown;
};

async function readCatalog(): Promise<{ catalog: Catalog; sha: string }> {
  const file = await gh<{ content?: string; sha: string }>(
    `/repos/${OWNER}/${REPO}/contents/${CATALOG_PATH}?ref=${BRANCH}`,
  );
  if (!file.content) throw new Error("The catalog file could not be read.");
  const text = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
  return { catalog: parse(text) as Catalog, sha: file.sha };
}

async function writeFile(path: string, content: Buffer, message: string): Promise<string> {
  let sha: string | undefined;
  try {
    const existing = await gh<{ sha: string }>(
      `/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    );
    sha = existing.sha;
  } catch {
    /* new file */
  }
  const res = await gh<{ commit?: { sha?: string; html_url?: string } }>(
    `/repos/${OWNER}/${REPO}/contents/${path}`,
    {
      method: "PUT",
      body: { message, content: content.toString("base64"), branch: BRANCH, ...(sha ? { sha } : {}) },
    },
  );
  return res.commit?.html_url ?? `https://github.com/${OWNER}/${REPO}`;
}

async function writeCatalog(catalog: Catalog, sha: string, message: string): Promise<string> {
  const res = await gh<{ commit?: { html_url?: string } }>(
    `/repos/${OWNER}/${REPO}/contents/${CATALOG_PATH}`,
    {
      method: "PUT",
      body: {
        message,
        content: Buffer.from(stringify(catalog), "utf8").toString("base64"),
        branch: BRANCH,
        sha,
      },
    },
  );
  return res.commit?.html_url ?? "";
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── Frameworks ──────────────────────────────────────────────────────────────

export async function listFrameworks() {
  const { catalog } = await readCatalog();
  return (catalog.frameworks ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    full_name: f.full_name,
    description: f.summary,
    color: f.badge,
  }));
}

export async function upsertFramework(
  input: { id: string; name: string; full_name: string; description?: string; color?: string },
  isNew: boolean,
) {
  if (!SLUG.test(input.id)) throw new Error("Framework ID must be lowercase letters, numbers and hyphens.");
  const { catalog, sha } = await readCatalog();
  const frameworks = catalog.frameworks ?? [];
  const idx = frameworks.findIndex((f) => f.id === input.id);
  if (isNew && idx !== -1) throw new Error(`A framework with ID "${input.id}" already exists.`);
  if (!isNew && idx === -1) throw new Error(`Framework "${input.id}" was not found.`);
  const entry: RepoFramework = {
    id: input.id,
    name: input.name,
    full_name: input.full_name,
    ...(input.description ? { summary: input.description } : {}),
    ...(input.color ? { badge: input.color } : {}),
  };
  if (idx === -1) frameworks.push(entry);
  else frameworks[idx] = entry;
  catalog.frameworks = frameworks;
  await writeCatalog(catalog, sha, `${isNew ? "Add" : "Update"} framework ${input.id}`);
  return listFrameworks();
}

export async function deleteFramework(id: string) {
  const { catalog, sha } = await readCatalog();
  if ((catalog.products ?? []).some((p) => p.framework === id)) {
    throw new Error(`Products still use the "${id}" framework. Reassign them first.`);
  }
  catalog.frameworks = (catalog.frameworks ?? []).filter((f) => f.id !== id);
  await writeCatalog(catalog, sha, `Remove framework ${id}`);
  return listFrameworks();
}

// ── Products ────────────────────────────────────────────────────────────────

export async function listProducts() {
  const { catalog } = await readCatalog();
  return catalog.products ?? [];
}

export async function upsertProduct(product: RepoProduct, isNew: boolean) {
  if (!SLUG.test(product.id)) throw new Error("Product ID must be lowercase letters, numbers and hyphens.");
  const { catalog, sha } = await readCatalog();
  if (!(catalog.frameworks ?? []).some((f) => f.id === product.framework)) {
    throw new Error(`Unknown framework "${product.framework}".`);
  }
  const products = catalog.products ?? [];
  const idx = products.findIndex((p) => p.id === product.id);
  if (isNew && idx !== -1) throw new Error(`A product with ID "${product.id}" already exists.`);
  if (!isNew && idx === -1) throw new Error(`Product "${product.id}" was not found.`);
  if (idx === -1) products.push(product);
  else products[idx] = product;
  catalog.products = products;
  await writeCatalog(catalog, sha, `${isNew ? "Add" : "Update"} product ${product.id}`);
  return listProducts();
}

export async function deleteProduct(id: string) {
  const { catalog, sha } = await readCatalog();
  catalog.products = (catalog.products ?? []).filter((p) => p.id !== id);
  await writeCatalog(catalog, sha, `Remove product ${id}`);
  return listProducts();
}

// ── Documents & images ──────────────────────────────────────────────────────

export async function listDocuments() {
  const [{ catalog }, tree] = await Promise.all([
    readCatalog(),
    gh<{ tree: { path: string; size?: number; type: string }[] }>(
      `/repos/${OWNER}/${REPO}/git/trees/${BRANCH}?recursive=1`,
    ),
  ]);
  const blobs = new Map(
    tree.tree
      .filter((t) => t.type === "blob" && t.path.startsWith(`${DOCUMENTS_DIR}/`))
      .map((t) => [t.path, t.size ?? 0]),
  );
  return (catalog.products ?? []).map((p) => {
    const path = `${DOCUMENTS_DIR}/${p.file}`;
    const present = blobs.has(path);
    return {
      product_id: p.id,
      file: p.file,
      size: present ? blobs.get(path) : undefined,
      uploaded_at: undefined,
      present,
    };
  });
}

const DOC_EXT = ["docx", "xlsx", "pdf"];
const IMG_EXT = ["png", "jpg", "jpeg", "webp"];

export async function uploadDocument(productId: string, fileName: string, data: Buffer) {
  if (data.length === 0) throw new Error("The file is empty.");
  if (data.length > 25 * 1024 * 1024) throw new Error("Documents are limited to 25 MB.");
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!DOC_EXT.includes(ext)) throw new Error("Documents must be .docx, .xlsx or .pdf.");

  const { catalog, sha } = await readCatalog();
  const product = (catalog.products ?? []).find((p) => p.id === productId);
  if (!product) throw new Error(`Product "${productId}" was not found.`);

  const dir = product.file.includes("/") ? product.file.slice(0, product.file.lastIndexOf("/")) : "";
  const newFile = `${dir ? `${dir}/` : ""}${productId}.${ext}`;
  const commitUrl = await writeFile(
    `${DOCUMENTS_DIR}/${newFile}`,
    data,
    `Upload document for ${productId}`,
  );

  if (newFile !== product.file) {
    const fresh = await readCatalog();
    const target = (fresh.catalog.products ?? []).find((p) => p.id === productId);
    if (target) {
      target.file = newFile;
      await writeCatalog(fresh.catalog, fresh.sha, `Point ${productId} at uploaded document`);
    }
  }
  return { ok: true as const, commitUrl };
}

export async function uploadImage(productId: string, fileName: string, data: Buffer) {
  if (data.length === 0) throw new Error("The file is empty.");
  if (data.length > 5 * 1024 * 1024) throw new Error("Images are limited to 5 MB.");
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (!IMG_EXT.includes(ext)) throw new Error("Images must be .png, .jpg or .webp.");
  const commitUrl = await writeFile(
    `${IMAGES_DIR}/${productId}.${ext}`,
    data,
    `Upload image for ${productId}`,
  );
  return { ok: true as const, commitUrl };
}

// ── Settings ────────────────────────────────────────────────────────────────

export async function getSettings() {
  const { catalog } = await readCatalog();
  return {
    site_name: catalog.site?.name ?? "",
    site_url: catalog.site?.url ?? "",
    contact_email: catalog.site?.contact_email ?? "",
    merchant_id_set: Boolean(catalog.payment?.merchant_id),
    merchant_key_set: Boolean(catalog.payment?.merchant_key),
  };
}

export async function putSettings(input: {
  site_name: string;
  site_url: string;
  contact_email: string;
}) {
  const { catalog, sha } = await readCatalog();
  catalog.site = {
    ...catalog.site,
    name: input.site_name,
    url: input.site_url,
    contact_email: input.contact_email,
  };
  await writeCatalog(catalog, sha, "Update site settings");
  return getSettings();
}

// ── Deploy ──────────────────────────────────────────────────────────────────

/** Creates an empty commit on main, which triggers the deploy workflow. */
export async function deploy(message: string) {
  const ref = await gh<{ object: { sha: string } }>(
    `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`,
  );
  const headSha = ref.object.sha;
  const head = await gh<{ tree: { sha: string } }>(`/repos/${OWNER}/${REPO}/git/commits/${headSha}`);
  const commit = await gh<{ sha: string; html_url: string }>(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: "POST",
    body: {
      message: message.trim() || "Publish changes",
      tree: head.tree.sha,
      parents: [headSha],
    },
  });
  await gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: { sha: commit.sha },
  });
  return {
    commit_url: commit.html_url,
    commit_sha: commit.sha,
    message: message.trim() || "Publish changes",
  };
}

export async function deployStatus() {
  try {
    const runs = await gh<{ workflow_runs?: {
      status?: string;
      conclusion?: string | null;
      html_url?: string;
      updated_at?: string;
    }[] }>(`/repos/${OWNER}/${REPO}/actions/workflows/${DEPLOY_WORKFLOW}/runs?per_page=1&branch=${BRANCH}`);
    const run = runs.workflow_runs?.[0];
    if (!run) return {};
    return {
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
      updated_at: run.updated_at,
    };
  } catch {
    return {};
  }
}

// ── Audit ───────────────────────────────────────────────────────────────────

export async function listCommits() {
  const commits = await gh<
    {
      sha: string;
      html_url: string;
      commit: { message: string; author?: { name?: string; date?: string } };
    }[]
  >(`/repos/${OWNER}/${REPO}/commits?sha=${BRANCH}&per_page=50`);
  return commits.map((c) => ({
    sha: c.sha,
    author: c.commit.author?.name ?? "Unknown",
    date: c.commit.author?.date ?? "",
    message: c.commit.message.split("\n")[0] ?? "",
    url: c.html_url,
  }));
}
