import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  engine: "js",
  adapter: async () =>
    new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  datasource: {
    url: process.env.DIRECT_URL!,
  },
});
