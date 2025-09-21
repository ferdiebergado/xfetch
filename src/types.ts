export const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

type HTTPMethod = (typeof httpMethods)[number];

export type RequestData =
  | object
  | unknown[]
  | FormData
  | URLSearchParams
  | string;

export interface RequestOpts {
  method?: HTTPMethod;
  path: string;
  body?: RequestData;
  opts?: RequestInit;
  isAuthorized?: boolean;
}

export type RequestBodyHandler = (
  path: string,
  body: RequestData,
  opts?: RequestInit,
  isAuthorized?: boolean
) => Promise<Response>;

export type RequestHandler = (
  path: string,
  opts?: RequestInit,
  isAuthorized?: boolean
) => Promise<Response>;

export interface HTTPClient {
  doRequest: (opts: RequestOpts) => Promise<Response>;
  get: RequestHandler;
  post: RequestBodyHandler;
  put: RequestBodyHandler;
  patch: RequestBodyHandler;
  delete: RequestHandler;
}

export type TokenRenewHandler = () => Promise<{
  accessToken: string;
  expiresAt: number;
}>;
