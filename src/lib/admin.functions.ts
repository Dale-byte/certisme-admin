/**
 * Server functions for the admin dashboard. Everything they do ends up as a
 * commit in the storefront repository, through the project's GitHub connection.
 * The browser only ever sends a signed session token.
 */
import { createServerFn } from "@tanstack/react-start";

type CallInput = {
  token: string;
  path: string;
  method?: string;
  body?: unknown;
};

function fail(err: unknown): never {
  const message =
    err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.";
  const name = err instanceof Error ? err.name : "";
  if (name === "AuthError") throw new Error(`401: ${message}`);
  if (message === "not-found") throw new Error("404: That item could not be found.");
  throw new Error(message);
}

/** Single dispatcher so the dashboard keeps its simple path-based calls. */
export const adminCall = createServerFn({ method: "POST" })
  .inputValidator((input: CallInput) => input)
  .handler(async ({ data }) => {
    const repo = await import("./repo.server");
    const { token, path } = data;
    const method = (data.method ?? "GET").toUpperCase();
    const body = data.body as Record<string, unknown> | undefined;

    try {
      if (path === "/auth/login") {
        const creds = (body ?? {}) as { username?: string; password?: string };
        const res = repo.login(String(creds.username ?? ""), String(creds.password ?? ""));
        return { token: res.token, user: { email: res.email } };
      }

      const username = repo.requireAuth(token);

      if (path === "/auth/me") return { email: username, name: username };

      if (path === "/frameworks") {
        if (method === "GET") return await repo.listFrameworks();
        if (method === "POST")
          return await repo.upsertFramework(body as never, true);
      }
      if (path.startsWith("/frameworks/")) {
        const id = decodeURIComponent(path.slice("/frameworks/".length));
        if (method === "PUT") return await repo.upsertFramework(body as never, false);
        if (method === "DELETE") return await repo.deleteFramework(id);
      }

      if (path === "/products") {
        if (method === "GET") return await repo.listProducts();
        if (method === "POST") return await repo.upsertProduct(body as never, true);
      }
      if (path.startsWith("/products/")) {
        const id = decodeURIComponent(path.slice("/products/".length));
        if (method === "PUT") return await repo.upsertProduct(body as never, false);
        if (method === "DELETE") return await repo.deleteProduct(id);
      }

      if (path === "/documents" && method === "GET") return await repo.listDocuments();

      if (path === "/settings") {
        if (method === "GET") return await repo.getSettings();
        if (method === "PUT") return await repo.putSettings(body as never);
      }

      if (path === "/deploy" && method === "POST")
        return await repo.deploy(String((body as { message?: string })?.message ?? ""));
      if (path === "/deploy/status") return await repo.deployStatus();

      if (path === "/audit") return await repo.listCommits();

      throw new Error(`Unsupported action (${method} ${path}).`);
    } catch (err) {
      fail(err);
    }
  });

/** Uploads a document or an image; the file arrives as FormData. */
export const adminUpload = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("Expected a file upload.");
    return data;
  })
  .handler(async ({ data }) => {
    const repo = await import("./repo.server");
    const token = String(data.get("token") ?? "");
    const kind = String(data.get("kind") ?? "");
    const productId = String(data.get("product") ?? "");
    const file = data.get("file");

    try {
      repo.requireAuth(token);
      if (!(file instanceof File)) throw new Error("No file was received.");
      if (!productId) throw new Error("Choose a product first.");
      const bytes = Buffer.from(await file.arrayBuffer());
      if (kind === "image") return await repo.uploadImage(productId, file.name, bytes);
      return await repo.uploadDocument(productId, file.name, bytes);
    } catch (err) {
      fail(err);
    }
  });
