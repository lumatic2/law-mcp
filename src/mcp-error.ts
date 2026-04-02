export function toMcpErrorResponse(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: `ERROR: ${message}` }],
    isError: true,
  };
}
