export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = "ApiError"; }
}

/** Reverse proxies and failed development builds can return HTML or an empty body. */
export async function responseJson<T>(response: Response): Promise<T> {
  const raw = await response.text();
  let result: unknown;
  try { result = raw.trim() ? JSON.parse(raw) : null; } catch { result = null; }
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new ApiError(response.status === 401 ? "Your session expired. Please sign in again."
      : "The server did not return a valid response. Your changes have not been confirmed. Please retry.", response.status);
  }
  if (!response.ok) {
    const error = (result as { error?: unknown }).error;
    throw new ApiError(typeof error === "string" ? error : "The request failed. Please try again.", response.status);
  }
  return result as T;
}
