import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      // React 19 ile gelen bu kontroller mevcut UI akışında yaygın davranış
      // değişikliği gerektiriyor; ayrı bir refactor fazında ele alınacak.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
    },
  },
  {
    ignores: [".playwright-mcp/**", "data/**", "prisma/data/**", ".next/**", "playwright-report/**", "test-results/**"],
  },
];

export default config;
