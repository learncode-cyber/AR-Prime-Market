import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fireMetaPageView } from "@/lib/metaPixel";

type Tracker = {
  provider: string;
  tracker_id: string | null;
  script_code: string | null;
  is_active: boolean;
};

function injectInlineScript(id: string, code: string, parent: HTMLElement = document.head) {
  if (document.querySelector(`script[data-tracker="${id}"]`)) return;
  const s = document.createElement("script");
  s.setAttribute("data-tracker", id);
  s.text = code;
  parent.appendChild(s);
}

function injectRawHtml(id: string, html: string, parent: HTMLElement = document.head) {
  if (document.querySelector(`[data-tracker="${id}"]`)) return;
  const wrap = document.createElement("div");
  wrap.setAttribute("data-tracker", id);
  wrap.style.display = "none";
  wrap.innerHTML = html;
  // Re-create script tags so they execute
  wrap.querySelectorAll("script").forEach((old) => {
    const ns = document.createElement("script");
    for (const a of Array.from(old.attributes)) ns.setAttribute(a.name, a.value);
    ns.text = old.textContent || "";
    old.replaceWith(ns);
  });
  parent.appendChild(wrap);
}

function applyTracker(t: Tracker) {
  const id = t.tracker_id?.trim();
  const code = t.script_code?.trim();

  switch (t.provider) {
    case "facebook_pixel": {
      if (!id) return;
      injectInlineScript(
        "facebook_pixel",
        `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${id}'); fbq('track', 'PageView');`,
      );
      return;
    }
    case "gtm": {
      if (!id) return;
      injectInlineScript(
        "gtm",
        `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`,
      );
      return;
    }
    case "google_analytics": {
      if (!id) return;
      if (!document.querySelector(`script[data-tracker="ga_lib"]`)) {
        const lib = document.createElement("script");
        lib.async = true;
        lib.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
        lib.setAttribute("data-tracker", "ga_lib");
        document.head.appendChild(lib);
      }
      injectInlineScript(
        "google_analytics",
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js', new Date()); gtag('config', '${id}');`,
      );
      return;
    }
    case "google_ads": {
      if (!id) return;
      if (!document.querySelector(`script[data-tracker="gads_lib"]`)) {
        const lib = document.createElement("script");
        lib.async = true;
        lib.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
        lib.setAttribute("data-tracker", "gads_lib");
        document.head.appendChild(lib);
      }
      injectInlineScript(
        "google_ads",
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js', new Date()); gtag('config', '${id}');`,
      );
      return;
    }
    case "tiktok_pixel": {
      if (!id) return;
      injectInlineScript(
        "tiktok_pixel",
        `!function (w, d, t) {w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;
var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${id}'); ttq.page();}(window, document, 'ttq');`,
      );
      return;
    }
    case "snap_pixel": {
      if (!id) return;
      injectInlineScript(
        "snap_pixel",
        `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){
a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};
a.queue=[];var s='script';r=t.createElement(s);r.async=!0;
r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document,'https://sc-static.net/scevent.min.js');
snaptr('init', '${id}'); snaptr('track', 'PAGE_VIEW');`,
      );
      return;
    }
    case "custom_head": {
      if (code) injectRawHtml("custom_head", code, document.head);
      return;
    }
    case "custom_body": {
      if (code) injectRawHtml("custom_body", code, document.body);
      return;
    }
  }
}

export function MarketingTrackers() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith("/kali_master");
  const injectedRef = useRef(false);
  const firstPageRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAdmin) return;
    if (injectedRef.current) return;
    injectedRef.current = true;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("get_active_marketing_trackers");
      if (cancelled || error || !data) return;
      (data as Tracker[]).forEach((t) => applyTracker(t));
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // Re-fire Meta Pixel PageView on every public route change.
  // The first PageView is fired by the inline init code, so we skip it here
  // to avoid double-counting the landing view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAdmin) return;
    if (firstPageRef.current) {
      firstPageRef.current = false;
      return;
    }
    fireMetaPageView();
    // GA4 virtual pageview on SPA route change
    if (typeof window.gtag === "function") {
      window.gtag("event", "page_view", {
        page_path: pathname,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
    // GTM virtual pageview push
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: "pageview", page: pathname });
    }
  }, [pathname, isAdmin]);

  return null;
}
