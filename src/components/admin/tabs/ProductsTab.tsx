import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, errorMessage, SITE_BASE_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Framework, Product } from "@/lib/types";
import {
  EmptyState,
  FieldLabel,
  FrameworkBadge,
  InlineError,
  Loading,
  NativeSelect,
  PageHeader,
  Panel,
  formatZar,
} from "../primitives";
import { ImageOff, Pencil, Plus, Trash2, X } from "lucide-react";

const FORMATS = ["docx", "xlsx", "pdf"] as const;

const emptyProduct: Product = {
  id: "",
  framework: "",
  name: "",
  description: "",
  format: "docx",
  file: "",
  price: 0,
  includes: [""],
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function ProductsTab() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ product: Product; isNew: boolean } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ["products"],
    queryFn: () => apiRequest<Product[]>("/products", { token: token! }),
    enabled: Boolean(token),
  });

  const frameworks = useQuery({
    queryKey: ["frameworks"],
    queryFn: () => apiRequest<Framework[]>("/frameworks", { token: token! }),
    enabled: Boolean(token),
  });

  const save = useMutation({
    mutationFn: async ({ product, isNew }: { product: Product; isNew: boolean }) => {
      const body = { ...product, includes: product.includes.filter((i) => i.trim()) };
      return isNew
        ? apiRequest<Product[]>("/products", { method: "POST", token: token!, body })
        : apiRequest<Product[]>(`/products/${encodeURIComponent(product.id)}`, {
            method: "PUT",
            token: token!,
            body,
          });
    },
    onSuccess: (list, vars) => {
      if (Array.isArray(list)) qc.setQueryData(["products"], list);
      else void qc.invalidateQueries({ queryKey: ["products"] });
      setEditing(null);
      setFormError(null);
      toast.success(vars.isNew ? "Product created" : "Product updated", {
        description: "Publish on the Deploy tab to make it live.",
      });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest<Product[]>(`/products/${encodeURIComponent(id)}`, {
        method: "DELETE",
        token: token!,
      }),
    onSuccess: (list) => {
      if (Array.isArray(list)) qc.setQueryData(["products"], list);
      else void qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted", { description: "Publish to remove it from the live site." });
    },
    onError: (err) => toast.error("Could not delete product", { description: errorMessage(err) }),
  });

  const frameworkOptions = useMemo(() => frameworks.data ?? [], [frameworks.data]);

  if (editing) {
    return (
      <ProductForm
        product={editing.product}
        isNew={editing.isNew}
        frameworks={frameworkOptions}
        error={formError}
        saving={save.isPending}
        onCancel={() => {
          setEditing(null);
          setFormError(null);
        }}
        onSubmit={(product) => save.mutate({ product, isNew: editing.isNew })}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Every product in your storefront catalogue. Changes are saved to the repository and go live after you publish."
        actions={
          <Button
            onClick={() => {
              setEditing({
                product: { ...emptyProduct, framework: frameworkOptions[0]?.id ?? "" },
                isNew: true,
              });
              setFormError(null);
            }}
          >
            <Plus className="size-4" aria-hidden />
            New product
          </Button>
        }
      />

      {products.isLoading ? <Loading label="Loading products…" /> : null}
      {products.isError ? <InlineError message={errorMessage(products.error)} /> : null}

      {products.data && products.data.length === 0 ? (
        <EmptyState title="No products yet" hint="Create your first product to populate the storefront." />
      ) : null}

      {products.data && products.data.length > 0 ? (
        <Panel className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-bg-alt">
                <tr className="text-left">
                  <th className="label-caps px-4 py-3">Image</th>
                  <th className="label-caps px-4 py-3">Product</th>
                  <th className="label-caps px-4 py-3">Framework</th>
                  <th className="label-caps px-4 py-3">Price</th>
                  <th className="label-caps px-4 py-3">Format</th>
                  <th className="label-caps px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.data.map((product) => (
                  <tr key={product.id} className="border-t border-border align-middle">
                    <td className="px-4 py-3">
                      <ProductThumb id={product.id} name={product.name} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-charcoal">{product.name}</p>
                      <p className="text-xs text-slate">{product.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <FrameworkBadge label={product.framework} />
                    </td>
                    <td className="px-4 py-3 font-medium text-charcoal">
                      {formatZar(product.price)}
                    </td>
                    <td className="px-4 py-3 uppercase text-slate">{product.format}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditing({
                              product: {
                                ...product,
                                includes: product.includes?.length ? product.includes : [""],
                              },
                              isNew: false,
                            });
                            setFormError(null);
                          }}
                        >
                          <Pencil className="size-3.5" aria-hidden />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive/40 text-destructive hover:bg-destructive/5"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Delete "${product.name}"? It stays live until you publish.`,
                              )
                            ) {
                              remove.mutate(product.id);
                            }
                          }}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function ProductThumb({ id, name }: { id: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex size-12 items-center justify-center border border-border bg-bg-alt text-slate">
        <ImageOff className="size-4" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={`${SITE_BASE_URL}/product-images/${id}.png`}
      alt={`${name} cover`}
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-12 border border-border object-cover"
    />
  );
}

function ProductForm({
  product,
  isNew,
  frameworks,
  error,
  saving,
  onCancel,
  onSubmit,
}: {
  product: Product;
  isNew: boolean;
  frameworks: Framework[];
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (product: Product) => void;
}) {
  const [draft, setDraft] = useState<Product>(product);
  const [localError, setLocalError] = useState<string | null>(null);

  const set = <K extends keyof Product>(key: K, value: Product[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div>
      <PageHeader
        title={isNew ? "New product" : `Edit ${product.name}`}
        description={
          isNew
            ? "The product id becomes part of the storefront URL and cannot be changed later."
            : "The product id is fixed. Everything else can be updated."
        }
        actions={
          <Button variant="outline" onClick={onCancel}>
            <X className="size-4" aria-hidden />
            Cancel
          </Button>
        }
      />

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          const id = isNew ? slugify(draft.id || draft.name) : draft.id;
          if (!id) {
            setLocalError("A product id is required.");
            return;
          }
          if (!draft.name.trim()) {
            setLocalError("A product name is required.");
            return;
          }
          if (!draft.framework) {
            setLocalError("Choose a framework for this product.");
            return;
          }
          setLocalError(null);
          onSubmit({ ...draft, id, price: Number(draft.price) || 0 });
        }}
      >
        <Panel className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="product-id">Product id (slug)</FieldLabel>
            <Input
              id="product-id"
              value={draft.id}
              disabled={!isNew}
              onChange={(e) => set("id", slugify(e.target.value))}
              placeholder="iso-9001-quality-manual"
            />
            <p className="mt-1 text-xs text-slate">
              {isNew ? "Lowercase letters, numbers and dashes." : "Fixed after creation."}
            </p>
          </div>
          <div>
            <FieldLabel htmlFor="product-framework">Framework</FieldLabel>
            <NativeSelect
              id="product-framework"
              value={draft.framework}
              onChange={(e) => set("framework", e.target.value)}
            >
              <option value="">Select a framework…</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} — {f.full_name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="product-name">Name</FieldLabel>
            <Input
              id="product-name"
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="ISO 9001 Quality Manual"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="product-description">Description</FieldLabel>
            <Textarea
              id="product-description"
              rows={4}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="product-format">Format</FieldLabel>
            <NativeSelect
              id="product-format"
              value={draft.format}
              onChange={(e) => set("format", e.target.value as Product["format"])}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <FieldLabel htmlFor="product-file">File name</FieldLabel>
            <Input
              id="product-file"
              value={draft.file}
              onChange={(e) => set("file", e.target.value)}
              placeholder="iso-9001-quality-manual.docx"
            />
          </div>
          <div>
            <FieldLabel htmlFor="product-price">Price (ZAR)</FieldLabel>
            <Input
              id="product-price"
              type="number"
              min={0}
              step={1}
              value={String(draft.price)}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </div>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-charcoal">What's included</h2>
              <p className="text-xs text-slate">Bullet points shown on the product page.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => set("includes", [...draft.includes, ""])}
            >
              <Plus className="size-3.5" aria-hidden />
              Add bullet
            </Button>
          </div>
          <div className="space-y-2">
            {draft.includes.map((item, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={item}
                  aria-label={`Included item ${index + 1}`}
                  onChange={(e) =>
                    set(
                      "includes",
                      draft.includes.map((v, i) => (i === index ? e.target.value : v)),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Remove item ${index + 1}`}
                  className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/5"
                  onClick={() =>
                    set(
                      "includes",
                      draft.includes.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        </Panel>

        <InlineError message={localError ?? error} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create product" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
