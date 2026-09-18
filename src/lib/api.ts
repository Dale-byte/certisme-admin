/**
 * Dashboard API layer. Calls go to this project's own server functions, which
 * commit changes to the storefront repository through the GitHub connection.
 * No API address and no secrets live in the browser.
 */
import { adminCall, adminUpload } from "./admin.functions";

export const SITE_BASE_URL = (
  import.meta.env["VITE_SITE_BASE_URL"] ?? "https://certisme.net"
).replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function toApiError(err: unknown): ApiError {
  const raw = err instanceof Error && err.message ? err.message : "";
  const match = /^(\d{3}):\s*(.*)$/.exec(raw);
  if (match) return new ApiError(match[2] || "The request could not be completed.", Number(match[1]));
  if (!raw) return new ApiError("Something went wrong. Please try again.", 500);
  if (/failed to fetch|network/i.test(raw))
    return new ApiError("Could not reach the server. Check your connection and try again.", 0);
  return new ApiError(raw, 400);
}

type RequestOptions = {
  method?: string;
  token: string;
  body?: unknown;
  query?: Record<string, string>;
};

export async function apiRequest<T>(path: string, opts: RequestOptions): Promise<T> {
  try {
    const result = await adminCall({
      data: {
        token: opts.token,
        path,
        method: opts.method ?? "GET",
        ...(opts.body !== undefined ? { body: opts.body } : {}),
      },
    });
    return result as T;
  } catch (err) {
    throw toApiError(err);
  }
}

/** Upload with coarse progress reporting. Used for documents and images. */
export async function apiUpload<T>(
  path: string,
  opts: {
    token: string;
    file: File;
    query?: Record<string, string>;
    onProgress?: (percent: number) => void;
  },
): Promise<T> {
  const isImage = path.startsWith("/images");
  const productId = isImage
    ? decodeURIComponent(path.slice("/images/".length))
    : (opts.query?.["product"] ?? "");

  const form = new FormData();
  form.set("token", opts.token);
  form.set("kind", isImage ? "image" : "document");
  form.set("product", productId);
  form.set("file", opts.file, opts.file.name);

  opts.onProgress?.(15);
  const tick = setInterval(() => opts.onProgress?.(70), 400);
  try {
    const result = await adminUpload({ data: form });
    opts.onProgress?.(100);
    return result as T;
  } catch (err) {
    throw toApiError(err);
  } finally {
    clearInterval(tick);
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return toApiError(err).message;
  return "Something went wrong. Please try again.";
}
