import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../server/router';

export const trpc = createTRPCReact<AppRouter>();

type ResponseEnvelope = { result?: unknown; error?: unknown };

function isResponseEnvelope(value: unknown): value is ResponseEnvelope | ResponseEnvelope[] {
  const isEnvelope = (item: unknown): item is ResponseEnvelope =>
    typeof item === 'object' && item !== null && ('result' in item || 'error' in item);
  return Array.isArray(value) ? value.length > 0 && value.every(isEnvelope) : isEnvelope(value);
}

function responseError(response: Response, payload: unknown, body: string, isJson: boolean) {
  const apiError = typeof payload === 'object' && payload !== null && 'error' in payload
    ? (payload as { error?: unknown }).error
    : undefined;
  const code = typeof payload === 'object' && payload !== null && 'code' in payload
    ? (payload as { code?: unknown }).code
    : undefined;
  const message = typeof apiError === 'string' ? apiError.toLowerCase() : '';
  const vercelResponse = `${response.url} ${body}`.toLowerCase();

  if (code === 'ORIGIN_NOT_ALLOWED' || /origin not allowed|origin mismatch/.test(message)) {
    return 'The request was rejected because the store origin is not allowed. Check the production APP_URL setting.';
  }
  if (code === 'API_INITIALIZATION_FAILED' || code === 'API_DISPATCH_FAILED') {
    return 'The store API could not start. Please try again later or contact support.';
  }
  if (/vercel authentication|vercel sso|authentication required|sign in to vercel|\/_vercel\/|deployment_not_found/.test(vercelResponse)
    || ((response.status === 401 || response.status === 403) && (!isJson || response.redirected))) {
    return 'The store API is blocked by deployment protection or the deployment is unavailable.';
  }
  if (!isJson || response.status === 404 || response.status === 502 || response.status === 503) {
    return 'The store API deployment is unavailable or returned an unexpected response.';
  }
  if (response.status >= 500) {
    return 'The store API encountered a server error. Please try again later.';
  }
  return `The store API returned an unexpected response (${response.status}).`;
}

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      fetch: async (url, options) => {
        let response: Response;
        try {
          response = await fetch(url, { ...options, credentials: 'include' });
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') throw error;
          throw new Error('Could not reach the store API. Check your connection and the API origin/CORS configuration.', { cause: error });
        }

        const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
        const isJson = contentType.includes('application/json');
        const body = await response.clone().text();
        let payload: unknown;
        if (isJson) {
          try {
            payload = JSON.parse(body);
          } catch {
            payload = undefined;
          }
        }
        if (!isResponseEnvelope(payload)) {
          throw new Error(responseError(response, payload, body, isJson));
        }
        return response;
      },
    }),
  ],
});
