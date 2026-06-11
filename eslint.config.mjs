import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    // .claude/** covers agent worktrees (each carrying its own .next build
    // output and vendored assets) — never lint another checkout's artifacts.
    ignores: [".next/**", "node_modules/**", "data/gate_reports/*.json", "public/elk-worker.min.js", ".claude/**"],
  },
];

export default eslintConfig;
