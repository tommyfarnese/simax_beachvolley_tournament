# Analisi Funzionale: Hardcoding Torneo 20 Settembre 2026 e Rimozione Chiamata Dinamica

## 1) Obiettivo
Eliminare la chiamata di rete verso l'endpoint Google Apps Script dedicato al torneo del 20 settembre 2026 (`firstTournament`), fissando i dati del torneo e il conteggio posti disponibili (pari a 2) direttamente nel codice sorgente (`index.html`). Questo riduce la latenza di caricamento (LCP/TTI) ed evita flickering/ritardi legati al foglio Google. È inoltre prevista una strategia per la dismissione pulita della sezione dopo il 20 settembre 2026.

## 2) Stato attuale (as-is)
- Nel file [index.html](index.html):
  - L'evento del 20 Settembre 2026 è presente sia come markup HTML statico di fallback (sezioni `#tornei` e `#iscrizioni`), sia tramite caricamento asincrono via `TOURNAMENT_CONFIG_ENDPOINTS.firstTournament` in `loadTournamentConfig()`.
  - La funzione `loadTournamentConfig()` invoca contemporaneamente `firstTournament` e `futureTournaments`, sovrascrivendo il markup tramite `renderTournamentConfig()`.
  - `TOURNAMENT_STATUS_ENDPOINTS` ed il metodo `loadTournamentStatuses()` eseguono ulteriori chiamate per calcolare posti rimanenti e lista d'attesa per `ev1-t2` (3×3) ed `ev1-t1` (2×2).
  - La dipendenza da endpoint multipli di Google Apps Script introduce tempi di attesa significativi (fino a timeout di 30s con retry).

## 3) Ambito (in-scope / out-of-scope)
### In-Scope
- Disabilitazione/rimozione della chiamata HTTP all'endpoint `firstTournament`.
- Definizione statica nel codice dei dettagli per l'evento 20 Settembre (3×3 Mix e 2×2 Mix).
- Impostazione fissa dei posti disponibili a 2 (es. barra di avanzamento e badge "Posti disponibili: 2 / 12").
- Isolamento del fetch dinamico per i soli eventi futuri (`futureTournaments`), gestendo la combinazione tra evento fisso e futuri eventi dinamici senza sovrascritture distruttive.
- Documentazione dei punti di rimozione post-evento (21+ Settembre 2026).

### Out-of-Scope
- Modifica dei Google Form di iscrizione associati ai tornei.
- Modifiche grafiche al layout o al design system delle card torneo.
- Rimozione del tracking GA4/Cookie consent.

## 4) Requisiti funzionali (FR-001...)
- **FR-001**: Disattivare l'interrogazione dell'endpoint `firstTournament` all'avvio della pagina.
- **FR-002**: Visualizzare le card del torneo del 20 Settembre (3×3 Mix e 2×2 Mix) con dati statici immediati al caricamento del DOM.
- **FR-003**: Mostrare per i tornei del 20 Settembre un numero fisso di posti disponibili pari a 2 (rapporto 10/12 occupati, stato "Iscrizioni aperte").
- **FR-004**: Mantenere attivo il pulsante "Iscriviti" con reindirizzamento al relativo Google Form modale già configurato.
- **FR-005**: Mantenere la chiamata asincrona solo per eventuali eventi futuri (`futureTournaments`), appendendo o fondendo i risultati senza azzerare l'evento del 20 Settembre.
- **FR-006**: Predisporre flag o commenti di deprecazione marcati `TODO: REMOVE_AFTER_2026_09_20` per facilitare l'eliminazione rapida del blocco una volta trascorsa la data.

## 5) Requisiti non funzionali essenziali (NFR-001...)
- **NFR-001 (Performance)**: Riduzione del tempo di visualizzazione iniziale della prima card evento a 0 ms aggiuntivi di rete (rendering sincrono da DOM/JS locale).
- **NFR-002 (Robustezza)**: In caso di errore o assenza di tornei futuri da `futureTournaments`, la card del 20 Settembre deve rimanere perfettamente navigabile e registrabile.
- **NFR-003 (Manutenibilità)**: Concentrare la configurazione statica in una costante dedicata per permettere la rimozione in un unico punto del codice.

## 6) Criteri di accettazione (testabili)
- **AC-001**: All'apertura della pagina, non viene eseguita alcuna richiesta di rete verso l'URL di `firstTournament`.
- **AC-002**: La card "Torneo di Apertura SiMax - 20 Set" appare immediatamente, indicando "Posti disponibili: 2 / 12" e barra di riempimento all'~83%.
- **AC-003**: Cliccando su "Iscriviti" si apre correttamente la modale con il Google Form del rispettivo torneo (3×3 o 2×2).
- **AC-004**: Se l'endpoint `futureTournaments` risponde con successo, i nuovi tornei vengono visualizzati in coda all'evento del 20 Settembre.
- **AC-005**: Il countdown su `#countdown-section` calcola correttamente i giorni mancanti al 20 Settembre 2026 senza attendere risposte remote.

## 7) Dipendenze e rischi
### Dependency Matrix (Requisiti)
- `FR-002 depends on FR-001`
- `FR-003 depends on FR-002`
- `FR-004 depends on FR-002`
- `FR-005 depends on FR-001`
- `FR-006 depends on FR-002`

### Dependency Matrix (Task candidati)
- `TASK-001 (Rimozione endpoint firstTournament da TOURNAMENT_CONFIG_ENDPOINTS) depends on: none`
- `TASK-002 (Iniezione configurazione statica 20 Settembre con posti=2) depends on TASK-001`
- `TASK-003 (Adattamento logica di merge tra eventi statici e futureTournaments) depends on TASK-002`
- `TASK-004 (Aggiunta marcatori deprecazione post-20-sett) depends on TASK-002`
- `TASK-005 (Verifica manuale rendering e link modale) depends on TASK-003, TASK-004`

### Rischi identificati
- *Sovrascrittura da cache locale*: La presenza di dati in `localStorage` (`simax_tournament_config_cache`) potrebbe ripristinare vecchi payload remoti se non resettata/invalidata all'avvio.

## 8) Open question (solo se bloccanti)
- *Nessuna open question bloccante*. Tutti i parametri (date, format, quote, URL form, posti fissati a 2) sono già consolidati nel codice attuale di [index.html](index.html).
