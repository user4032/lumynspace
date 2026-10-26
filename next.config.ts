import type { NextConfig } from "next";

// Фото з Supabase Storage (публічні бакети) для next/image
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname
  } catch {
    return ""
  }
})()

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  async redirects() {
    return [
      // старий сайт: Google досі показує ці сторінки як sitelinks
      { source: "/apps", destination: "/welcome", permanent: true },
      { source: "/apps/:path*", destination: "/welcome", permanent: true },
      { source: "/download", destination: "/welcome", permanent: true },
      { source: "/download/:path*", destination: "/welcome", permanent: true },
      // www → apex (канонічна адреса)
      { source: "/:path*", has: [{ type: "host", value: "www.lumyn.space" }], destination: "https://lumyn.space/:path*", permanent: true },
    ]
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
