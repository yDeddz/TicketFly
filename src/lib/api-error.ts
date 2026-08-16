import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export type ApiErrorBody = {
  error: string;
  code: string;
  message: string;
  requestId: string;
};

export function createRequestId(request?: Request) {
  const incoming = request?.headers.get("x-request-id")?.trim();
  if (incoming && incoming.length <= 64) return incoming;
  return randomUUID();
}

export function logServerError(args: {
  requestId: string;
  code: string;
  message: string;
  cause?: unknown;
  path?: string;
}) {
  const causeMessage =
    args.cause instanceof Error
      ? args.cause.message
      : typeof args.cause === "string"
        ? args.cause
        : undefined;

  console.error(
    JSON.stringify({
      level: "error",
      requestId: args.requestId,
      code: args.code,
      message: args.message,
      path: args.path,
      cause: causeMessage,
      at: new Date().toISOString(),
    }),
  );
}

export function apiError(
  status: number,
  args: {
    message: string;
    code?: string;
    requestId?: string;
    cause?: unknown;
    path?: string;
  },
) {
  const requestId = args.requestId ?? createRequestId();
  const code = args.code ?? (status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR");

  if (status >= 500 || args.cause) {
    logServerError({
      requestId,
      code,
      message: args.message,
      cause: args.cause,
      path: args.path,
    });
  }

  const body: ApiErrorBody = {
    error: args.message,
    code,
    message: args.message,
    requestId,
  };

  return NextResponse.json(body, {
    status,
    headers: { "x-request-id": requestId },
  });
}

export function apiOk<T extends Record<string, unknown>>(
  data: T,
  init?: { status?: number; requestId?: string },
) {
  const requestId = init?.requestId ?? createRequestId();
  return NextResponse.json(
    { ...data, requestId },
    {
      status: init?.status ?? 200,
      headers: { "x-request-id": requestId },
    },
  );
}
