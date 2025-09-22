import { HTTPError } from './http-error';
import {
  APIClientOptions,
  httpMethods,
  type HTTPClient,
  type RequestData,
  type RequestOpts,
  type TokenRenewHandler,
} from './types';

/**
 * APIClient is a generic HTTP client for interacting with RESTful APIs.
 * It supports automatic access token management, including token renewal via a handler,
 * and provides convenience methods for standard HTTP requests (GET, POST, PUT, PATCH, DELETE).
 * APIClient handles authorization headers, error handling, and request configuration,
 * making it easy to integrate with APIs that require bearer tokens and token expiration logic.
 */
export class APIClient implements HTTPClient {
  #options: APIClientOptions;
  #accessToken?: string;
  #expiresAt?: number;
  #renewTokenHandler?: TokenRenewHandler;
  #renewing?: Promise<void>;
  readonly #originalFetch = fetch;

  constructor(options?: Partial<APIClientOptions>) {
    this.#options = {
      csrfCookieName: 'XSRF-TOKEN',
      csrfHeaderName: 'X-CSRF-Token',
      baseUrl: '',
      ...options,
    };
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

  /**
   * Clears the access token and its expiration time.
   */
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

  /**
   * Performs an HTTP request with the specified options.
   * Handles authorization and error processing.
   */
  async doRequest<T>({
    method = 'GET',
    path,
    data,
    opts = {},
    isAuthorized = false,
  }: RequestOpts): Promise<T> {
    if (!path || typeof path !== 'string' || !path.startsWith('/')) {
      throw new Error('path must be a non-empty string starting with a slash.');
    }

    if (!httpMethods.includes(method)) {
      throw new Error(`Invalid HTTP method: ${method}`);
    }

    if (isAuthorized) {
      await this.#ensureValidToken();
    }

    const url = this.#options.baseUrl + path;
    const headers = new Headers(opts.headers);

    const methodsWithBody = ['POST', 'PUT', 'PATCH'];
    if (methodsWithBody.includes(method) && data) {
      headers.set('Content-Type', 'application/json');
      opts.body = JSON.stringify(data);
    }

    if (isAuthorized && this.#accessToken) {
      headers.set('Authorization', `Bearer ${this.#accessToken}`);
    }

    if ([...methodsWithBody, 'DELETE'].includes(method)) {
      const csrfToken = this.#getCsrfToken();

      if (csrfToken) headers.set(this.#options.csrfHeaderName, csrfToken);
    }

    const mergedOpts: RequestInit = {
      ...opts,
      method,
      headers,
    };

    // Perform the fetch request
    const response = await this.#originalFetch(url, mergedOpts);

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

    return response.json() as T;
  }

  /**
   * Sends an HTTP GET request to the specified path.
   * @param path The request path starting with a slash.
   * @param opts Optional request options.
   * @param isAuthorized Whether to use authorization.
   */
  async get<T>(
    path: string,
    opts?: RequestInit,
    isAuthorized?: boolean
  ): Promise<T> {
    return this.doRequest<T>({
      path,
      opts,
      isAuthorized,
    });
  }

  /**
   * Sends an HTTP POST request to the specified path with the given body.
   * @param path The request path starting with a slash.
   * @param data Optional request payload.
   * @param opts Optional request options.
   * @param isAuthorized Whether to use authorization.
   */
  async post<T>(
    path: string,
    data?: RequestData,
    opts?: RequestInit,
    isAuthorized?: boolean
  ): Promise<T> {
    return this.doRequest<T>({
      method: 'POST',
      path,
      data,
      opts,
      isAuthorized,
    });
  }

  /**
   * Sends an HTTP PUT request to the specified path with the given body.
   * @param path The request path starting with a slash.
   * @param data Optional request payload.
   * @param opts Optional request options.
   * @param isAuthorized Whether to use authorization.
   */
  async put<T>(
    path: string,
    data?: RequestData,
    opts?: RequestInit,
    isAuthorized?: boolean
  ): Promise<T> {
    return this.doRequest<T>({
      method: 'PUT',
      path,
      data,
      opts,
      isAuthorized,
    });
  }

  /**
   * Sends an HTTP PATCH request to the specified path with the given body.
   * @param path The request path starting with a slash.
   * @param data Optional request payload.
   * @param opts Optional request options.
   * @param isAuthorized Whether to use authorization.
   */
  async patch<T>(
    path: string,
    data?: RequestData,
    opts?: RequestInit,
    isAuthorized?: boolean
  ): Promise<T> {
    return this.doRequest<T>({
      method: 'PATCH',
      path,
      data,
      opts,
      isAuthorized,
    });
  }

  /**
   * Sends an HTTP DELETE request to the specified path.
   * @param path The request path starting with a slash.
   * @param opts Optional request options.
   * @param isAuthorized Whether to use authorization.
   */
  async delete<T>(
    path: string,
    opts?: RequestInit,
    isAuthorized?: boolean
  ): Promise<T> {
    return this.doRequest<T>({
      method: 'DELETE',
      path,
      opts,
      isAuthorized,
    });
  }

  #getCsrfToken(): string {
    const tokenCookie = document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith(`${this.#options.csrfCookieName}=`));

    if (!tokenCookie) return '';

    const token = tokenCookie.split('=')[1];
    return token ?? '';
  }
}
