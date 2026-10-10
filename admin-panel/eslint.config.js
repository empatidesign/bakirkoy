// ESLint v9 flat config
import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'public/**',
      'vite.config.ts',
      'playwright.config.ts',
      'check403.mjs',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        navigator: 'readonly',
        FormData: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        AbortController: 'readonly',
        RequestInit: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        Node: 'readonly',
        MutationObserver: 'readonly',
        ResizeObserver: 'readonly',
        IntersectionObserver: 'readonly',
        WebSocket: 'readonly',
        process: 'readonly',
        crypto: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        structuredClone: 'readonly',
        globalThis: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-undef': 'off',
      'no-case-declarations': 'off',
    },
  },
  {
    // F19 (denetim 2026-09-16): Playwright fixture dosyaları (tests/e2e/helpers) kendi
    // API deseninde React ile alakasız "use" adlı bir callback parametresi kullanır
    // (`test.extend<{}, ...>(...)`, `async ({}, use, ...) => ...`) — bunlar gerçek React
    // Hook'ları DEĞİL, react-hooks/rules-of-hooks isim eşleşmesiyle yanlış-pozitif
    // üretiyor. Boş obje tipi/pattern'i de Playwright'ın kendi fixture imzası.
    files: ['tests/e2e/fixtures/**/*.ts', 'tests/e2e/helpers/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-empty-pattern': 'off',
      'no-unsafe-finally': 'off',
    },
  },
  {
    // F19 (denetim 2026-09-16): tests/**/*.mjs ve tools/**/*.mjs gibi Node script'leri
    // yalnızca **/*.{ts,tsx} eşleşen üstteki globals bloğuna hiç girmiyordu — js.configs.recommended'ın
    // varsayılan (hiçbir global tanımlamayan) kuralları devrede kaldığı için process/console/
    // fetch/setTimeout "tanımsız" sayılıyordu. Playwright test dosyalarındaki `({}, use) => {}`
    // fixture imzası da aynı nedenle empty-object-pattern kuralına takılıyordu (bkz. yukarıdaki
    // Playwright fixture override'ı — burada da tekrarlanır çünkü .spec.ts dosyaları bu bloğa girer).
    files: ['tests/**/*.{ts,mjs}', 'tools/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        globalThis: 'readonly',
      },
    },
    rules: {
      'no-useless-escape': 'off',
      'no-undef': 'off',
      'no-empty-pattern': 'off',
    },
  },
]
