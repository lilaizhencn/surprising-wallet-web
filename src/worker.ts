type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  APPROVAL_UPSTREAM_ORIGIN: string;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/approval/service/')) {
      return new Response('Not found', { status: 404 });
    }
    if (!url.pathname.startsWith('/approval/v1/')) {
      return env.ASSETS.fetch(request);
    }

    const upstream = new URL(env.APPROVAL_UPSTREAM_ORIGIN);
    if (upstream.protocol !== 'https:' || upstream.pathname !== '/' || upstream.search || upstream.hash) {
      return new Response('Approval service unavailable', { status: 503 });
    }
    upstream.pathname = url.pathname;
    upstream.search = url.search;
    try {
      const upstreamRequest = new Request(upstream, request);
      for (const name of ['Origin', 'Cookie', 'X-Approval-CSRF']) {
        const value = request.headers.get(name);
        if (value) upstreamRequest.headers.set(name, value);
      }
      const response = await fetch(upstreamRequest);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch {
      return new Response('Approval service temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  },
};
