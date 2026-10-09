import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isResponseEnvelope, responseError } from '../../src/trpc-response.js';

describe('tRPC HTTP response validation', () => {
  it('accepts valid tRPC success and error envelopes', () => {
    assert.equal(isResponseEnvelope({ result: { data: { json: { id: 1 } } } }), true);
    assert.equal(isResponseEnvelope({
      error: {
        message: 'Email or password is incorrect.',
        code: -32001,
        data: { code: 'UNAUTHORIZED', httpStatus: 401 },
      },
    }), true);
  });

  it('rejects ordinary API errors instead of passing them to the tRPC transformer', () => {
    const payload = { error: 'Origin not allowed.', code: 'ORIGIN_NOT_ALLOWED' };
    assert.equal(isResponseEnvelope(payload), false);
    assert.equal(
      responseError(new Response(JSON.stringify(payload), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }), payload, JSON.stringify(payload), true),
      'The request was rejected because the store origin is not allowed. Check the production APP_URL setting.',
    );
  });
});
