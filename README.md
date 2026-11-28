# Convertire fattura XML in Excel e aprire file P7M (FatturaPA)

Libreria JavaScript e piccolo comando da terminale per **convertire una fattura elettronica XML in Excel** (xlsx/CSV) e **aprire un file P7M** di fattura elettronica (firma CAdES) leggendo il XML contenuto. Funziona con file singoli, lotti di più fatture, file `.xml.p7m` e archivi `.zip`. Non usa servizi esterni: il file resta sul tuo computer.

> Non vuoi installare nulla? Lo stesso motore gira nel browser, gratis, su
> **https://rinveta.com/fattura-elettronica-xml-excel/?c=gh-fpa**

## Cosa fa
- Legge FatturaPA (formati FPA12 e FPR12): fattura singola o lotto di più fatture nello stesso file.
- Apre i **P7M** (firma DER, BER a flusso o con contenuto in base64) leggendo la struttura CMS e ne estrae il XML. La firma **non viene verificata**.
- Apre gli **ZIP** con più fatture (XML e P7M).
- Produce tre fogli: **Testata** (una riga per fattura: numero, data, tipo documento, cedente, cessionario, imponibile, IVA, totale, scadenze, ritenuta, cassa, bollo, IBAN…), **Righe** (una riga per riga di dettaglio) e **Riepilogo IVA**.
- Date e importi sono **veri valori di Excel** (non testo), le celle che iniziano con `=` restano testo (niente formule iniettate).
- Gestisce UTF-8 e Latin-1, note di credito, persone fisiche, split payment PA.

## Uso da terminale (Node.js recente, testato con v24)
```bash
git clone https://github.com/Agent90ia/fatturapa-converter
cd fatturapa-converter
node bin/fpa2xlsx.js fattura.xml.p7m altre/*.xml archivio.zip -o fatture.xlsx
```
Nessun `npm install`: il lettore xlsx (SheetJS, Apache-2.0) è incluso in `src/`.

## Uso come libreria
```js
const F = require("./src/fpa-core.js");
const r = await F.convert([{ name: "fattura.xml.p7m", bytes: new Uint8Array(fs.readFileSync("fattura.xml.p7m")) }]);
// r.head (testata), r.lines (righe), r.riep (riepilogo IVA), r.docs (dati strutturati), r.files (esito per file)
const csv = F.toCsv(r.head);
```
Limite predefinito: 20 file per elaborazione (`MAX_FILES` in `src/fpa-core.js`).

## Server MCP (Claude Desktop, Cursor)
La cartella [`mcp/`](mcp/) contiene un server MCP che legge fatture XML/P7M/ZIP e le restituisce come JSON o CSV ai client compatibili. Installazione e configurazione in [`mcp/README.md`](mcp/README.md).

## Dopo la conversione: unire e deduplicare in blocco, via API

Se dopo aver convertito le fatture hai molti CSV/Excel da unire o ripulire dai duplicati, o immagini da convertire in blocco (WebP, AVIF, JPEG, PNG), puoi usare due Actor su Apify (gli Actor girano sui server di Apify; da API o da pianificazione): [Dataset Merge, Dedupe & Transform](https://apify.com/rinveta/dataset-merge-dedupe) e [Image Compressor & Converter](https://apify.com/rinveta/image-converter). Sono prodotti Rinveta, gli stessi autori di questo repository; per un file singolo restano gratuiti gli strumenti nel browser su [rinveta.com](https://rinveta.com/remove-duplicates-csv-excel/).

## Test
```bash
npm test      # oppure: node test/test_fpa.js && node test/test_viewer.js
```
I test usano file campione **fittizi** in `samples/` (valori attesi scritti a mano) e dimostrano che il P7M è letto dalla struttura CMS e non da una semplice ricerca di testo.

## Limiti noti
- La firma digitale del P7M non è verificata e il XML non è validato con lo schema XSD.
- La fattura semplificata non è supportata; gli allegati non finiscono in colonne dedicate.
- Nessun calcolo né controllo di ritenuta, cassa, bollo o split payment: sono riportati solo i valori scritti nel file.
- Gli archivi ZIP annidati non vengono aperti.
- Provato con SheetJS, non con Excel desktop.

## Parole chiave
convertire fattura xml in excel, fattura elettronica xml excel, aprire file p7m, leggere fattura elettronica p7m, fatturapa xml to xlsx, fattura elettronica csv.

## Licenza
MIT (vedi `LICENSE`). Il file `src/xlsx.mini.min.js` è SheetJS ed è distribuito con la sua licenza Apache-2.0 (`src/xlsx-LICENSE.txt`).
Mantenuto da [Rinveta](https://rinveta.com/fattura-elettronica-xml-excel/?c=gh-fpa).
