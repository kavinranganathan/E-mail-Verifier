import type { VerifyResult } from "./types.js";

// Typed client for the verify API. Hand-written for v1; PLAN: generate from the
// OpenAPI spec once the surface stabilizes so the client never drifts.

export interface ClientOptions {
  /** Base URL of the deployed API, e.g. https://your-app.vercel.app */
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class EmailVerifierError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "EmailVerifierError";
  }
}

export class EmailVerifierClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async verify(email: string): Promise<VerifyResult> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/verify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
      },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
      throw new EmailVerifierError(
        body?.error?.code ?? "http_error",
        body?.error?.message ?? `Request failed with status ${res.status}`,
        res.status,
      );
    }

    return (await res.json()) as VerifyResult;
  }
}
