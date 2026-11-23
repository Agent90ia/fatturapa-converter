// Test E-FPA: confronto valori attesi / ottenuti. Uso: node test_fpa.js <cartella_progetto> <cartella_tools_js>
const fs = require("fs"), path = require("path"), assert = require("assert");
const proj = path.resolve(process.argv[2] || "."), toolsDir = path.resolve(process.argv[3] || path.join(proj, "src"));
fs.mkdirSync(path.join(proj, "out"), { recursive: true });
const F = require(path.join(toolsDir, "fpa-core.js"));
const XLSX = require(path.join(toolsDir, "xlsx.mini.min.js"));
const rd = (d, n) => ({ name: n, bytes: new Uint8Array(fs.readFileSync(path.join(proj, d, n))) });
const results = []; let failed = 0;
function check(label, got, exp) { const ok = JSON.stringify(got) === JSON.stringify(exp); if (!ok) failed++; results.push({ label, ok, got, exp }); }
const col = (rows, name) => rows.slice(1).map(r => r[F.HEAD.indexOf(name)]);
(async () => {
  // --- sintetici: attesi scritti a mano ---
  let r = await F.convert([rd("samples", "S1_fattura_due_aliquote.xml")]);
  check("S1 XML: 1 fattura", r.head.length - 1, 1);
  check("S1 numero/data/tipo", [col(r.head, "Numero")[0], col(r.head, "Data")[0], col(r.head, "Tipo documento")[0]], ["2026/17", { d: "2026-03-05" }, "TD01"]);
  check("S1 cedente", [col(r.head, "Cedente/prestatore P.IVA")[0], col(r.head, "Cedente/prestatore denominazione")[0]], ["IT10000000001", "Caffè & Dolci Fittizi S.r.l."]);
  check("S1 cessionario", [col(r.head, "Cessionario/committente P.IVA")[0], col(r.head, "Cessionario/committente denominazione")[0]], ["IT20000000002", "Studio Esempio Rossi"]);
  check("S1 imponibile/IVA/totale", [col(r.head, "Imponibile")[0], col(r.head, "IVA")[0], col(r.head, "Totale documento")[0], col(r.head, "Origine totale")[0]], [1075, 221.5, 1296.5, "da documento"]);
  check("S1 scadenze e importo da pagare", [col(r.head, "Scadenze")[0], col(r.head, "Importo da pagare")[0]], ["05/04/2026; 05/05/2026", 1296.5]);
  check("S1 righe (n, descrizione, qta, totale, IVA%)", r.lines.slice(1).map(l => [l[4], l[6], l[7], l[10], l[11]]), [[1, "Caffè in grani 1 kg", 10, 125, 10], [2, "Macchina espresso <modello X>", 1, 950, 22]]);

  r = await F.convert([rd("samples", "S2_nota_credito_persona_fisica.xml")]);
  check("S2 Latin-1: tipo, causale con accenti", [col(r.head, "Tipo documento")[0], col(r.head, "Causale")[0]], ["TD04", "Reso merce difettosa è già stornata"]);
  check("S2 persona fisica (nome cognome, C.F., niente P.IVA)", [col(r.head, "Cessionario/committente denominazione")[0], col(r.head, "Cessionario/committente C.F.")[0], col(r.head, "Cessionario/committente P.IVA")[0]], ["Mario Rossi", "RSSMRA80A01H501U", ""]);
  check("S2 totale calcolato", [col(r.head, "Imponibile")[0], col(r.head, "IVA")[0], col(r.head, "Totale documento")[0], col(r.head, "Origine totale")[0]], [140, 8.8, 148.8, "calcolato (imponibile + IVA)"]);
  check("S2 natura IVA riga 1, riga senza quantita'", [r.lines[1][12], r.lines[1][7], r.lines[1][8]], ["N2.2", "", ""]);
  check("S2 CSV protegge le formule", F.toCsv([["=SOMMA(A1:A9) voce con apice"]]), "'=SOMMA(A1:A9) voce con apice\r\n");

  r = await F.convert([rd("samples", "S3_lotto_due_fatture.xml")]);
  check("S3 lotto: 2 fatture, numeri", col(r.head, "Numero"), ["101", "102"]);
  check("S3 totali", [col(r.head, "Imponibile"), col(r.head, "IVA"), col(r.head, "Totale documento")], [[300, 49.9], [66, 10.98], [366, 60.88]]);
  check("S3 CDATA ed entita' numeriche", r.lines.slice(1).map(l => l[6]), ["Servizio A & B", "Canone évento €"]);
  check("S3 nome file con (fattura 1 di 2)", col(r.head, "File"), ["S3_lotto_due_fatture.xml (fattura 1 di 2)", "S3_lotto_due_fatture.xml (fattura 2 di 2)"]);

  // --- P7M: stessi valori dell'XML firmato ---
  const x1 = await F.convert([rd("samples", "S1_fattura_due_aliquote.xml")]);
  for (const [n, base] of [["S4_firmata_DER.xml.p7m", x1], ["S6_firmata_base64.xml.p7m", x1]]) {
    const p = await F.convert([rd("samples", n)]);
    check("P7M " + n + " = XML (testata e righe, ignorando il nome file)", [p.head.slice(1).map(h => h.slice(1)), p.lines.slice(1).map(l => l.slice(1))], [base.head.slice(1).map(h => h.slice(1)), base.lines.slice(1).map(l => l.slice(1))]);
  }
  const x3 = await F.convert([rd("samples", "S3_lotto_due_fatture.xml")]), p5 = await F.convert([rd("samples", "S5_firmata_BER_stream.xml.p7m")]);
  check("P7M BER a lunghezza indefinita (openssl -stream) = XML lotto", [p5.head.slice(1).map(h => h.slice(1)), p5.lines.slice(1).map(l => l.slice(1))], [x3.head.slice(1).map(h => h.slice(1)), x3.lines.slice(1).map(l => l.slice(1))]);

  // --- ZIP: 2 XML + 1 P7M, un txt ignorato, uno non-fattura segnalato ---
  r = await F.convert([rd("samples", "S7_archivio.zip"), rd("samples", "S8_non_fattura.xml")]);
  check("ZIP: fatture lette (nome, ok)", r.files.map(f => [f.name, f.ok]), [["S1.xml", true], ["S4.xml.p7m", true], ["S2.xml", true], ["S8_non_fattura.xml", false]]);
  check("ZIP: file non fattura saltato con motivo", r.skipped.map(s => s.name), ["S7_archivio.zip > leggimi.txt"]);
  check("ZIP: errore chiaro per XML non FatturaPA", r.files[3].error, "non è una fattura elettronica FatturaPA (elemento radice «Libro»)");
  check("ZIP: righe totali testata (S1 + S4 + S2)", r.head.length - 1, 3);

  // --- limite 20 file ---
  const many = []; for (let i = 0; i < 23; i++) many.push({ name: "f" + i + ".xml", bytes: rd("samples", "S1_fattura_due_aliquote.xml").bytes });
  r = await F.convert(many);
  check("Limite: 23 file -> 20 elaborati, 3 oltre il limite", [r.head.length - 1, r.truncated, r.total], [20, 3, 23]);

  // --- prova che il P7M e' letto dalla struttura CMS e non dalla ricerca di testo: rovino "<?xml" (stessa lunghezza) cosi' la ricerca di riserva non trova nulla ---
  for (const n of ["S4_firmata_DER.xml.p7m", "S5_firmata_BER_stream.xml.p7m"]) {
    const b = Buffer.from(fs.readFileSync(path.join(proj, "samples", n))), i = b.indexOf("<?xml");
    b[i + 1] = 0x21; // "<!xml"
    const o = await F.convert([{ name: n, bytes: new Uint8Array(b) }]);
    check("P7M " + n + ": estrazione dalla struttura CMS (senza ricerca di testo)", [o.files[0].ok, o.head.length - 1], [true, n.includes("DER") ? 1 : 2]);
  }
  // --- XLSX reale: 2 fogli, date vere, numeri veri ---
  r = await F.convert([rd("samples", "S1_fattura_due_aliquote.xml"), rd("samples", "S3_lotto_due_fatture.xml")]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(F.toSheetRows(r.head)), "Testata");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(F.toSheetRows(r.lines)), "Righe");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  fs.writeFileSync(path.join(proj, "out", "esempio-output.xlsx"), buf);
  const back = XLSX.read(buf, { type: "buffer", cellDates: false });
  check("XLSX: fogli", back.SheetNames, ["Testata", "Righe"]);
  const ws = back.Sheets["Testata"], cell = (c) => ws[c];
  check("XLSX: data = numero seriale Excel con formato data (05/03/2026 = 46086)", [cell("E2").t, cell("E2").v, cell("E2").w], ["n", 46086, "05/03/2026"]);
  check("XLSX: importi numerici (imponibile, IVA, totale)", [cell("M2").t, cell("M2").v, cell("N2").v, cell("O2").v], ["n", 1075, 221.5, 1296.5]);
  check("XLSX: righe lette (S1 2 + S3 2 = 4 + intestazione)", XLSX.utils.sheet_to_json(back.Sheets["Righe"], { header: 1 }).length, 5);
  const csv = F.toCsv(r.head); fs.writeFileSync(path.join(proj, "out", "esempio-testata.csv"), "﻿" + csv);
  check("CSV: prima riga dati (separatore ;, decimali con virgola, data gg/mm/aaaa)", csv.split("\r\n")[1].split(";").slice(3, 5).concat(csv.split("\r\n")[1].split(";").slice(12, 15)), ["2026/17", "05/03/2026", "1075", "221,5", "1296,5"]);

  // --- T358: colonne contabili e foglio "Riepilogo IVA" (valori attesi scritti a mano, campioni FITTIZI S9/S10) ---
  const NEW = ["Ritenuta tipo", "Ritenuta aliquota %", "Ritenuta importo", "Ritenuta causale pagamento", "Cassa previdenziale tipo", "Cassa aliquota %", "Cassa importo", "Bollo virtuale", "Bollo importo", "IBAN"];
  const nc = (rows, i) => NEW.map(n => rows[i][F.HEAD.indexOf(n)]);
  check("T358 intestazioni: le 20 colonne storiche restano ai loro posti, +10 in coda", [F.HEAD.length, F.HEAD.slice(20)], [30, NEW]);
  r = await F.convert([rd("samples", "S9_professionista_ritenuta_cassa_bollo.xml")]);
  check("S9 ritenuta, cassa, bollo, IBAN", nc(r.head, 1), ["RT01", 20, 200, "A", "TC04", 4, 40, "SI", 2, "IT60X0542811101000000123456"]);
  check("S9 persona fisica con P.IVA; imponibile/IVA/totale/da pagare", [col(r.head, "Cedente/prestatore denominazione")[0], col(r.head, "Imponibile")[0], col(r.head, "IVA")[0], col(r.head, "Totale documento")[0], col(r.head, "Origine totale")[0], col(r.head, "Importo da pagare")[0]], ["Luigi Verdi", 1090, 228.8, 1320.8, "da documento", 1120.8]);
  check("S9 Riepilogo IVA: 2 righe (22% e N1 con riferimento normativo)", r.riep.slice(1).map(x => x.slice(1)), [
    ["7/2026", { d: "2026-05-10" }, "Luigi Verdi", 22, "", 1040, 228.8, "I", "immediata", ""],
    ["7/2026", { d: "2026-05-10" }, "Luigi Verdi", 0, "N1", 50, 0, "I", "immediata", "Escluso art. 15 DPR 633/72"]]);
  check("S9 doc strutturato: ritenute e casse", [r.docs[0].ritenute, r.docs[0].casse], [[{ tipo: "RT01", aliq: 20, imp: 200, causale: "A" }], [{ tipo: "TC04", aliq: 4, imp: 40, imponibile: 1000, aliqIva: 22 }]]);
  r = await F.convert([rd("samples", "S10_pa_split_payment.xml")]);
  check("S10 PA split: formato FPA12, imponibile/IVA/totale/da pagare (split: si paga solo l'imponibile)", [col(r.head, "Formato")[0], col(r.head, "Imponibile")[0], col(r.head, "IVA")[0], col(r.head, "Totale documento")[0], col(r.head, "Importo da pagare")[0]], ["FPA12", 700, 130, 830, 700]);
  check("S10 colonne ritenuta/cassa/bollo vuote, IBAN presente", nc(r.head, 1), ["", "", "", "", "", "", "", "", "", "IT60X0542811101000000123456"]);
  check("S10 Riepilogo IVA: esigibilita' S su entrambe le righe", r.riep.slice(1).map(x => x.slice(4)), [
    [22, "", 500, 110, "S", "scissione dei pagamenti (split payment)", "=Scissione dei pagamenti art. 17-ter DPR 633/72"],
    [10, "", 200, 20, "S", "scissione dei pagamenti (split payment)", ""]]);
  const csvR = F.toCsv(r.riep).split("\r\n");
  check("S10 CSV riepilogo: formula protetta con apice, decimali con virgola", [csvR[1].split(";").slice(4), csvR[1].includes("'=Scissione")], [["22", "", "500", "110", "S", "scissione dei pagamenti (split payment)", "'=Scissione dei pagamenti art. 17-ter DPR 633/72"], true]);
  r = await F.convert([rd("samples", "S1_fattura_due_aliquote.xml")]);
  check("S1 (senza ritenuta/cassa/bollo/IBAN): nuove colonne vuote; riepilogo con 2 aliquote e esigibilita' vuota", [nc(r.head, 1), r.riep.slice(1).map(x => [x[4], x[6], x[7], x[8], x[9]])], [["", "", "", "", "", "", "", "", "", ""], [[10, 125, 12.5, "", ""], [22, 950, 209, "", ""]]]);
  // protezione "=" anche sulle nuove colonne della testata: causale ritenuta e IBAN alterati in memoria
  const mod = Buffer.from(fs.readFileSync(path.join(proj, "samples", "S9_professionista_ritenuta_cassa_bollo.xml")).toString("utf8").replace("<CausalePagamento>A<", "<CausalePagamento>=A<").replace("<IBAN>IT60", "<IBAN>+IT60"));
  const rm = await F.convert([{ name: "S9mod.xml", bytes: new Uint8Array(mod) }]);
  const hl = F.toCsv(rm.head).split("\r\n")[1].split(";");
  check("CSV testata: protezione formule su causale ritenuta e IBAN", [hl[F.HEAD.indexOf("Ritenuta causale pagamento")], hl[F.HEAD.indexOf("IBAN")]], ["'=A", "'+IT60X0542811101000000123456"]);
  // XLSX con 3 fogli (esempio rigenerato) riletto con SheetJS: celle "=" restano testo
  r = await F.convert([rd("samples", "S1_fattura_due_aliquote.xml"), rd("samples", "S3_lotto_due_fatture.xml"), rd("samples", "S9_professionista_ritenuta_cassa_bollo.xml"), rd("samples", "S10_pa_split_payment.xml")]);
  const wb3 = XLSX.utils.book_new();
  [["Testata", r.head], ["Righe", r.lines], ["Riepilogo IVA", r.riep]].forEach(p => XLSX.utils.book_append_sheet(wb3, XLSX.utils.aoa_to_sheet(F.toSheetRows(p[1])), p[0]));
  const buf3 = XLSX.write(wb3, { bookType: "xlsx", type: "buffer" });
  fs.writeFileSync(path.join(proj, "out", "esempio-output.xlsx"), buf3);
  const b3 = XLSX.read(buf3, { type: "buffer" });
  check("XLSX 3 fogli", b3.SheetNames, ["Testata", "Righe", "Riepilogo IVA"]);
  const wr = b3.Sheets["Riepilogo IVA"], wh = b3.Sheets["Testata"];
  check("XLSX Riepilogo IVA: 1 + 2 + 2 + 2 + 2 righe; numeri veri; cella con '=' e' testo (non formula)", [XLSX.utils.sheet_to_json(wr, { header: 1 }).length, wr["G2"].t, wr["G2"].v, wr["H2"].v, wr["K8"].t, wr["K8"].v, wr["K8"].f === undefined], [9, "n", 125, 12.5, "s", "=Scissione dei pagamenti art. 17-ter DPR 633/72", true]);
  check("XLSX Testata: ritenuta e cassa numeriche su S9 (riga 5)", [wh["U5"].v, wh["V5"].t, wh["V5"].v, wh["X5"].v, wh["Y5"].v, wh["AD5"].v], ["RT01", "n", 20, "A", "TC04", "IT60X0542811101000000123456"]);

  fs.writeFileSync(path.join(proj, "out", "test-results.json"), JSON.stringify(results, null, 1));
  results.forEach(x => console.log((x.ok ? "OK   " : "FAIL ") + x.label + (x.ok ? "" : "\n   ottenuto: " + JSON.stringify(x.got) + "\n   atteso:   " + JSON.stringify(x.exp))));
  console.log(`\n${results.length - failed}/${results.length} controlli superati`); process.exit(failed ? 1 : 0);
})().catch(e => { console.error("ERRORE", e); process.exit(2); });
