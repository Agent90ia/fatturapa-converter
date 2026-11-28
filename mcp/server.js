#!/usr/bin/env node
// Server MCP (stdio) per fatture elettroniche FatturaPA. Tutto in locale, nessuna rete.
// Tool: parse_fattura (XML/P7M/ZIP -> JSON), to_csv (XML/P7M/ZIP -> CSV).
const fs = require("fs"), path = require("path");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
const F = require("../src/fpa-core.js");

const MAX_BYTES = 20 * 1024 * 1024, EXT = /\.(xml|p7m|zip)$/i;
const fileSchema = z.object({
  path: z.string().optional().describe("Percorso locale di un file .xml, .xml.p7m o .zip"),
  name: z.string().optional().describe("Nome del file (necessario con base64; l'estensione .p7m/.zip/.xml guida la lettura)"),
  base64: z.string().optional().describe("Contenuto del file in base64, in alternativa a path"),
});
const filesArg = z.array(fileSchema).min(1).max(F.MAX_FILES).describe("Da 1 a " + F.MAX_FILES + " file");

function load(f) {
  if (f.path) {
    if (!EXT.test(f.path)) throw new Error("Estensione non ammessa (solo .xml, .p7m, .zip): " + path.basename(f.path));
    const st = fs.statSync(f.path);
    if (!st.isFile() || st.size > MAX_BYTES) throw new Error("File non valido o oltre 20 MB: " + path.basename(f.path));
    return { name: path.basename(f.path), bytes: new Uint8Array(fs.readFileSync(f.path)) };
  }
  if (f.base64 && f.name) {
    const b = Buffer.from(f.base64, "base64");
    if (b.length > MAX_BYTES) throw new Error("Contenuto oltre 20 MB: " + f.name);
    return { name: path.basename(f.name), bytes: new Uint8Array(b) };
  }
  throw new Error("Ogni file richiede path, oppure name + base64");
}
async function run(files) {
  const r = await F.convert(files.map(load));
  const bad = r.files.filter(x => !x.ok);
  return { r, bad };
}
const text = (s, isError) => ({ content: [{ type: "text", text: s }], isError: !!isError });

const server = new McpServer({ name: "fatturapa-mcp", version: "1.0.0" });

server.registerTool("parse_fattura", {
  title: "Leggi fattura elettronica (FatturaPA) in JSON",
  description: "Legge fatture elettroniche italiane FatturaPA (XML, XML firmato .p7m, ZIP con piu' fatture, lotti) e restituisce JSON: per ogni fattura tipo documento, numero, data, cedente, cessionario, imponibile, IVA, totale, righe, riepilogo IVA, pagamenti, ritenute, casse, bollo. La firma P7M non viene verificata e il XML non e' validato con lo schema XSD. Elaborazione locale.",
  inputSchema: { files: filesArg },
}, async ({ files }) => {
  try {
    const { r, bad } = await run(files);
    return text(JSON.stringify({ fatture: r.docs, file: r.files, avvisi: r.warnings, saltati: r.skipped, troncato: r.truncated }, null, 2), !r.docs.length && bad.length > 0);
  } catch (e) { return text("Errore: " + e.message, true); }
});

server.registerTool("to_csv", {
  title: "Converti fattura elettronica (FatturaPA) in CSV",
  description: "Converte fatture FatturaPA (XML, .p7m, ZIP) in CSV con separatore ';' e virgola decimale (apribile in Excel italiano). 'foglio' sceglie: testata (una riga per fattura), righe (una per riga di dettaglio), riepilogo_iva. Le celle che iniziano con = + - @ sono protette dall'esecuzione come formula.",
  inputSchema: { files: filesArg, foglio: z.enum(["testata", "righe", "riepilogo_iva"]).default("testata") },
}, async ({ files, foglio }) => {
  try {
    const { r, bad } = await run(files);
    const rows = foglio === "righe" ? r.lines : foglio === "riepilogo_iva" ? r.riep : r.head;
    const msg = bad.length ? "\n# Non leggibili: " + bad.map(b => b.name + " (" + b.error + ")").join("; ") : "";
    return text(F.toCsv(rows) + msg, rows.length <= 1 && bad.length > 0);
  } catch (e) { return text("Errore: " + e.message, true); }
});

server.connect(new StdioServerTransport()).catch(e => { console.error(e); process.exit(1); });
