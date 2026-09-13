export type Framework = {
  id: string;
  name: string;
  full_name: string;
  description?: string;
  color?: string;
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
  file?: string;
  size?: number;
  uploaded_at?: string;
  present: boolean;
};

export type SiteSettings = {
  site_name: string;
  site_url: string;
  contact_email: string;
  merchant_id_set?: boolean;
  merchant_key_set?: boolean;
};

export type DeployResponse = {
  commit_url?: string;
  commit_sha?: string;
  run_id?: string | number;
  message?: string;
};

export type DeployStatus = {
  status?: string;
  conclusion?: string | null;
  html_url?: string;
  updated_at?: string;
};

export type AuditEntry = {
  sha: string;
  author: string;
  date: string;
  message: string;
  url?: string;
};
