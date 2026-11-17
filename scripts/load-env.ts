// Loaded first by CLI entry points: .env.local overrides .env (same as Next.js).
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
