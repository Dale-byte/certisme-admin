/**
 * Thin API client for the Cloudflare Worker that fronts the storefront GitHub repo.
 * The base URL comes from VITE_API_BASE_URL. No secrets ever live in this file.
 */

export const API_BASE_URL = (import.meta.env["VITE_API_BASE_URL"] ?? "").replace(/\/$/, "");
export const ADMIN_EMAIL = import.meta.env["VITE_ADMIN_EMAIL"] ?? "";
export const GOOGLE_CLIENT_ID = import.meta.env["VITE_GOOGLE_CLIENT_ID"] ?? "";
export const SITE_BASE_URL = (
  import.meta.env["VITE_SITE_BASE_URL"] ?? "https://certisme.co.za"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function humanize(status: number, fallback?: string): string {
  if (fallback && fallback.trim()) return fallback;
  if (status === 0) return "Could not reach the API. Check your connection and the API address.";
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "This account is not allowed to manage the storefront.";
  if (status === 404) return "That item could not be found.";
  if (status === 413) return "That file is too large for the API to accept.";
  if (status >= 500) return "The API had a problem. Please try again in a moment.";
  return "The request could not be completed.";
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return "";
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string };
      return parsed.error ?? parsed.message ?? "";
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return "";
  }
}

type RequestOptions = {
  method?: string;
  token: string;
  body?: unknown;
  rawBody?: BodyInit;
  contentType?: string;
  query?: Record<string, string>;
};

export async function apiRequest<T>(path: string, opts: RequestOptions): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError("The API address is not configured yet (VITE_API_BASE_URL).", 0);
  }

  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

  const headers: Record<string, string> = { Authorization: `Bearer ${opts.token}` };
  let body: BodyInit | undefined;

  if (opts.rawBody !== undefined) {
    body = opts.rawBody;
    if (opts.contentType) headers["Content-Type"] = opts.contentType;
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { method: opts.method ?? "GET", headers, body });
  } catch {
    throw new ApiError(humanize(0), 0);
  }

  if (!res.ok) throw new ApiError(humanize(res.status, await readError(res)), res.status);

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/** Upload with progress reporting. Used for documents and images. */
export function apiUpload<T>(
  path: string,
  opts: {
    token: string;
    file: File;
    query?: Record<string, string>;
    onProgress?: (percent: number) => void;
  },
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!API_BASE_URL) {
      reject(new ApiError("The API address is not configured yet (VITE_API_BASE_URL).", 0));
      return;
    }
    const url = new URL(`${API_BASE_URL}${path}`);
    for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url.toString());
    xhr.setRequestHeader("Authorization", `Bearer ${opts.token}`);
    xhr.setRequestHeader("Content-Type", opts.file.type || "application/octet-stream");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError(humanize(0), 0));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.(100);
        try {
          resolve(xhr.responseText ? (JSON.parse(xhr.responseText) as T) : (undefined as T));
        } catch {
          resolve(undefined as T);
        }
      } else {
        let msg = "";
        try {
          const parsed = JSON.parse(xhr.responseText) as { error?: string; message?: string };
          msg = parsed.error ?? parsed.message ?? "";
        } catch {
          msg = "";
        }
        reject(new ApiError(humanize(xhr.status, msg), xhr.status));
      }
    };
    xhr.send(opts.file);
  });
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}
