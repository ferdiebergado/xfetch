# fetchx

## Overview

`fetchx` is a simple, yet powerful, HTTP client designed to handle common API interactions with built-in support for token-based authentication and automatic token renewal.

## Initialization

To use the client, simply create a new instance with your API's base URL.

```ts
import { APIClient } from '@ferdiebergado/fetchx';

const client = new APIClient({ baseUrl: 'https://api.your-domain.com' });
```

## Authentication

The client supports setting an access token for authorized requests. It also includes a mechanism to automatically renew the token when it's expired.

### Setting an Access Token

You can manually set the access token and its expiration time (in milliseconds since the epoch).

```ts
const accessToken = 'your_access_token';
const expiresIn = 3600; // seconds
const expiresAt = Date.now() + expiresIn * 1000;

client.setAccessToken(accessToken, expiresAt);
```

### Automatic Token Renewal

To enable automatic token renewal, you must provide a handler function that returns a new token and its expiration time.

```ts
async function renewTokenHandler() {
  // Call your token renewal endpoint
  const response = await fetch('https://api.example.com/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  return {
    accessToken: data.newAccessToken,
    expiresAt: Date.now() + data.expiresIn * 1000,
  };
}

client.setTokenRenewHandler(renewTokenHandler);
```

When an authorized request is made, the client will check the token's expiration. If it's expired, it will call your `renewTokenHandler` once and wait for the new token before proceeding with the request. This prevents race conditions where multiple requests try to renew the token simultaneously.

## CSRF Protection

For state-changing requests (POST, PUT, PATCH, DELETE), the client automatically includes a CSRF token header if a token cookie is present.

- By default:
  - Cookie name: XSRF-TOKEN
  - Header name: X-CSRF-Token

- You can override these via the constructor options:

```ts
const client = new APIClient({
  baseUrl: 'https://api.your-domain.com',
  csrfCookieName: 'MY-CSRF',
  csrfHeaderName: 'X-MY-CSRF',
});
```

The CSRF token is read from `document.cookie` and added to the request headers.
This requires your backend to issue a CSRF cookie and validate the header.

## Making Requests

The client provides helper methods for common HTTP verbs. For authorized requests, you must pass `true` as the last argument.

⚠️ **Important**: The request method helpers (get, post, etc.) always return the parsed JSON body of the response, not the raw Response object.

### GET Request

```ts
try {
  const data = await client.get<{ id: number; name: string }>(
    '/users/me',
    undefined,
    true
  );
  console.log(data.name);
} catch (error) {
  // Handle the error
}
```

### POST Request

```ts
const newUser = {
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
};

try {
  const createdUser = await client.post<{ id: number; name: string }>(
    '/users',
    newUser
  );
  console.log(createdUser.id);
} catch (error) {
  // Handle the error
}
```

### PUT, PATCH, and DELETE

The usage is similar for `put`, `patch`, and `delete`. The `put` and `patch` methods also accept a request body.

```ts
// Update user's name
await client.patch('/users/123', { name: 'John Doe' });

// Authorized deletion (includes access token + CSRF)
await client.delete('/users/456', undefined, true);
```

## Error Handling

The client will throw an `HTTPError` for any API response with a non-success status code (e.g., 4xx or 5xx). This makes it easy to handle specific errors.

```ts
import { HTTPError } from '@ferdiebergado/fetchx';

try {
  await client.get('/non-existent-resource');
} catch (error) {
  if (error instanceof HTTPError) {
    console.error(`Request failed with status: ${error.status}`);
    console.error('Response body:', error.responseBody);
  } else {
    console.error('An unexpected error occurred:', error);
  }
}
```

## Complete Example

This example demonstrates a full lifecycle with a refresh handler.

```ts
import { APIClient, HTTPError } from '@ferdiebergado/fetchx';

async function main() {
  const client = new APIClient({ baseUrl: 'https://api.your-domain.com' });

  client.setTokenRenewHandler(async () => {
    console.log('Token expired, renewing...');
    const response = await fetch('https://api.your-domain.com/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    return {
      accessToken: data.newAccessToken,
      expiresAt: Date.now() + data.expiresIn * 1000,
    };
  });

  // Simulate expired token
  client.setAccessToken('expired_token', Date.now() - 1000);

  try {
    const userProfile = await client.get<{ id: number; name: string }>(
      '/profile',
      undefined,
      true
    );
    console.log(
      'Successfully fetched profile after token renewal:',
      userProfile
    );
  } catch (error) {
    if (error instanceof HTTPError) {
      console.error(`HTTP Error: ${error.status}`);
    } else {
      console.error(`An unknown error occurred:`, error);
    }
  }
}

main();
```
