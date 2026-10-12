// Copies the pdf.js worker that react-pdf uses into public/ so the browser can load it.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.resolve("node_modules/react-pdf/package.json"));
const worker = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
mkdirSync("public", { recursive: true });
copyFileSync(worker, "public/pdf.worker.min.mjs");
console.log("Copied pdf.js worker from", worker);
