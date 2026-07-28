/** Client-safe API error payload — never forward upstream exception text. */
export function publicApiError(message = "Request failed") {
  return { error: message };
}
