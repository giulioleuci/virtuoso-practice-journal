import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Vendored shadcn/ui primitives intentionally export variant helpers and
    // hooks alongside their components; fast-refresh granularity is irrelevant
    // for this leaf library, so the rule is scoped out here.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // UI layer must not write to the DB directly — route writes through services.
    // Reads should flow through hooks (useEntities). Type-only `db` imports are fine.
    files: ["src/pages/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.object.name='db'][callee.property.name=/^(add|put|update|delete|bulkAdd|bulkPut|bulkDelete|bulkUpdate|clear|modify)$/]",
          message:
            "Do not write to `db.<table>` from the UI layer. Use a service in @/lib/services instead.",
        },
      ],
    },
  },
);
