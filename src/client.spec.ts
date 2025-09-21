import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIClient } from './client';
import { HTTPError } from './http-error';

const mockFetch = vi.fn();

// Mock a simple Response class to simulate the real one
class MockResponse {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  headers: Headers;

  constructor(
    body: Record<string, unknown>,
    init: { status: number; ok: boolean; headers?: Headers }
  ) {
    this.ok = init.ok;
    this.status = init.status;
    this.data = body;
    this.headers = new Headers(init.headers);
  }

  json() {
    return Promise.resolve(this.data);
  }

  text() {
    return Promise.resolve(JSON.stringify(this.data));
  }
}

// Global mock for fetch
globalThis.fetch = mockFetch;

describe('APIClient', () => {
  const baseURL = 'https://api.example.com';
  let client: APIClient;

  beforeEach(() => {
    // Reset the mock before each test
    vi.clearAllMocks();
    client = new APIClient(baseURL);
  });

  describe('doRequest', () => {
    it('should throw an error if the path does not start with a slash', async () => {
      await expect(client.doRequest({ path: 'users/1' })).rejects.toThrow(
        'path must be a non-empty string starting with a slash.'
      );
    });

    it('should make a GET request and set the correct URL', async () => {
      mockFetch.mockResolvedValue(
        new MockResponse({ id: 1 }, { status: 200, ok: true })
      );

      const path = '/users';
      await client.doRequest({ path });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}${path}`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Headers),
        })
      );
    });

    it('should make a POST request with a JSON body and correct headers', async () => {
      mockFetch.mockResolvedValue(
        new MockResponse({ id: 1 }, { status: 201, ok: true })
      );

      const path = '/users';
      const body = { name: 'Test User' };
      await client.doRequest({ method: 'POST', path, body });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}${path}`,
        expect.objectContaining({
          method: 'POST',

          body: JSON.stringify(body),
        })
      );

      const requestOpts = mockFetch.mock.calls[0]?.[1];
      expect(requestOpts.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('Token Management', () => {
    it('should not add Authorization header if useAuth is false', async () => {
      mockFetch.mockResolvedValue(
        new MockResponse({ id: 1 }, { status: 200, ok: true })
      );
      client.setAccessToken('test-token', Date.now() + 60000);

      await client.doRequest({
        path: '/users/me',
        isAuthorized: false,
      });

      const requestOptions = mockFetch.mock.calls[0]?.[1];
      expect(requestOptions.headers.has('Authorization')).toBe(false);
    });

    it('should add Authorization header if useAuth is true and token is set', async () => {
      mockFetch.mockResolvedValue(
        new MockResponse({ id: 1 }, { status: 200, ok: true })
      );
      const token = 'valid-token';
      client.setAccessToken(token, Date.now() + 60000);

      await client.doRequest({
        path: '/users/me',
        isAuthorized: true,
      });

      const requestOptions = mockFetch.mock.calls[0]?.[1];
      expect(requestOptions.headers.get('Authorization')).toBe(
        `Bearer ${token}`
      );
    });

    it("should renew the token if it's expired and a renew handler is available", async () => {
      const renewTokenHandler = vi.fn().mockResolvedValue({
        accessToken: 'new-valid-token',
        expiresAt: Date.now() + 60000,
      });

      // Set an expired token
      client.setAccessToken('old-expired-token', Date.now() - 1000);
      client.setTokenRenewHandler(renewTokenHandler);

      mockFetch.mockResolvedValue(
        new MockResponse({ id: 1 }, { status: 200, ok: true })
      );

      await client.doRequest({
        path: '/users/me',
        isAuthorized: true,
      });

      // Expect the renew handler to have been called
      expect(renewTokenHandler).toHaveBeenCalled();

      // Expect the request to be made with the new token
      const requestOptions = mockFetch.mock.calls[0]?.[1];
      expect(requestOptions.headers.get('Authorization')).toBe(
        `Bearer new-valid-token`
      );
    });

    it('should throw an error if the token is expired and no renew handler is set', async () => {
      // Set an expired token
      client.setAccessToken('old-expired-token', Date.now() - 1000);

      await expect(
        client.doRequest({
          path: '/users/me',
          isAuthorized: true,
        })
      ).rejects.toThrow('Access token expired and no renew handler set.');
    });

    it('should handle token renewal race conditions correctly', async () => {
      const renewTokenHandler = vi.fn().mockResolvedValue({
        accessToken: 'new-valid-token',
        expiresAt: Date.now() + 60000,
      });

      client.setAccessToken('old-expired-token', Date.now() - 1000);
      client.setTokenRenewHandler(renewTokenHandler);

      mockFetch.mockResolvedValue(
        new MockResponse({ id: 1 }, { status: 200, ok: true })
      );

      // Simulate two concurrent requests that both need to renew the token
      const request1 = client.doRequest({
        path: '/users/me',
        isAuthorized: true,
      });
      const request2 = client.doRequest({
        path: '/users/me',
        isAuthorized: true,
      });

      // Wait for both requests to complete
      await Promise.all([request1, request2]);

      // The token renewal handler should have only been called once
      expect(renewTokenHandler).toHaveBeenCalledTimes(1);

      // Both requests should have been made with the newly renewed token
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const requestOptions1 = mockFetch.mock.calls[0]?.[1];
      const requestOptions2 = mockFetch.mock.calls[1]?.[1];
      expect(requestOptions1.headers.get('Authorization')).toBe(
        'Bearer new-valid-token'
      );
      expect(requestOptions2.headers.get('Authorization')).toBe(
        'Bearer new-valid-token'
      );
    });
  });

  describe('HTTP methods', () => {
    const path = '/data';
    const body = { data: 'test' };
    const mockResponse = new MockResponse(
      { success: true },
      { status: 200, ok: true }
    );

    it('get should call doRequest with GET method', async () => {
      mockFetch.mockResolvedValue(mockResponse);
      await client.get(path);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}${path}`,
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('post should call doRequest with POST method and body', async () => {
      mockFetch.mockResolvedValue(mockResponse);
      await client.post(path, body);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}${path}`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
    });

    it('put should call doRequest with PUT method and body', async () => {
      mockFetch.mockResolvedValue(mockResponse);
      await client.put(path, body);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}${path}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(body),
        })
      );
    });

    it('patch should call doRequest with PATCH method and body', async () => {
      mockFetch.mockResolvedValue(mockResponse);
      await client.patch(path, body);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}${path}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      );
    });

    it('delete should call doRequest with DELETE method', async () => {
      mockFetch.mockResolvedValue(mockResponse);
      await client.delete(path);
      expect(mockFetch).toHaveBeenCalledWith(
        `${baseURL}${path}`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw an HTTPError for a non-ok response', async () => {
      const errorResponse = { message: 'Not Found' };
      mockFetch.mockResolvedValue(
        new MockResponse(errorResponse, { status: 404, ok: false })
      );

      const path = '/non-existent-resource';
      const request = client.doRequest({ path });

      await expect(request).rejects.toThrow(HTTPError);
      await expect(request).rejects.toThrow('Request failed with status 404');

      try {
        await request;
      } catch (error) {
        const httpError = error as HTTPError;
        expect(httpError.status).toBe(404);
        expect(httpError.responseBody).toEqual(errorResponse);
      }
    });

    it('should handle non-JSON error responses gracefully', async () => {
      mockFetch.mockResolvedValue(
        new MockResponse(
          { message: 'Internal Server Error' },
          { status: 500, ok: false }
        )
      );

      const path = '/server-error';
      const request = client.doRequest({ path });

      await expect(request).rejects.toThrow(HTTPError);

      try {
        await request;
      } catch (error) {
        const httpError = error as HTTPError;
        expect(httpError.status).toBe(500);
        // Expect a default message if JSON parsing fails
        expect(httpError.responseBody).toEqual({
          message: 'Internal Server Error',
        });
      }
    });
  });
});
