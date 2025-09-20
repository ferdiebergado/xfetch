/**
 * Custom error for HTTP requests with status code and response body.
 */
export class HTTPError extends Error {
  status: number;
  responseBody: Record<string, unknown> | string;

  constructor(
    status: number,
    message: string,
    responseBody: Record<string, unknown> | string
  ) {
    super(message);
    this.name = 'HTTPError';
    this.status = status;
    this.responseBody = responseBody;
  }
}
