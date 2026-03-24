const JavaScriptObfuscator = require("javascript-obfuscator");
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "dist");

function getJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory()
      ? getJsFiles(fullPath)
      : entry.name.endsWith(".js")
        ? [fullPath]
        : [];
  });
}

const files = getJsFiles(distDir);

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const result = JavaScriptObfuscator.obfuscate(source, {
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
  });
  fs.writeFileSync(file, result.getObfuscatedCode(), "utf8");
  console.log(`Obfuscated: ${path.relative(distDir, file)}`);
}

console.log(`Done. ${files.length} file(s) obfuscated.`);
