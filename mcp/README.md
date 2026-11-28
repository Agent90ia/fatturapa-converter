# fatturapa-mcp — server MCP per fatture elettroniche (FatturaPA)

Server [MCP](https://modelcontextprotocol.io) (stdio, Node.js) che permette a Claude Desktop, Cursor e altri client MCP di **leggere una fattura elettronica italiana** (XML, XML firmato `.p7m`, archivio `.zip`, lotti) e di restituirla come **JSON** o **CSV**. Funziona tutto in locale: i file non escono dal tuo computer e il server non fa richieste di rete.

Usa lo stesso parser del convertitore di questo repository (`../src/fpa-core.js`). Se ti serve solo un file Excel senza installare nulla, c'è la versione nel browser: **https://rinveta.com/fattura-elettronica-xml-excel/?c=mcp-fpa**

## Tool
| Tool | Cosa fa |
|---|---|
| `parse_fattura` | Legge uno o più file (`path` locale oppure `name` + `base64`) e restituisce JSON: per ogni fattura tipo documento, numero, data, cedente, cessionario, imponibile, IVA, totale, righe, riepilogo IVA, pagamenti, ritenute, casse, bollo, più l'esito per file e gli avvisi. |
| `to_csv` | Stesso input, restituisce CSV (`;` come separatore, virgola decimale, date `gg/mm/aaaa`). Parametro `foglio`: `testata` (una riga per fattura, predefinito), `righe`, `riepilogo_iva`. Le celle che iniziano con `=`, `+`, `-`, `@` sono protette dall'esecuzione come formula. |

Limiti: massimo 20 file per chiamata, 20 MB per file, solo estensioni `.xml`, `.p7m`, `.zip`. La firma digitale del P7M **non è verificata** e il XML **non è validato** con lo schema XSD: il server legge, non certifica.

## Installazione
Serve Node.js recente (testato con v24).
```bash
git clone https://github.com/Agent90ia/fatturapa-converter
cd fatturapa-converter/mcp
npm install
npm test
```

### Claude Desktop
Aggiungi in `claude_desktop_config.json` (menu Impostazioni → Sviluppatore → Modifica configurazione), con il percorso reale della cartella clonata:
```json
{
  "mcpServers": {
    "fatturapa": {
      "command": "node",
      "args": ["/percorso/assoluto/fatturapa-converter/mcp/server.js"]
    }
  }
}
```
Riavvia Claude Desktop, poi chiedi ad esempio: «Leggi `/Users/me/fatture/IT0123_001.xml.p7m` e dimmi totale e scadenze».

### Cursor
In `~/.cursor/mcp.json` (o `.cursor/mcp.json` nel progetto):
```json
{
  "mcpServers": {
    "fatturapa": {
      "command": "node",
      "args": ["/percorso/assoluto/fatturapa-converter/mcp/server.js"]
    }
  }
}
```

Su Windows usa percorsi con doppio backslash o barre normali (`C:/Users/me/fatturapa-converter/mcp/server.js`).

## Test
`npm test` esegue un client MCP reale contro il server (elenco tool, XML, P7M DER/BER/base64, ZIP, lotto, base64, CSV, errori, rifiuto di estensioni non ammesse) usando i campioni **fittizi** in `../samples/`.

## Privacy
Il server legge solo i file che gli indichi tu e risponde al client MCP sul canale locale (stdio). Il contenuto delle fatture viene però passato al modello del client che usi (es. Claude): non darlo in pasto a un assistente se i dati non possono lasciare il tuo ambiente.

## Dichiarazione IA
Questo server e il parser sottostante sono stati scritti da un agente di intelligenza artificiale per conto del progetto Rinveta, e verificati con test automatici (campioni fittizi e confronto con un secondo parser indipendente sui sei file di esempio pubblicati da fatturapa.gov.it, non inclusi nel repository). Non è consulenza fiscale.

## Licenza
MIT (vedi `../LICENSE`). Il lettore xlsx incluso in `../src/` è SheetJS, Apache-2.0 (vedi `../NOTICE`).
