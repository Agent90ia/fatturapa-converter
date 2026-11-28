// Test del server MCP via client SDK (stdio). Uso: node test/test_mcp.js [cartella_campioni_extra]
const path = require("path"), fs = require("fs");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const S = path.join(__dirname, "..", "..", "samples");
let failed = 0, n = 0;
function check(label, ok, info) { n++; if (!ok) { failed++; console.log("FAIL", label, info === undefined ? "" : JSON.stringify(info)); } else console.log("ok  ", label); }
(async () => {
  const c = new Client({ name: "test", version: "1" });
  await c.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(__dirname, "..", "server.js")] }));
  const tools = (await c.listTools()).tools.map(t => t.name).sort();
  check("tool elencati", JSON.stringify(tools) === JSON.stringify(["parse_fattura", "to_csv"]), tools);
  const call = (name, args) => c.callTool({ name, arguments: args });
  let r = await call("parse_fattura", { files: [{ path: path.join(S, "S1_fattura_due_aliquote.xml") }] });
  let j = JSON.parse(r.content[0].text);
  check("S1 numero/tipo/totale", j.fatture[0].numero === "2026/17" && j.fatture[0].tipo === "TD01" && j.fatture[0].tot === 1296.5, j.fatture[0] && [j.fatture[0].numero, j.fatture[0].tot]);
  check("S1 2 righe, 2 aliquote", j.fatture[0].righe.length === 2 && j.fatture[0].riep.length === 2);
  r = await call("parse_fattura", { files: ["S4_firmata_DER.xml.p7m", "S5_firmata_BER_stream.xml.p7m", "S6_firmata_base64.xml.p7m"].map(f => ({ path: path.join(S, f) })) });
  j = JSON.parse(r.content[0].text);
  check("3 P7M (DER, BER, base64) letti", j.fatture.length >= 3 && j.file.every(f => f.ok), j.file);
  r = await call("parse_fattura", { files: [{ path: path.join(S, "S7_archivio.zip") }] });
  j = JSON.parse(r.content[0].text);
  check("ZIP letto", j.fatture.length >= 2, j.file);
  r = await call("parse_fattura", { files: [{ name: "S3.xml", base64: fs.readFileSync(path.join(S, "S3_lotto_due_fatture.xml")).toString("base64") }] });
  j = JSON.parse(r.content[0].text);
  check("base64 lotto: 2 fatture", j.fatture.length === 2 && j.fatture[0].numero === "101" && j.fatture[1].numero === "102");
  r = await call("to_csv", { files: [{ path: path.join(S, "S1_fattura_due_aliquote.xml") }] });
  check("CSV testata: separatore ; e virgola decimale", /;/.test(r.content[0].text) && r.content[0].text.includes("1296,5") && r.content[0].text.includes("05/03/2026"), r.content[0].text.slice(0, 200));
  r = await call("to_csv", { files: [{ path: path.join(S, "S1_fattura_due_aliquote.xml") }], foglio: "righe" });
  check("CSV righe: 3 righe (testata+2)", r.content[0].text.trim().split("\r\n").length === 3);
  r = await call("to_csv", { files: [{ path: path.join(S, "S2_nota_credito_persona_fisica.xml") }] });
  check("CSV nota credito Latin-1", r.content[0].text.includes("è già stornata"));
  r = await call("parse_fattura", { files: [{ path: path.join(S, "S8_non_fattura.xml") }] });
  check("non-fattura: errore segnalato", r.isError === true || JSON.parse(r.content[0].text).file[0].ok === false);
  r = await call("parse_fattura", { files: [{ path: "/etc/passwd" }] });
  check("estensione non ammessa rifiutata", r.isError === true && /Estensione/.test(r.content[0].text), r.content[0].text);
  r = await call("parse_fattura", { files: [{ path: "/tmp/inesistente.xml" }] });
  check("file inesistente: errore pulito", r.isError === true);
  const extra = process.argv[2];
  if (extra) {
    const ref = JSON.parse(fs.readFileSync(path.join(extra, "..", "official-reference.json"), "utf8"));
    const names = fs.readdirSync(extra).filter(f => /\.xml$/.test(f));
    r = await call("parse_fattura", { files: names.map(f => ({ path: path.join(extra, f) })) });
    j = JSON.parse(r.content[0].text);
    check("ufficiali fatturapa.gov.it: " + names.length + " file letti senza errori", j.file.every(f => f.ok) && j.fatture.length >= names.length, j.file.filter(f => !f.ok));
    for (const f of names) {
      const o = await call("parse_fattura", { files: [{ path: path.join(extra, f) }] });
      const d = JSON.parse(o.content[0].text).fatture, exp = ref[f].head;
      const got = d.map(x => [x.numero, x.data, x.imp, x.iva, x.tot]);
      check("riferimento indipendente " + f, JSON.stringify(got) === JSON.stringify(exp), { got, exp });
    }
  }
  await c.close();
  console.log(`\n${n - failed}/${n} test OK`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
