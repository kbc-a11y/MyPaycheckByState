import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

async function handleEvent(event) {
  const url = new URL(event.request.url);
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    // Forward to the appropriate API handler
    if (url.pathname === '/api/calculate' && event.request.method === 'POST') {
      return await import('../functions/api/calculate.js')
        .then(module => module.onRequestPost(event));
    }
    if (url.pathname === '/api/states' && event.request.method === 'GET') {
      return await import('../functions/api/states.js')
        .then(module => module.onRequestGet(event));
    }
  }

  try {
    // Serve static assets
    return await getAssetFromKV(event);
  } catch (e) {
    return new Response('Not Found', { status: 404 });
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleEvent(event));
});
