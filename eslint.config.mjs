import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";
import globals from "globals";

/** @type {import("eslint").Linter.Config[]} */
export default [
    // Base JavaScript recommended rules
    js.configs.recommended,

    // TypeScript files configuration for src/
    {
        files: ["src/**/*.ts", "src/**/*.tsx"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
                // Add specific missing globals if any
                GeoJSON: "readonly",
                NodeJS: "readonly",
                React: "readonly",
                ScrollBehavior: "readonly",
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            "react": reactPlugin,
            "react-hooks": reactHooksPlugin,
            "@next/next": nextPlugin,
        },
        rules: {
            // TypeScript rules
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "no-unused-vars": "off", // Use TypeScript's version

            // React rules
            "react/react-in-jsx-scope": "off", // Not needed in Next.js
            "react/prop-types": "off", // Using TypeScript

            // React Hooks rules
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",

            // Next.js rules
            "@next/next/no-img-element": "off",
            "@next/next/no-html-link-for-pages": "error",
        },
        settings: {
            react: {
                version: "detect",
            },
        },
    },

    // Ignore patterns
    {
        ignores: [
            "node_modules/**",
            ".next/**",
            "out/**",
            "public/**",
            "testing/**",
            "scripts/**",
            "migrations/**",
            "*.config.js",
            "*.config.mjs",
            "*.config.ts",
            "drizzle.config.ts",
            "playwright.config.ts",
            "fix_*.js",
            "debug_*.js",
            "fix_*.ps1",
        ],
    },
];
