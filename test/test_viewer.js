// Test vista leggibile (T352): i dati strutturati (docs) usati da /apri-file-p7m-fattura-xml/ contro valori attesi.
// Uso: node test_viewer.js <cartella_progetto> <cartella_tools_js>
const fs = require("fs"), path = require("path");
const proj = path.resolve(process.argv[2] || "."), toolsDir = path.resolve(process.argv[3] || path.join(proj, "src"));
fs.mkdirSync(path.join(proj, "out"), { recursive: true });
const F = require(path.join(toolsDir, "fpa-core.js"));
const rd = (d, n) => ({ name: n, bytes: new Uint8Array(fs.readFileSync(path.join(proj, d, n))) });
const results = []; let failed = 0;
function check(label, got, exp) { const ok = JSON.stringify(got) === JSON.stringify(exp); if (!ok) failed++; results.push({ label, ok, got, exp }); }
const strip = d => { const c = JSON.parse(JSON.stringify(d)); delete c.file; return c; };
const sum = (a, f) => Math.round(a.reduce((s, x) => s + (x[f] || 0), 0) * 100) / 100;
const cp = require("child_process");
for (const f of ["fpa-core.js"]) { const x = cp.spawnSync(process.execPath, ["--check", path.join(toolsDir, f)], { encoding: "utf8" }); check("sintassi JS " + f, x.status, 0); }
(async () => {
  let r = await F.convert([rd("samples", "S1_fattura_due_aliquote.xml")]);
  const d = r.docs[0];
  check("S1 testata", [d.tipo, d.numero, d.data, d.divisa], ["TD01", "2026/17", "2026-03-05", "EUR"]);
  check("S1 parti", [d.ced.den, d.ced.piva, d.ces.den, d.ces.piva], ["Caffè & Dolci Fittizi S.r.l.", "IT10000000001", "Studio Esempio Rossi", "IT20000000002"]);
  check("S1 righe", d.righe.map(x => [x.n, x.desc, x.qta, x.pt, x.aliq]).slice(0, 2), [["1", "Caffè in grani 1 kg", 10, 125, 10], ["2", "Macchina espresso <modello X>", 1, 950, 22]]);
  check("S1 riepilogo IVA (2 aliquote)", d.riep.map(x => [x.aliq, x.imp, x.iva]), [[10, 125, 12.5], [22, 950, 209]]);
  check("S1 scadenze", d.pag.map(x => x.scad), ["2026-04-05", "2026-05-05"]);
  check("S1 totali", [d.imp, d.iva, d.tot, d.orig], [1075, 221.5, 1296.5, "da documento"]);
  const s1 = strip(d);
  for (const [n, lab] of [["S4_firmata_DER.xml.p7m", "P7M DER"], ["S6_firmata_base64.xml.p7m", "P7M base64"]]) {
    r = await F.convert([rd("samples", n)]);
    check(lab + ": vista identica all'XML S1 (stessi dati, tranne il nome file)", r.docs.length === 1 && JSON.stringify(strip(r.docs[0])) === JSON.stringify(s1), true);
  }
  const s3 = (await F.convert([rd("samples", "S3_lotto_due_fatture.xml")])).docs.map(strip);
  r = await F.convert([rd("samples", "S5_firmata_BER_stream.xml.p7m")]);
  check("P7M BER (lotto): 2 fatture con gli stessi dati di S3", [r.docs.length, JSON.stringify(r.docs.map(strip)) === JSON.stringify(s3)], [2, true]);
  r = await F.convert([rd("samples", "S2_nota_credito_persona_fisica.xml")]);
  check("S2 nota di credito Latin-1: tipo, causale, persona fisica, natura", [r.docs[0].tipo, r.docs[0].causale, r.docs[0].ces.den, r.docs[0].righe[0].nat, r.docs[0].orig], ["TD04", ["Reso merce difettosa è già stornata"], r.docs[0].ces.den, "N2.2", "calcolato (imponibile + IVA)"]);
  r = await F.convert([rd("samples", "S7_archivio.zip")]);
  check("ZIP con XML+P7M+XML: 3 fatture leggibili", [r.docs.length, r.files.every(f => f.ok)], [3, true]);
  r = await F.convert([rd("samples", "S8_non_fattura.xml")]);
  check("XML non fattura: nessuna vista, errore chiaro", [r.docs.length, /Libro/.test(r.files[0].error)], [0, true]);
  fs.writeFileSync(path.join(proj, "out", "test-viewer-results.json"), JSON.stringify(results, null, 1));
  results.forEach(x => console.log((x.ok ? "OK   " : "FAIL ") + x.label + (x.ok ? "" : "\n   atteso " + JSON.stringify(x.exp) + "\n   ottenuto " + JSON.stringify(x.got))));
  console.log("\n" + (results.length - failed) + "/" + results.length + " controlli superati"); process.exit(failed ? 1 : 0);
})();
