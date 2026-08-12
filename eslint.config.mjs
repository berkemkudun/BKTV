import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

/** Next 16 flat config — eslint-config-next artık doğrudan flat config export ediyor. */
const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...coreWebVitals,
  ...typescriptConfig,
];

export default eslintConfig;
