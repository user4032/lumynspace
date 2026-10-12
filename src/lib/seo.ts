import type { Metadata } from "next"

export function pageMeta(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} · Lumyn`,
      description,
      url: path,
      siteName: "Lumyn",
      locale: "uk_UA",
      type: "website",
      images: ["/api/og"],
    },
  }
}