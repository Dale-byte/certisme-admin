import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiRequest, apiUpload, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { DocumentStatus, Product } from "@/lib/types";
import {
  EmptyState,
  FieldLabel,
  InlineError,
  Loading,
  NativeSelect,
  PageHeader,
  Panel,
  formatBytes,
} from "../primitives";
import { CheckCircle2, Download, FileUp, MinusCircle } from "lucide-react";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = [".docx", ".xlsx", ".pdf"];

export function DocumentsTab() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [productId, setProductId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const products = useQuery({
    queryKey: ["products"],
    queryFn: () => apiRequest<Product[]>("/products", { token: token! }),
    enabled: Boolean(token),
  });

  const documents = useQuery({
    queryKey: ["documents"],
    queryFn: () => apiRequest<DocumentStatus[]>("/documents", { token: token! }),
    enabled: Boolean(token),
  });

  const pickFile = (next: File | null) => {
    setDone(false);
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    const lower = next.name.toLowerCase();
    if (!ALLOWED.some((ext) => lower.endsWith(ext))) {
      setFile(null);
      setError("Only Word (.docx), Excel (.xlsx) and PDF files can be uploaded.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setFile(null);
      setError("That file is larger than 25 MB. Please compress it and try again.");
      return;
    }
    setFile(next);
  };

  const upload = async () => {
    if (!productId) {
      setError("Choose the product this document belongs to.");
      return;
    }
    if (!file) {
      setError("Choose a document to upload.");
      return;
    }
    setError(null);
    setDone(false);
    setProgress(0);
    try {
      await apiUpload("/documents", {
        token: token!,
        file,
        query: { product: productId },
        onProgress: setProgress,
      });
      setDone(true);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      void qc.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document uploaded", {
        description: "Customers receive the new file from their next purchase.",
      });
    } catch (err) {
      setError(errorMessage(err));
      toast.error("Upload failed", { description: errorMessage(err) });
    } finally {
      setProgress(null);
    }
  };

  const [downloading, setDownloading] = useState<string | null>(null);
  const download = async (id: string) => {
    setDownloading(id);
    try {
      const f = await apiRequest<{ name: string; type: string; base64: string }>(
        `/documents/${encodeURIComponent(id)}/download`,
        { token: token! },
      );
      const bin = atob(f.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: f.type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      toast.error("Download failed", { description: errorMessage(err) });
    } finally {
      setDownloading(null);
    }
  };

  const statusFor = (id: string) => documents.data?.find((d) => d.product_id === id);

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Files customers download after purchase, stored in Cloudflare R2 (certisme-doc). Uploads replace the live file straight away. Maximum size 25 MB."
      />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Panel className="space-y-4">
          <div>
            <FieldLabel htmlFor="doc-product">Product</FieldLabel>
            <NativeSelect
              id="doc-product"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setDone(false);
              }}
            >
              <option value="">Select a product…</option>
              {(products.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div>
            <FieldLabel htmlFor="doc-file">Document file</FieldLabel>
            <input
              id="doc-file"
              ref={fileInput}
              type="file"
              accept=".docx,.xlsx,.pdf"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="w-full border border-input bg-background p-2 text-sm file:mr-3 file:border-0 file:bg-coral-pale file:px-2 file:py-1 file:text-xs file:font-semibold file:text-coral-dark"
            />
            {file ? (
              <p className="mt-1 text-xs text-slate">
                {file.name} · {formatBytes(file.size)}
              </p>
            ) : null}
          </div>

          {progress !== null ? (
            <div>
              <Progress value={progress} className="h-2" />
              <p className="mt-1 text-xs text-slate">Uploading… {progress}%</p>
            </div>
          ) : null}

          {done ? (
            <p className="flex items-center gap-2 border border-coral-border bg-coral-pale px-3 py-2 text-sm text-coral-dark">
              <CheckCircle2 className="size-4" aria-hidden />
              Upload complete.
            </p>
          ) : null}

          <InlineError message={error} />

          <Button onClick={() => void upload()} disabled={progress !== null} className="w-full">
            <FileUp className="size-4" aria-hidden />
            {progress !== null ? "Uploading…" : "Upload document"}
          </Button>
        </Panel>

        <Panel className="p-0">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold text-charcoal">Upload status</h2>
            <p className="text-xs text-slate">Which products have a document in Cloudflare R2 storage.</p>
          </div>
          {products.isLoading || documents.isLoading ? (
            <div className="px-4">
              <Loading label="Loading status…" />
            </div>
          ) : null}
          {documents.isError ? (
            <div className="p-4">
              <InlineError message={errorMessage(documents.error)} />
            </div>
          ) : null}
          {products.data && products.data.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No products" hint="Create a product first, then upload its document." />
            </div>
          ) : null}
          {products.data && products.data.length > 0 ? (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="bg-bg-alt">
                  <tr className="text-left">
                    <th className="label-caps px-4 py-3">Product</th>
                    <th className="label-caps px-4 py-3">Document</th>
                    <th className="label-caps px-4 py-3">Storage location</th>
                    <th className="label-caps px-4 py-3">Size</th>
                    <th className="label-caps px-4 py-3">Status</th>
                    <th className="label-caps px-4 py-3"><span className="sr-only">Download</span></th>
                  </tr>
                </thead>
                <tbody>
                  {products.data.map((p) => {
                    const status = statusFor(p.id);
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-4 py-3 font-medium text-charcoal">{p.name}</td>
                        <td className="px-4 py-3 text-slate">{status?.file ?? p.file ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate">{status?.location ?? "—"}</td>
                        <td className="px-4 py-3 text-slate">{formatBytes(status?.size)}</td>
                        <td className="px-4 py-3">
                          {status?.present ? (
                            <span className="inline-flex items-center gap-1.5 text-coral-dark">
                              <CheckCircle2 className="size-4" aria-hidden />
                              Uploaded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-slate">
                              <MinusCircle className="size-4" aria-hidden />
                              Missing
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {status?.present ? (
                            <Button size="sm" variant="outline" disabled={downloading === p.id} onClick={() => void download(p.id)} aria-label={`Download ${p.name}`}>
                              <Download className="size-4" aria-hidden />
                              {downloading === p.id ? "Downloading…" : "Download"}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </Panel>
      </div>
    </div>
  );
}
