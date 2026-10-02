import type { SiteContent } from "./site-content";

/** Starting content used until the first site-content file exists in the repo. */
export function defaultSiteContent(siteName: string): SiteContent {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    theme: {
      logo_text: siteName,
      primary: "#0D9488",
      accent: "#1D4ED8",
      background: "#FFFFFF",
      text: "#111827",
      font_family: "Plus Jakarta Sans",
      density: "comfortable",
      corner_style: "sharp",
    },
    navigation: [
      { id: "nav-packs", label: "Document packs", href: "/document-packs" },
      { id: "nav-guides", label: "Guides", href: "/guides" },
      { id: "nav-contact", label: "Contact", href: "/#contact" },
    ],
    footer: {
      tagline: "Compliance document packs for small and medium businesses.",
      legal: `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`,
      payment_note: "Secure payments processed by PayFast.",
      links: [],
    },
    globals: {
      product_includes_label: "What's included",
      delivery_email_label: "Email for delivery",
      buy_label: "Buy now",
      vat_note: "Prices in ZAR.",
      contact_heading: "Get in touch",
      contact_body: "Questions about a pack? Email us and we'll reply within one business day.",
      not_found_heading: "Page not found",
      not_found_body: "The page you were looking for doesn't exist.",
      not_found_button: "Back to home",
      home_faqs: [],
    },
    pages: [
      {
        id: "page-home",
        name: "Home",
        slug: "/",
        published: true,
        seo: { title: siteName, description: "Ready-to-use compliance document packs." },
        sections: [
          {
            id: "sec-hero",
            type: "hero",
            heading: "Compliance documentation, ready to use",
            body: "Practical templates for ISO and AI governance frameworks.",
            button_label: "Browse packs",
            button_href: "/document-packs",
          },
          { id: "sec-frameworks", type: "framework-grid", heading: "Frameworks" },
          { id: "sec-products", type: "product-grid", heading: "Document packs" },
          { id: "sec-contact", type: "contact", heading: "Contact" },
        ],
      },
    ],
    guides: [],
    templates: [],
  };
}
