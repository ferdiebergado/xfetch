export function getCookie(cookieName: string): string {
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    // Split only on the first '=' to get the name and value safely
    const eqIndex = cookie.indexOf('=');
    if (eqIndex === -1) continue; // Malformed cookie, skip
    const name = cookie.substring(0, eqIndex);
    const value = cookie.substring(eqIndex + 1);
    if (name === cookieName) {
      return value;
    }
  }
  return '';
}
