export interface McpStructuredErrorShape {
  [key: string]: unknown;
  code: string;
  message: string;
  retryable: boolean;
  upstream_status?: number;
}

export class McpStructuredError extends Error {
  code: string;
  retryable: boolean;
  upstream_status?: number;

  constructor(params: McpStructuredErrorShape) {
    super(params.message);
    this.name = "McpStructuredError";
    this.code = params.code;
    this.retryable = params.retryable;
    this.upstream_status = params.upstream_status;
  }
}

export function createMcpError(params: McpStructuredErrorShape): McpStructuredError {
  return new McpStructuredError(params);
}

export function normalizeMcpError(error: unknown): McpStructuredErrorShape {
  if (error instanceof McpStructuredError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      upstream_status: error.upstream_status,
    };
  }

  if (error instanceof Error) {
    const candidate = error as Error & Partial<McpStructuredErrorShape>;
    if (typeof candidate.code === "string" && typeof candidate.retryable === "boolean") {
      return {
        code: candidate.code,
        message: error.message,
        retryable: candidate.retryable,
        upstream_status: candidate.upstream_status,
      };
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    code: "INTERNAL_ERROR",
    message,
    retryable: false,
  };
}

export function toMcpErrorResponse(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: McpStructuredErrorShape;
  isError: true;
} {
  const normalized = normalizeMcpError(error);
  return {
    content: [{ type: "text", text: `ERROR: ${normalized.message}` }],
    structuredContent: normalized,
    isError: true,
  };
}
