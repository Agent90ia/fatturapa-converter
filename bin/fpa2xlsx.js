#!/usr/bin/env node
// Uso: node bin/fpa2xlsx.js <file.xml|file.xml.p7m|archivio.zip> [altri file...] -o output.xlsx
const fs = require("fs"), path = require("path");
const F = require("../src/fpa-core.js"), XLSX = require("../src/xlsx.mini.min.js");
const args = process.argv.slice(2), oi = args.indexOf("-o");
const out = oi >= 0 ? args.splice(oi, 2)[1] : "fatture.xlsx";
if (!args.length) { console.error("Uso: node bin/fpa2xlsx.js <file...> [-o output.xlsx]"); process.exit(1); }
(async () => {
  const files = args.map(f => ({ name: path.basename(f), bytes: new Uint8Array(fs.readFileSync(f)) }));
  const r = await F.convert(files);
  const wb = XLSX.utils.book_new();
  [["Testata", r.head], ["Righe", r.lines], ["Riepilogo IVA", r.riep]].forEach(p => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(F.toSheetRows(p[1])), p[0]));
  fs.writeFileSync(out, XLSX.write(wb, { bookType: "xlsx", type: "buffer" }));
  r.files.filter(f => !f.ok).forEach(f => console.error("Problema con " + f.name + ": " + (f.error || f.msg || f.err || f.message || "non leggibile")));
  console.log(`${r.head.length - 1} fatture, ${r.lines.length - 1} righe -> ${out}`);
})();
