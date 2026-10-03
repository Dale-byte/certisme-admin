import type { SiteContent } from "./site-content";

/** Starting content used until the first site-content file exists in the repo. */
export function defaultSiteContent(siteName: string): SiteContent {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    theme: {
      logo_text: "",
      primary: "#0D9488",
      accent: "#1D4ED8",
      background: "#FFFFFF",
      text: "#111827",
      font_family: "Plus Jakarta Sans",
      density: "comfortable",
      corner_style: "sharp",
    },
    navigation: [
      { id: "nav-home", label: "Home", href: "/" },
      { id: "nav-packs", label: "Document packs", href: "/frameworks" },
      { id: "nav-faq", label: "FAQ", href: "/#faq" },
    ],
    footer: {
      tagline: "Compliance documentation for SMEs",
      legal: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`,
      payment_note: `Payments processed securely by PayFast. ${siteName} does not store payment card information.`,
      links: [],
    },
    globals: {
      product_includes_label: "What's included",
      delivery_email_label: "Email for delivery",
      buy_label: "Buy now",
      vat_note: "Prices in ZAR.",
      contact_heading: "Questions?",
      contact_body: "If you have questions about which kit is right for your business, or need a custom document set for a specific framework or industry, contact us at",
      not_found_heading: "Page not found",
      not_found_body: "The page you were looking for doesn't exist or has been moved. Head back to the storefront to browse the available document packs.",
      not_found_button: "Browse frameworks →",
      home_faqs: [], // empty = keep the storefront's built-in FAQ answers
    },
    pages: [
      {
        id: "page-home",
        name: "Home",
        slug: "/",
        published: true,
        seo: {
          title: "CertiSME - ISO 27001, ISO 42001 & NIST AI RMF Compliance Documents",
          description:
            "Ready-to-use ISO 27001, ISO 42001 and NIST AI RMF compliance document kits for SMEs in South Africa. Policy bundles, control registers and risk workbooks delivered by secure instant download after payment.",
        },
        sections: [
          {
            id: "sec-hero",
            type: "hero",
            eyebrow: "Global compliance",
            heading: "",
            body: "",
            button_label: "Browse frameworks →",
            button_href: "#frameworks",
          },
          { id: "sec-frameworks", type: "framework-grid", heading: "Frameworks" },
          { id: "sec-faq", type: "faq", heading: "Frequently asked questions" },
          { id: "sec-contact", type: "contact", heading: "Questions?" },
        ],
      },
    ],
    guides: [],
    templates: [],
  };
}
