// WebTorrent dynamic loader and types helper

declare global {
  interface Window {
    WebTorrent?: any;
  }
}

let loadPromise: Promise<any> | null = null;

export const PUBLIC_TRACKERS = [
  'wss://tracker.btorrent.xyz',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.webtorrent.dev',
];

export async function loadWebTorrent(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('WebTorrent can only be loaded in a browser context.');
  }

  if (window.WebTorrent) {
    return window.WebTorrent;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists
    const existing = document.getElementById('webtorrent-script') as HTMLScriptElement | null;
    if (existing && window.WebTorrent) {
      resolve(window.WebTorrent);
      return;
    }

    const script = document.createElement('script');
    script.id = 'webtorrent-script';
    // Use fast cdnjs or jsdelivr for browserified webtorrent build
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/webtorrent/1.9.7/webtorrent.min.js';
    script.async = true;

    script.onload = () => {
      if (window.WebTorrent) {
        resolve(window.WebTorrent);
      } else {
        reject(new Error('WebTorrent script loaded but window.WebTorrent is undefined'));
      }
    };

    script.onerror = () => {
      // Fallback to jsdelivr if cdnjs fails
      const fallbackScript = document.createElement('script');
      fallbackScript.src = 'https://cdn.jsdelivr.net/npm/webtorrent@latest/webtorrent.min.js';
      fallbackScript.async = true;
      fallbackScript.onload = () => {
        if (window.WebTorrent) {
          resolve(window.WebTorrent);
        } else {
          reject(new Error('WebTorrent fallback failed to initialize.'));
        }
      };
      fallbackScript.onerror = () => {
        reject(new Error('Failed to load WebTorrent from both CDNs.'));
      };
      document.head.appendChild(fallbackScript);
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}
