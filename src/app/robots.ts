import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/welcome", "/terms", "/privacy", "/about", "/contact", "/guidelines", "/api/og"],
        disallow: ["/admin", "/api/", "/messages", "/settings", "/notifications", "/onboarding", "/auth", "/design"],
      },
    ],
    sitemap: "https://lumyn.space/sitemap.xml",
    host: "https://lumyn.space",
  }
}
