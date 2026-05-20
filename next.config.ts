import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/asistencia/generate": ["./src/lib/asistencia/fonts/**/*"],
  },
};

export default nextConfig;
