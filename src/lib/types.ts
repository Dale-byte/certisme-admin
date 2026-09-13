export type Framework = {
  id: string;
  name: string;
  full_name: string;
  description?: string | undefined;
  color?: string | undefined;
};

export type Product = {
  id: string;
  framework: string;
  name: string;
  description: string;
  format: "docx" | "xlsx" | "pdf";
  file: string;
  price: number;
  includes: string[];
};

export type DocumentStatus = {
  product_id: string;
  file?: string | undefined;
  size?: number | undefined;
  uploaded_at?: string | undefined;
  present: boolean;
};

export type SiteSettings = {
  site_name: string;
  site_url: string;
  contact_email: string;
  merchant_id_set?: boolean | undefined;
  merchant_key_set?: boolean | undefined;
};

export type DeployResponse = {
  commit_url?: string | undefined;
  commit_sha?: string | undefined;
  run_id?: string | number | undefined;
  message?: string | undefined;
};

export type DeployStatus = {
  status?: string | undefined;
  conclusion?: string | null | undefined;
  html_url?: string | undefined;
  updated_at?: string | undefined;
};

export type AuditEntry = {
  sha: string;
  author: string;
  date: string;
  message: string;
  url?: string | undefined;
};
