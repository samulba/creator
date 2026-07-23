import { env } from "@/src/env";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "healthy",
    service: "creator",
    environment: env.NODE_ENV,
  });
}
