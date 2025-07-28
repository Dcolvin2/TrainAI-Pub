import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Strict unused variable detection
      "@typescript-eslint/no-unused-vars": ["error", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      
      // No explicit any types
      "@typescript-eslint/no-explicit-any": "error",
      
      // Require explicit return types on functions
      "@typescript-eslint/explicit-function-return-type": "warn",
      
      // No console.log in production (but allow console.error)
      "no-console": ["warn", { "allow": ["error", "warn", "info"] }],
      
      // Enforce consistent naming
      "@typescript-eslint/naming-convention": [
        "error",
        {
          "selector": "variable",
          "format": ["camelCase", "UPPER_CASE", "PascalCase"]
        }
      ],
      
      // React specific rules
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
      
      // Import rules
      "import/no-unused-modules": "error",
      "import/no-unresolved": "error"
    }
  },
  {
    // Apply to all TypeScript files
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true
        }
      }
    }
  }
];

export default eslintConfig;
