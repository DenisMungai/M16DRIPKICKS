type ResponseEnvelope = { result?: unknown; error?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isResponseEnvelope(value: unknown): value is ResponseEnvelope | ResponseEnvelope[] {
  const isEnvelope = (item: unknown): item is ResponseEnvelope => {
    if (!isRecord(item)) return false;

    if (isRecord(item.result) && ('data' in item.result || typeof item.result.type === 'string')) {
      return true;
    }

    if (!isRecord(item.error) || typeof item.error.message !== 'string' || typeof item.error.code !== 'number') {
      return false;
    }
    return isRecord(item.error.data) && typeof item.error.data.code === 'string';
  };

  return Array.isArray(value) ? value.length > 0 && value.every(isEnvelope) : isEnvelope(value);
}

export function responseError(response: Response, payload: unknown, body: string, isJson: boolean) {
  const apiError = isRecord(payload) ? payload.error : undefined;
  const code = isRecord(payload) ? payload.code : undefined;
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
