import { NextResponse } from "next/server";

export function withApi<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try { return await handler(...args); }
    catch (cause) {
      console.error("API request failed:", cause instanceof Error ? cause.name : "Unknown error");
      return NextResponse.json({ error: "The server could not complete this request. Please retry in a moment." }, { status:503, headers:{"Cache-Control":"no-store"} });
    }
  };
}

export function databaseMessage(error: {code?: string}, fallback: string): string {
  return ["PGRST202","PGRST204","PGRST205","42P01","42703","42883"].includes(error.code || "")
    ? "The database update is not installed yet. Apply the pending Plated migrations through 0004, then retry."
    : fallback;
}
