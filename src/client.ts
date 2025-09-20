import { HTTPError } from './http-error';
import type {
  HTTPClient,
  RequestData,
  RequestOpts,
  TokenRenewHandler,
} from './types';

export class APIClient implements HTTPClient {
  baseURL: string;
  #accessToken?: string;
  #expiresAt?: number;
  #renewTokenHandler?: TokenRenewHandler; // Provided by user to get new token
  #renewing?: Promise<void>;

  constructor(baseURL: string) {
    if (!baseURL || typeof baseURL !== 'string') {
      throw new Error('baseURL must be a non-empty string.');
    }
    this.baseURL = baseURL;
  }

  /**
   * Set the access token and its expiration time (in milliseconds since epoch).
   */
  setAccessToken(token: string, expiresAt: number) {
    this.#accessToken = token;
    this.#expiresAt = expiresAt;
  }

  /**
   * Optionally set a handler to renew the token when expired.
   */
  setTokenRenewHandler(handler: TokenRenewHandler) {
    this.#renewTokenHandler = handler;
  }

  clearAccessToken() {
    this.#accessToken = undefined;
    this.#expiresAt = undefined;
  }

  /**
   * Returns true if token is expired (or not set).
   */
  #isTokenExpired(): boolean {
    if (!this.#accessToken || !this.#expiresAt) return true;
    // Buffer 10 seconds for safety
    return Date.now() > this.#expiresAt - 10000;
  }

  /**
   * Ensures the access token is valid, attempts to renew if expired.
   */
  async #ensureValidToken(): Promise<void> {
    if (this.#isTokenExpired()) {
      if (this.#renewing) {
        // Wait for renewal in progress
        await this.#renewing;
      } else if (this.#renewTokenHandler) {
        // Start renewal and set flag
        this.#renewing = this.#renewTokenHandler()
          .then(({ accessToken, expiresAt }) => {
            this.setAccessToken(accessToken, expiresAt);
          })
          .finally(() => {
            this.#renewing = undefined;
          });
        await this.#renewing;
      } else {
        throw new Error('Access token expired and no renew handler set.');
      }
    }
  }

  async doRequest({
    method,
    path,
    body,
    opts = {},
    isAuthorized: isAuthorized = false,
  }: RequestOpts): Promise<Response> {
    if (!path || typeof path !== 'string' || !path.startsWith('/')) {
      throw new Error('path must be a non-empty string starting with a slash.');
    }

    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    if (!validMethods.includes(method)) {
      throw new Error(`Invalid HTTP method: ${method}`);
    }

    if (isAuthorized) {
      await this.#ensureValidToken();
    }

    const url = this.baseURL + path;
    const headers = new Headers(opts.headers);

    const methodsWithBody = ['POST', 'PUT', 'PATCH'];
    if (methodsWithBody.includes(method) && body) {
      headers.set('Content-Type', 'application/json');
      opts.body = JSON.stringify(body);
    }

    if (isAuthorized && this.#accessToken) {
      headers.set('Authorization', `Bearer ${this.#accessToken}`);
    }

    const mergedOpts: RequestInit = {
      ...opts,
      method,
      headers,
    };

    // Perform the fetch request
    const response = await fetch(url, mergedOpts);

    // Check for non-successful status codes and throw a custom error
    if (!response.ok) {
      let errorBody: Record<string, unknown> | string = 'Unknown Error';
      try {
        errorBody = (await response.json()) as Record<string, unknown>;
      } catch {
        // If the response body is not JSON, use the plain text
        errorBody = await response.text();
      }

      throw new HTTPError(
        response.status,
        `Request failed with status ${response.status}`,
        errorBody
      );
    }

    return response;
  }

  async get(path: string, opts?: RequestInit, isAuthorized?: boolean) {
    return this.doRequest({
      method: 'GET',
      path,
      opts,
      isAuthorized: isAuthorized,
    });
  }

  async post(
    path: string,
    body: RequestData,
    opts?: RequestInit,
    isAuthorized?: boolean
  ) {
    return this.doRequest({
      method: 'POST',
      path,
      body,
      opts,
      isAuthorized: isAuthorized,
    });
  }

  async put(
    path: string,
    body: RequestData,
    opts?: RequestInit,
    isAuthorized?: boolean
  ) {
    return this.doRequest({
      method: 'PUT',
      path,
      body,
      opts,
      isAuthorized: isAuthorized,
    });
  }

  async patch(
    path: string,
    body: RequestData,
    opts?: RequestInit,
    isAuthorized?: boolean
  ) {
    return this.doRequest({
      method: 'PATCH',
      path,
      body,
      opts,
      isAuthorized: isAuthorized,
    });
  }

  async delete(path: string, opts?: RequestInit, isAuthorized?: boolean) {
    return this.doRequest({
      method: 'DELETE',
      path,
      opts,
      isAuthorized: isAuthorized,
    });
  }
}
