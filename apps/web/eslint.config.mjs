import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * The public site and the ERP never import each other. Anything both need belongs in
 * packages/* (@mrac/ui, @mrac/api, @mrac/auth, @mrac/db).
 */
const noCrossSurface = (other) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: [`**/(${other})/**`, `@/app/(${other})/**`],
          message: `Don't import ${other} code here. Move shared code to a packages/* package.`,
        },
      ],
    },
  ],
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
  { files: ["app/(public)/**"], rules: noCrossSurface("erp") },
  { files: ["app/(erp)/**"], rules: noCrossSurface("public") },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
