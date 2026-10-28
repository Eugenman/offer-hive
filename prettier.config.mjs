/** @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions} */
const config = {
  printWidth: 110,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  plugins: ["prettier-plugin-tailwindcss"],
  // Tailwind v4: the plugin reads the theme (custom variants, colors) from the CSS entry point.
  tailwindStylesheet: "./src/app/globals.css",
  // Sort classes inside these helpers too, not only in className="…".
  tailwindFunctions: ["cn", "cva"],
};

export default config;
