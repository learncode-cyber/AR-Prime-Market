import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Hostinger / Node deployment toggle.
// DEPLOY_TARGET=hostinger creates a pure static SPA shell for shared hosting.
// DEPLOY_TARGET=node keeps the Node-compatible SSR bundle path available.
const deployTarget = process.env.DEPLOY_TARGET;
const isHostingerTarget = deployTarget === "hostinger";
const isNodeTarget =
  !isHostingerTarget &&
  (deployTarget === "node" ||
    process.env.NITRO_PRESET === "node-server" ||
    process.env.NITRO_PRESET === "node");

// Hostinger shared-hosting base path. Use "/" for root (public_html) and
// "/subfolder/" when deploying into a sub-directory.
const hostingerBase = process.env.HOSTINGER_BASE || "/";

export default defineConfig({
  // Static Hostinger uploads cannot run TanStack Start SSR/Nitro. The SPA shell
  // generated below includes the required router bootstrap data, then
  // scripts/hostinger-postbuild.mjs promotes it to dist/index.html.
  nitro: isHostingerTarget
    ? false
    : isNodeTarget
      ? {
          preset: "node-server",
          output: {
            dir: ".output",
            serverDir: ".output/server",
            publicDir: ".output/public",
          },
        }
      : undefined,
  tanstackStart: isHostingerTarget
    ? {
        spa: {
          enabled: true,
          maskPath: "/",
          prerender: {
            outputPath: "/_shell",
            crawlLinks: false,
            retryCount: 0,
          },
        },
        prerender: {
          failOnError: true,
          autoStaticPathsDiscovery: false,
        },
      }
    : undefined,
  vite: {
    base: hostingerBase,
    plugins: [
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        devOptions: { enabled: false },
        manifest: {
          name: "AR Prime Market",
          short_name: "AR Prime",
          description:
            "Premium products curated for the modern lifestyle. Quality, style, and value — delivered to your doorstep.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          background_color: "#ffffff",
          theme_color: "#e91e63",
          categories: ["shopping", "lifestyle"],
          lang: "bn-BD",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
            { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,png,svg,jpg,jpeg,webp,woff2}"],
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/api\//, /^\/~oauth/, /^\/admin/],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-pages",
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: ({ request }) =>
                request.destination === "style" ||
                request.destination === "script" ||
                request.destination === "worker",
              handler: "StaleWhileRevalidate",
              options: { cacheName: "assets" },
            },
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ],
  },
});
