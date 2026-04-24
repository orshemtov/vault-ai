import { requestUrl } from "obsidian";

export async function getJson<T>(
  url: string,
  headers: Record<string, string> = {}
): Promise<T> {
  const response = await requestUrl({
    url,
    method: "GET",
    headers,
    throw: false
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${response.text}`);
  }

  return response.json as T;
}

export async function postJson<TResponse>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<TResponse> {
  const response = await requestUrl({
    url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body),
    throw: false
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${response.text}`);
  }

  return response.json as TResponse;
}

export async function postStream(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  onChunk: (chunk: string) => void,
  _signal?: AbortSignal
): Promise<string> {
  const response = await requestUrl({
    url,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: JSON.stringify(body),
    throw: false
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${response.text}`);
  }

  if (response.text) {
    onChunk(response.text);
  }

  return response.text;
}
