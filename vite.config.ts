import { defineConfig, type Plugin } from "vite";
import { builtinModules } from "module";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import JavaScriptObfuscator from "javascript-obfuscator";

const nodeExternal = builtinModules.flatMap((m) => [m, `node:${m}`]);

const npmExternal = ["commander", "dotenv", "node-fetch", "nodemailer", "ora"];

function obfuscatorPlugin(): Plugin {
  return {
    name: "obfuscator",
    closeBundle() {
      const distDir = join(__dirname, "dist");

      const getJsFiles = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
          const p = join(dir, e.name);
          return e.isDirectory()
            ? getJsFiles(p)
            : e.name.endsWith(".js")
              ? [p]
              : [];
        });

      for (const file of getJsFiles(distDir)) {
        const src = readFileSync(file, "utf8");

        // Strip shebang before obfuscating so the obfuscator doesn't choke on it
        const shebangMatch = src.match(/^(#!.+\n)/);
        const shebang = shebangMatch ? shebangMatch[1] : "";
        const code = shebang ? src.slice(shebang.length) : src;

        const obfuscated = JavaScriptObfuscator.obfuscate(code, {
          compact: true,
          controlFlowFlattening: false,
          deadCodeInjection: false,
          debugProtection: false,
          disableConsoleOutput: false,
          identifierNamesGenerator: "hexadecimal",
          renameGlobals: false,
          rotateStringArray: true,
          selfDefending: false,
          shuffleStringArray: true,
          splitStrings: false,
          stringArray: true,
          stringArrayEncoding: ["base64"],
          stringArrayThreshold: 0.75,
          unicodeEscapeSequence: false,
        }).getObfuscatedCode();

        writeFileSync(file, shebang + obfuscated, "utf8");
        console.log(
          `  obfuscated: ${file.replace(distDir + "\\", "").replace(distDir + "/", "")}`,
        );
      }
    },
  };
}

export default defineConfig({
  build: {
    target: "node18",
    lib: {
      entry: "src/cli.ts",
      formats: ["cjs"],
      fileName: () => "cli.js",
    },
    rollupOptions: {
      external: [...nodeExternal, ...npmExternal],
      output: {
        inlineDynamicImports: true,
      },
    },
    outDir: "dist",
    minify: false,
    sourcemap: false,
    emptyOutDir: true,
  },
  plugins: [obfuscatorPlugin()],
});
