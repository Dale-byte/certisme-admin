export type SiteLink = {
  id: string;
  label: string;
  href: string;
  external?: boolean | undefined;
};

export type FaqItem = { id: string; question: string; answer: string };
export type TextBlock = { id: string; heading: string; paragraphs: string[] };

export type SiteSection = {
  id: string;
  type: "hero" | "framework-grid" | "product-grid" | "rich-text" | "faq" | "contact" | "cta";
  heading: string;
  eyebrow?: string | undefined;
  body?: string | undefined;
  button_label?: string | undefined;
  button_href?: string | undefined;
  items?: string[] | undefined;
};

export type SitePage = {
  id: string;
  name: string;
  slug: string;
  published: boolean;
  seo: {
    title: string;
    description: string;
    canonical?: string | undefined;
    noindex?: boolean | undefined;
  };
  sections: SiteSection[];
};

export type EditorialPage = {
  id: string;
  badge: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string[];
  sections: TextBlock[];
  faqs: FaqItem[];
  productId?: string | undefined;
  crossLinkId?: string | undefined;
};

export type SiteContent = {
  version: 1;
  updated_at: string;
  theme: {
    logo_text: string;
    primary: string;
    accent: string;
    background: string;
    text: string;
    font_family: string;
    density: "compact" | "comfortable" | "spacious";
    corner_style: "sharp" | "soft" | "rounded";
  };
  navigation: SiteLink[];
  footer: {
    tagline: string;
    legal: string;
    payment_note: string;
    links: SiteLink[];
  };
  globals: {
    product_includes_label: string;
    delivery_email_label: string;
    buy_label: string;
    vat_note: string;
    contact_heading: string;
    contact_body: string;
    not_found_heading: string;
    not_found_body: string;
    not_found_button: string;
    home_faqs: FaqItem[];
  };
  pages: SitePage[];
  guides: EditorialPage[];
  templates: EditorialPage[];
};

export type ContentRevision = {
  sha: string;
  date: string;
  author: string;
  message: string;
  url: string;
};

export const SECTION_LABELS: Record<SiteSection["type"], string> = {
  hero: "Hero",
  "framework-grid": "Framework grid",
  "product-grid": "Product grid",
  "rich-text": "Text section",
  faq: "FAQ",
  contact: "Contact",
  cta: "Call to action",
};

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
