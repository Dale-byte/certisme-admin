import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiRequest, apiUpload, errorMessage, SITE_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Product } from "@/lib/types";
import {
  FieldLabel,
  InlineError,
  NativeSelect,
  PageHeader,
  Panel,
  formatBytes,
} from "../primitives";
import { CheckCircle2, ImageOff, ImageUp } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

export function ImagesTab() {
  const { token } = useAuth();
  const fileInput = useRef<HTMLInputElement>(null);
  const [productId, setProductId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [currentFailed, setCurrentFailed] = useState(false);
  const [cacheBust, setCacheBust] = useState(0);

  const products = useQuery({
    queryKey: ["products"],
    queryFn: () => apiRequest<Product[]>("/products", { token: token! }),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const liveUrl = productId ? `${SITE_BASE_URL}/product-images/${productId}.png` : null;

  const pickFile = (next: File | null) => {
    setUploadedUrl(null);
    setError(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!ALLOWED.includes(next.type)) {
      setFile(null);
      setError("Only PNG, JPG and WebP images can be uploaded.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setFile(null);
      setError("That image is larger than 5 MB. Please resize it and try again.");
      return;
    }
    setFile(next);
  };

  const upload = async () => {
    if (!productId) {
      setError("Choose the product this image belongs to.");
      return;
    }
    if (!file) {
      setError("Choose an image to upload.");
      return;
    }
    setError(null);
    setProgress(0);
    try {
      await apiUpload(`/images/${encodeURIComponent(productId)}`, {
        token: token!,
        file,
        onProgress: setProgress,
      });
      setUploadedUrl(liveUrl);
      setFile(null);
      setCurrentFailed(false);
      setCacheBust(Date.now());
      if (fileInput.current) fileInput.current.value = "";
      toast.success("Image uploaded", {
        description: "Publish on the Deploy tab to show it on the live site.",
      });
    } catch (err) {
      setError(errorMessage(err));
      toast.error("Upload failed", { description: errorMessage(err) });
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Images"
        description="Product cover images shown on the storefront. PNG, JPG or WebP up to 5 MB."
      />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Panel className="space-y-4">
          <div>
            <FieldLabel htmlFor="img-product">Product</FieldLabel>
            <NativeSelect
              id="img-product"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setUploadedUrl(null);
                setCurrentFailed(false);
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
            <FieldLabel htmlFor="img-file">Image file</FieldLabel>
            <input
              id="img-file"
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
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

          <InlineError message={error} />

          <Button
            onClick={() => void upload()}
            disabled={progress !== null || !file}
            className="w-full"
          >
            <ImageUp className="size-4" aria-hidden />
            {progress !== null ? "Uploading…" : "Confirm and upload"}
          </Button>

          {uploadedUrl ? (
            <div className="border border-coral-border bg-coral-pale p-3 text-sm text-coral-dark">
              <p className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="size-4" aria-hidden />
                Image saved
              </p>
              <p className="mt-1 break-all">
                It will appear at{" "}
                <a className="underline" href={uploadedUrl} target="_blank" rel="noreferrer">
                  {uploadedUrl}
                </a>{" "}
                once you publish.
              </p>
            </div>
          ) : null}
        </Panel>

        <Panel>
          <h2 className="text-sm font-bold text-charcoal">Compare before confirming</h2>
          <p className="text-xs text-slate">
            Left is what shoppers see today. Right is the image you selected.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label-caps mb-2">Current on live site</p>
              <div className="flex aspect-square items-center justify-center border border-border bg-bg-alt">
                {liveUrl && !currentFailed ? (
                  <img
                    src={cacheBust ? `${liveUrl}?v=${cacheBust}` : liveUrl}
                    alt="Current product image"
                    onError={() => setCurrentFailed(true)}
                    className="size-full object-contain"
                  />
                ) : (
                  <span className="flex flex-col items-center gap-2 text-xs text-slate">
                    <ImageOff className="size-5" aria-hidden />
                    {productId ? "No image on the live site yet" : "Pick a product"}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="label-caps mb-2">New candidate</p>
              <div className="flex aspect-square items-center justify-center border border-dashed border-coral-border bg-coral-pale/40">
                {previewUrl ? (
                  <img src={previewUrl} alt="Selected image preview" className="size-full object-contain" />
                ) : (
                  <span className="text-xs text-slate">Choose a file to preview it here</span>
                )}
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
