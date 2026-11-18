# Configurazione giochi

L'area [Giochi](../games.html) e' statica. Non utilizza API SiMax,
Azure, cookie aggiuntivi o salvataggi nel browser. Il pronostico sul sito,
se attivato, invia le scelte a Google Apps Script per salvarle in Google Sheets.
La navigazione desktop/mobile della home include il collegamento.

## Pubblicazione

Modificare [games.json](../games.json) e pubblicare il sito con il normale flusso
GitHub Pages. I dati sono riletti a ogni apertura pagina. Una pagina gia' aperta
mantiene la configurazione caricata: dopo modifiche, chiedere di ricaricarla.

Prima di aprire un gioco controllare torneo, premi, codici e, per i pronostici,
la configurazione di invio. Non aprire un pronostico con squadre dimostrative.

## Campi comuni

### Password condivisa

Alla radice del JSON, prima di `games`, `accessPassword` imposta un'unica password
per tutti i giochi e tutti i partecipanti:

```json
{
  "accessPassword": "SIMAXPLAY",
  "games": []
}
```

`SIMAXPLAY` e' il valore dimostrativo iniziale: sostituirlo con quello da comunicare
al torneo, senza riutilizzare password di account personali o amministrativi.
Il confronto distingue maiuscole, minuscole e spazi. Sono ammessi fino a 128
caratteri; omettere il campo o impostarlo a `""` per disattivare la richiesta.
Valori di soli spazi non sono validi.

La home rimane visibile. Premendo "Gioca" si chiede la password prima di mostrare
il gioco o il collegamento al pronostico. Dopo lo sblocco si inserisce il proprio
codice partecipante. Chiudendo la finestra o ricaricando la pagina si deve inserire
di nuovo la password: non viene salvata nel browser.

E' un filtro informale solo frontend: la password, i codici e i vincitori sono
nel JSON pubblico e il controllo puo' essere aggirato. Non e' autenticazione
sicura e non impedisce di aprire direttamente un Google Form conoscendone l'URL.
Non sono coinvolti il backend SiMax o Azure. Il ricevitore Apps Script dei
pronostici e' invece una componente server ospitata su Google.

### Campi del singolo gioco

| Campo | Significato |
| --- | --- |
| `id` | Identificativo univoco, lettere minuscole, numeri e trattini |
| `enabled` | `true`: scheda visibile; `false`: scheda nascosta |
| `status` | `upcoming`: prossimamente; `open`: giocabile; `closed`: visibile ma chiuso |
| `type` | `draw` oppure `prediction` |
| `tournament` | Nome del torneo, per distinguere giochi di tornei diversi |
| `tournamentEn` | Nome del torneo in inglese (facoltativo) |
| `title`, `description` | Testi mostrati nella scheda e nel gioco |
| `titleEn`, `descriptionEn` | Titolo e descrizione in inglese (facoltativi) |
| `participation` | `team`: codice squadra; `individual`: codice personale |
| `image` | Immagine facoltativa, percorso relativo o URL HTTPS |
| `prizes` | Elenco dei premi, anche vuoto se non ci sono premi |

Ogni premio ha `id` univoco nel gioco, `name`, `description` e `image` facoltativa.
Il campo facoltativo `quantity` indica un numero intero positivo di unita':
con `quantity: 5` si vede "5 x" accanto all'immagine del premio nelle schede
e prima di giocare. Le anteprime formano una griglia con celle di uguale larghezza,
quantita' allineate a destra e immagini allineate per colonna; su schermi stretti
le colonne si riducono. Nomi e descrizioni non occupano spazio visibile. Il nome rimane nel testo
alternativo dell'immagine e nel suggerimento al passaggio del mouse. Senza immagine
si mostra un simbolo stella con il nome accessibile.
Se omesso vale 1. Nella vincita appaiono nome e descrizione del singolo premio,
senza il totale.
La quantita' e' informativa: non decrementa dopo una giocata e non genera o
modifica i codici vincenti, che restano configurati manualmente.
Per le immagini premio e' consigliato un formato orizzontale 5:3, con importo o
simbolo grande: la miniatura misura 96 x 60 px (80 x 50 px su mobile),
la vincita fino a 260 x 156 px.
Sono supportate anche immagini SVG, nitide a qualsiasi densita' dello schermo.
Immagini gia' pronte, da indicare nel campo `image`:

| Premio | Percorso |
| --- | --- |
| Sconto 5 euro | `Tornei/premio-sconto-5-euro.svg` |
| Cioccolatino | `Tornei/premio-cioccolatino.svg` |
| Bevanda | `Tornei/premio-bevanda.svg` |
| Spritz | `Tornei/premio-spritz.svg` |
| Gadget | `Tornei/premio-gadget.svg` |
| Dolcetto | `Tornei/premio-dolcetto.svg` |
| Panettoncino | `Tornei/premio-panettoncino.svg` |
| Torroncino | `Tornei/premio-torroncino.svg` |
| Pandorino | `Tornei/premio-pandorino.svg` |

Tutti i premi appaiono prima di giocare; dopo una vittoria si mostra quello
associato al codice. Per i premi si possono aggiungere `nameEn` e `descriptionEn`.
Con lingua EN selezionata, schede, finestra di gioco, risultato e testi alternativi
delle immagini usano i campi con suffisso `En`; tornando a IT si usano i campi
originali. Se un campo inglese manca, e' vuoto o contiene solo spazi, viene usato
il corrispondente testo italiano. Non viene effettuata traduzione automatica.

Esempio per un premio:

```json
{
  "id": "premio-1",
  "quantity": 5,
  "name": "Buono sconto",
  "nameEn": "Discount voucher",
  "description": "Valido per il prossimo torneo.",
  "descriptionEn": "Valid for the next tournament.",
  "image": "Tornei/logo.png"
}
```

## Estrazione (`draw`)

`codes` contiene **tutti** i codici validi del gioco:

```json
[
  { "code": "CODICE-A", "prizeId": "premio-1" },
  { "code": "CODICE-B" }
]
```

Il primo vince il premio con `id: "premio-1"`, il secondo non vince.
Un codice assente dall'elenco e' non valido e non avvia l'animazione.
Il confronto ignora maiuscole/minuscole e spazi iniziali/finali, non gli spazi
interni. Non usare duplicati, neppure con differenze di maiuscole.
Per aprire un'estrazione serve almeno un codice valido.

L'utente inserisce il codice e preme "Mescola le palline": l'urna si anima per
circa 2,8 secondi, poi vengono proposte tre palline. Il partecipante ne sceglie
una (anche da tastiera) per rivelare il risultato; in caso di vincita compaiono
premio e coriandoli. Con preferenza di movimento ridotto si passa direttamente
alla scelta, senza animazioni.

La scelta della pallina e' scenica: il risultato e' sempre associato al codice,
non alla posizione della pallina. Anche scegliendo palline diverse con lo stesso
codice si ottiene lo stesso risultato. "Gioca con un altro codice" azzera il
modulo; chiudere la finestra annulla l'animazione e la scelta in corso.
Non cambia la gestione manuale dei ritiri.

## Pronostico (`prediction`)

### Scelta sul sito e invio a Google Sheets

La presenza di `teams` abilita la selezione sul sito, dopo la stessa password
condivisa dell'estrazione. Inserire le squadre manualmente nel JSON:

```json
{
  "teams": [
    { "id": "squadra-1", "name": "Nome squadra 1", "nameEn": "Team 1 name" },
    { "id": "squadra-2", "name": "Nome squadra 2", "nameEn": "Team 2 name" },
    { "id": "squadra-3", "name": "Nome squadra 3" }
  ],
  "codeSourceGameId": "estrazione-esempio",
  "submissionUrl": ""
}
```

Occorrono almeno due squadre. Gli ID sono univoci, massimo 80 caratteri,
lettere minuscole, numeri e trattini; mantenerli invariati una volta aperte
le iscrizioni. I nomi hanno massimo 100 caratteri; `nameEn` e' facoltativo e,
se assente o vuoto, EN mostra il nome italiano.
`codeSourceGameId` riutilizza i codici di un'estrazione esistente, senza
modificarne premi, quantita' o assegnazioni.

Il partecipante inserisce il codice e seleziona esattamente due squadre distinte.
La conferma appare solo dopo una risposta `saved` del ricevitore. In caso di
errore di rete o timeout l'esito e' incerto: riprovare con lo stesso codice.
Il ricevitore controlla codice, squadre e apertura del gioco leggendo il JSON
pubblicato, e salva solo il primo invio per coppia gioco/codice, anche in caso
di richieste contemporanee allo stesso progetto Apps Script. Una risposta
`duplicate` non conferma le scelte correnti: quelle precedenti restano immutate.
Chiudere durante un invio non garantisce di annullare una scrittura gia' iniziata.

Il JSON contiene squadre dimostrative e lascia il pronostico `upcoming` finche'
non si configura l'invio; sostituire i nomi e attivarlo dopo i passi seguenti.
Non viene effettuata alcuna estrazione o qualificazione automatica: confrontare
nel foglio i due ID scelti con i finalisti reali e gestire i qualificati.

#### Collegare il foglio gia' associato a Google Forms

1. Nel Google Foglio aprire **Estensioni > Apps Script**. Se il progetto contiene
   gia' script, conservarli e verificare che non definiscano altri `doGet`/`doPost`.
2. Copiare [google-predictions.gs](../scripts/google-predictions.gs) nell'editor.
3. In **Impostazioni progetto > Proprieta' script** aggiungere:
   - `SPREADSHEET_ID`: la parte tra `/d/` e `/edit` nell'URL del foglio.
   - `GAMES_CONFIG_URL`: URL pubblico HTTPS di `games.json` su questo sito
     (non l'indirizzo locale `127.0.0.1`).
4. **Esegui il deployment > Nuovo deployment > Applicazione web**:
   esecuzione come **te stesso**, accesso **Chiunque** (anche senza account Google).
   Autorizzare l'accesso al foglio e alle richieste esterne. Se l'account Workspace
   non consente accesso anonimo, questa integrazione non puo' essere aperta al pubblico
   con tale account.
5. Aprire l'URL del deployment, che termina con `/exec`, in una finestra anonima:
   deve restituire `{"status":"ready"}`. Altrimenti controllare proprieta',
   permessi, URL del JSON gia' pubblicato e registro **Esecuzioni** di Apps Script.
6. Copiare l'URL `/exec` in `submissionUrl`, sostituire i nomi dimostrativi
   in `teams`, impostare `status: "open"` e pubblicare il sito. Il ricevitore usa
   sempre la configurazione pubblicata: una modifica solo locale non basta.
7. Provare dal sito con un codice di test presente nella sorgente codici,
   controllando che la conferma corrisponda a una riga nel foglio e che un
   secondo invio restituisca duplicato. Per ripetere una prova, eliminare
   esplicitamente la relativa riga di test.

La scheda **Pronostici sito** viene creata al primo invio valido. Le risposte
originali del Google Form non vengono toccate; non modificare le intestazioni
della nuova scheda. Si salvano timestamp UTC, ID gioco, codice e ID/nomi delle
due squadre. I nomi sono presi dal JSON dal server, non dai dati inviati dal browser.
Non si creano vere risposte Google Forms e non scattano i suoi trigger di invio.
Non mescolare i due canali per lo stesso gioco: la verifica duplicati riguarda
solo **Pronostici sito**, non le risposte del vecchio modulo.

`submissionUrl` deve essere un URL HTTPS di produzione
`https://script.google.com/macros/s/IDENTIFICATIVO/exec`, non `/dev`.
L'invio usa POST `text/plain` contenente JSON per evitare il preflight CORS:
non si usa `no-cors`, perche' una risposta opaca non puo' confermare il salvataggio.
Eventuali errori CORS/permessi mostrano un esito non confermato, mai un falso successo.
Per aggiornamenti al codice Apps Script aggiornare anche la versione del deployment.

Per chiudere le iscrizioni impostare `closed` nel JSON e pubblicare:
il ricevitore rifiuta nuovi invii quando legge il gioco chiuso. Usare un nuovo
ID gioco per un nuovo torneo, per non confondere i duplicati con quelli precedenti.
Apps Script e' gratuito entro le quote Google; disponibilita', limiti dell'account
e accesso anonimo dipendono da Google. Il foglio rimane privato, ma l'endpoint e i
codici del JSON sono pubblici: chi conosce un codice puo' usarlo per primo.
Non e' autenticazione forte ne' protezione da abuso delle quote.

### Collegamento al Google Form (modalita' precedente)

Senza `teams`, resta disponibile il comportamento originale.
Impostare `formUrl` con un URL HTTPS di Google Forms (`docs.google.com/forms/...`
oppure `forms.gle/...`). Il pulsante apre il modulo in una nuova scheda.
Il sito non crea moduli, non raccoglie risposte e non calcola l'idoneita'.

Nel modulo predisporre codice squadra e due selezioni di squadre distinte.
Nel Google Sheet collegato controllare codici e doppioni: una risposta valida
per codice squadra; definire prima dell'apertura quale tenere in caso di invii
multipli (consigliata la prima valida). Indicare una scadenza e chiudere anche
il modulo alla scadenza: `closed` nel JSON disabilita solo il link sul sito.
Un codice e' eleggibile automaticamente all'estrazione quando almeno una delle
due squadre pronosticate raggiunge la finale Gold; verifica ed estrazione sono
gestite dall'organizzatore nel foglio, non dal frontend.

## Limiti e gestione premi

- Il JSON e il JavaScript sono pubblici: codici e vincitori sono ispezionabili.
  `enabled: false` nasconde solo la scheda, non i dati scaricabili.
- Il codice e' un identificativo informale, non una password o prova di identita'.
- L'estrazione non ha uso unico, registro condiviso delle giocate o verifica dei ritiri.
  Solo il pronostico via Apps Script registra un invio per codice e gioco.
- L'organizzatore deve verificare il codice e annotare i premi gia' consegnati
  in un registro separato. Screenshot e animazione non provano una vincita.
- Non inserire nomi, telefoni, email o altri dati personali nel JSON pubblico.
- Non pubblicare codici/premi che richiedono segretezza o garanzie antifrode.
- Configurazioni incoerenti bloccano la pagina con errore e pulsante Riprova;
  la console riporta il campo problematico, senza stampare l'elenco dei codici.

## Verifica locale

Da root del repository:

```powershell
node --test games.test.js scripts\google-predictions.test.js
python -m http.server 8080 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:8080/games.html`. I test usano fixture separate e non
modificano i codici reali. Per un invio reale da locale, il ricevitore deve
comunque poter leggere il gioco aperto nel JSON pubblico configurato.
La verifica reale Google richiede il deployment e il controllo della riga nel foglio.
