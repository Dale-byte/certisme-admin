import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, FileUp, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, apiUpload, errorMessage, SITE_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { DocumentStatus, Product } from "@/lib/types";
import { FieldLabel, InlineError, NativeSelect, Panel, formatBytes } from "../primitives";

/** Links a template page to the product whose document customers buy there, and uploads that document. */
export function TemplateDocumentPanel({
  templateId,
  productId,
  onProductChange,
}: {
  templateId: string;
  productId: string | undefined;
  onProductChange: (id: string | undefined) => void;
}) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const product = products.data?.find((p) => p.id === productId);
  const status = documents.data?.find((d) => d.product_id === productId);

  const upload = async (file: File | undefined) => {
    if (!file || !productId) return;
    setError(null);
    setBusy(true);
    try {
      await apiUpload("/documents", { token: token!, file, query: { product: productId } });
      void qc.invalidateQueries({ queryKey: ["documents"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Document uploaded", { description: "Customers get the new file on their next purchase." });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <Panel>
      <h2 className="mb-1 font-semibold text-charcoal">Template document</h2>
      <p className="mb-4 text-xs text-slate">
        The document customers buy on this page. It is sold through the Buy button on{" "}
        <a className="underline" href={`${SITE_BASE_URL}/templates/${templateId}`} target="_blank" rel="noreferrer">
          {SITE_BASE_URL.replace(/^https?:\/\//, "")}/templates/{templateId}
        </a>{" "}
        and delivered by download after payment.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`tpl-product-${templateId}`}>Product sold on this page</FieldLabel>
          <NativeSelect
            id={`tpl-product-${templateId}`}
            value={productId ?? ""}
            onChange={(e) => onProductChange(e.target.value || undefined)}
          >
            <option value="">No product (no Buy button)</option>
            {(products.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </NativeSelect>
        </div>
        {product ? (
          <div>
            <FieldLabel htmlFor={`tpl-file-${templateId}`}>Replace document</FieldLabel>
            <input
              id={`tpl-file-${templateId}`}
              ref={input}
              type="file"
              accept=".docx,.xlsx,.pdf"
              disabled={busy}
              onChange={(e) => void upload(e.target.files?.[0])}
              className="w-full border border-input bg-background p-2 text-sm file:mr-3 file:border-0 file:bg-coral-pale file:px-2 file:py-1 file:text-xs file:font-semibold file:text-coral-dark"
            />
          </div>
        ) : null}
      </div>
      {product ? (
        <div className="mt-4 border border-border bg-bg-alt p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-charcoal">
            {status?.present ? <CheckCircle2 className="size-4 text-coral-dark" aria-hidden /> : <MinusCircle className="size-4 text-slate" aria-hidden />}
            {status?.present ? "Document uploaded" : "No document uploaded yet"}
            {status?.size ? <span className="font-normal text-slate">· {formatBytes(status.size)}</span> : null}
          </p>
          <p className="mt-1 text-xs text-slate">Stored in Cloudflare R2: {status?.location ?? `certisme-doc/docs/${product.file}`}</p>
          {busy ? <p className="mt-1 text-xs text-slate">Uploading…</p> : null}
        </div>
      ) : null}
      <div className="mt-3"><InlineError message={error} /></div>
    </Panel>
  );
}
