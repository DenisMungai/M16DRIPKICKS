import { httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../server/router';
import { isResponseEnvelope, responseError } from './trpc-response';

export const trpc = createTRPCReact<AppRouter>();

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
