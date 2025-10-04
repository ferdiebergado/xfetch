export const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

type HTTPMethod = (typeof httpMethods)[number];

export interface RequestOpts {
  method?: HTTPMethod;
  path: string;
  data?: Record<string, unknown>;
  opts?: RequestInit;
  isAuthorized?: boolean;
}

export type RequestDataHandler = <T>(
  path: string,
  data?: Record<string, unknown>,
  opts?: RequestInit,
  isAuthorized?: boolean
) => Promise<T>;

export type RequestHandler = <T>(
  path: string,
  opts?: RequestInit,
  isAuthorized?: boolean
) => Promise<T>;

export interface HTTPClient {
  doRequest: <T>(opts: RequestOpts) => Promise<T>;
  get: RequestHandler;
  post: RequestDataHandler;
  put: RequestDataHandler;
  patch: RequestDataHandler;
  delete: RequestHandler;
}

export type TokenRenewHandler = () => Promise<{
  accessToken: string;
  expiresAt: number;
}>;

export interface APIClientOptions {
  baseUrl: string;
  csrfHeaderName: string;
  csrfCookieName: string;
  maxPayloadSize: number;
  trustedDomains: string[];
}
