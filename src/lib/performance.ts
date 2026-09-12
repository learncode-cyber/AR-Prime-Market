// ✅ FEATURE 3: Core Web Vitals Optimization
// Performance monitoring and optimization utilities

import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

export interface VitalsMetrics {
  cls: number // Cumulative Layout Shift
  fid: number // First Input Delay
  fcp: number // First Contentful Paint
  lcp: number // Largest Contentful Paint
  ttfb: number // Time to First Byte
}

export class PerformanceOptimizer {
  private metrics: VitalsMetrics = {
    cls: 0,
    fid: 0,
    fcp: 0,
    lcp: 0,
    ttfb: 0,
  }

  // Initialize metrics collection
  initializeMetrics(onMetric?: (metrics: VitalsMetrics) => void) {
    if (typeof window === 'undefined') return

    // Collect CLS
    getCLS((metric) => {
      this.metrics.cls = metric.value
      onMetric?.(this.metrics)
    })

    // Collect FID
    getFID((metric) => {
      this.metrics.fid = metric.value
      onMetric?.(this.metrics)
    })

    // Collect FCP
    getFCP((metric) => {
      this.metrics.fcp = metric.value
      onMetric?.(this.metrics)
    })

    // Collect LCP
    getLCP((metric) => {
      this.metrics.lcp = metric.value
      onMetric?.(this.metrics)
    })

    // Collect TTFB
    getTTFB((metric) => {
      this.metrics.ttfb = metric.value
      onMetric?.(this.metrics)
    })
  }

  // Lazy load images
  setupLazyLoading() {
    if (typeof window === 'undefined') return

    const images = document.querySelectorAll('img[data-lazy]')
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            const src = img.getAttribute('data-src')
            if (src) {
              img.src = src
              img.removeAttribute('data-lazy')
              observer.unobserve(img)
            }
          }
        })
      })

      images.forEach((img) => observer.observe(img))
    }
  }

  // Optimize fonts
  setupFontOptimization() {
    if (typeof document === 'undefined') return

    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = 'https://fonts.googleapis.com'
    document.head.appendChild(link)

    const link2 = document.createElement('link')
    link2.rel = 'preconnect'
    link2.href = 'https://fonts.gstatic.com'
    link2.crossOrigin = 'anonymous'
    document.head.appendChild(link2)

    // Use font-display: swap for faster rendering
    const style = document.createElement('style')
    style.textContent = `
      @font-face {
        font-display: swap;
      }
    `
    document.head.appendChild(style)
  }

  // Defer non-critical CSS
  deferNonCriticalCSS() {
    if (typeof document === 'undefined') return

    const links = document.querySelectorAll('link[data-defer]')
    links.forEach((link) => {
      const href = link.getAttribute('href')
      if (href) {
        const newLink = document.createElement('link')
        newLink.rel = 'stylesheet'
        newLink.href = href
        newLink.onload = () => {
          link.remove()
        }
        document.head.appendChild(newLink)
      }
    })
  }

  // Optimize images - convert to WebP
  optimizeImageFormats() {
    if (typeof document === 'undefined') return

    const images = document.querySelectorAll('img[data-optimize]')
    images.forEach((img: HTMLImageElement) => {
      const src = img.src
      if (src && !src.endsWith('.webp')) {
        // Use WebP with fallback
        const webpSrc = src.replace(/\.(jpg|png)$/, '.webp')
        img.srcset = `${webpSrc} 1x, ${src} 1x`
        img.sizes = '100vw'
      }
    })
  }

  // Code splitting hint
  prefetchRoutes(routes: string[]) {
    if (typeof document === 'undefined') return

    routes.forEach((route) => {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = route
      link.as = 'document'
      document.head.appendChild(link)
    })
  }

  // Compress and minify JavaScript
  setupCodeSplitting() {
    if (typeof window === 'undefined') return

    // Dynamic import for code splitting
    const moduleMap: Record<string, () => Promise<any>> = {
      checkout: () => import('@/components/Checkout'),
      cart: () => import('@/components/Cart'),
      dashboard: () => import('@/components/Dashboard'),
    }

    ;(window as any).__loadModule = async (moduleName: string) => {
      const loader = moduleMap[moduleName]
      if (loader) {
        return await loader()
      }
    }
  }

  // Monitor performance
  monitorPerformance() {
    if (typeof window === 'undefined') return

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navTiming = entry as PerformanceNavigationTiming
          console.log('Page Load Metrics:', {
            dns: navTiming.domainLookupEnd - navTiming.domainLookupStart,
            tcp: navTiming.connectEnd - navTiming.connectStart,
            ttfb: navTiming.responseStart - navTiming.requestStart,
            download: navTiming.responseEnd - navTiming.responseStart,
            domInteractive: navTiming.domInteractive,
            domComplete: navTiming.domComplete,
          })
        }

        if (entry.entryType === 'resource') {
          const resourceTiming = entry as PerformanceResourceTiming
          if (resourceTiming.duration > 1000) {
            console.warn(`Slow resource: ${entry.name} (${resourceTiming.duration}ms)`)
          }
        }
      }
    })

    observer.observe({ entryTypes: ['navigation', 'resource'] })
  }

  // Service Worker for caching
  registerServiceWorker() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration)
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error)
      })
  }

  getMetrics(): VitalsMetrics {
    return this.metrics
  }

  isOptimal(): boolean {
    return (
      this.metrics.cls < 0.1 &&
      this.metrics.fid < 100 &&
      this.metrics.lcp < 2500 &&
      this.metrics.ttfb < 600
    )
  }
}

export const performanceOptimizer = new PerformanceOptimizer()

