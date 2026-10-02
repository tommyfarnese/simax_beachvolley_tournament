# Analisi funzionale - Area amministrativa tornei

## 1) Obiettivo

Realizzare un'area amministrativa riservata a due operatori autorizzati per gestire l'intero ciclo operativo degli eventi SiMax: configurazione eventi e tornei, controllo iscrizioni e liste d'attesa, composizione delle squadre, generazione dei gironi, assegnazione dei campi e successiva gestione di partite e risultati.

La soluzione mantiene il sito pubblico su GitHub Pages e pubblica l'area `/admin` dalla stessa Azure App Service del backend. L'area usa autenticazione ASP.NET Core Identity locale con cookie, registrazione pubblica disabilitata e due account amministrativi confermati. Email di bootstrap e password iniziali sono configurate tramite Azure App Settings e non vengono salvate nel repository. Questa scelta evita token persistiti nel browser e problemi di cookie cross-origin.

## 2) Stato attuale (as-is)

- Il frontend pubblico e' un singolo file HTML statico che legge eventi e stato posti dalle API Azure.
- Il backend ASP.NET Core espone lettura eventi, lettura/creazione tornei, inserimento/cancellazione iscrizioni e conteggio confermate/lista d'attesa.
- Non esistono autenticazione, autorizzazione, utenti o ruoli. `UseAuthorization()` e' presente, ma non e' configurato alcuno schema di autenticazione.
- La policy CORS consente qualunque origine, header e metodo.
- `Event` e `Tournament` hanno `IsActive`, ma non esistono endpoint amministrativi completi per creazione, modifica, pubblicazione e archiviazione.
- `Registration` contiene `TeamName` e rappresenta gia' l'unita' iscritta al torneo: puo' quindi essere usata direttamente come partecipante ai gironi tramite il suo `Id`.
- Non esistono modelli per campo, girone, appartenenza al girone, partita, risultato o classifica.
- La sincronizzazione Google Forms identifica il torneo tramite `GoogleFormId` e inserisce iscrizioni mediante API key.
- L'API key di sviluppo e' presente in `appsettings.json`; le credenziali di produzione devono risiedere esclusivamente in Azure App Settings/Key Vault.

## 3) Ambito (in-scope / out-of-scope)

### In-scope

- Login/logout per due amministratori senza registrazione pubblica.
- Dashboard con eventi imminenti, stato tornei, iscritti, posti e anomalie.
- CRUD e pubblicazione/archiviazione di eventi, tornei e categorie.
- Gestione iscrizioni: consultazione, ricerca, conferma, lista d'attesa, ritiro ed eliminazione controllata.
- Utilizzo delle iscrizioni confermate come squadre partecipanti, mostrando `TeamName` nei gironi.
- Generazione configurabile dei gironi da squadre confermate.
- Anteprima, correzione manuale e conferma dei gironi prima della pubblicazione.
- Configurazione dei campi disponibili e generazione di una bozza di calendario partite senza sovrapposizioni.
- Inserimento risultati e classifica del girone, in una fase successiva al generatore gironi.
- Audit minimo delle operazioni amministrative rilevanti.

### Out-of-scope iniziale

- Registrazione autonoma di nuovi amministratori.
- Ruoli complessi oltre ad `Admin`.
- Pagamenti online, fatturazione e rimborsi.
- App mobile nativa.
- Algoritmo completo per tabelloni GOLD/SILVER ed eliminazione diretta nel primo rilascio.
- Invio massivo di email/WhatsApp nel primo rilascio.
- Gestione live arbitrale o referto digitale nel primo rilascio.
- Normalizzazione separata di giocatori e roster dinamici; potra' essere introdotta in seguito senza bloccare i gironi.

## 4) Requisiti funzionali (FR-001...)

- **FR-001 - Accesso amministrativo:** il sistema deve autenticare esclusivamente account amministrativi preconfigurati e consentire login e logout.
- **FR-002 - Autorizzazione:** tutte le pagine e API amministrative devono richiedere il ruolo `Admin`; le API pubbliche devono restare accessibili senza login.
- **FR-003 - Dashboard:** l'amministratore deve vedere eventi futuri, tornei, iscrizioni confermate, lista d'attesa, posti residui e segnalazioni di configurazione incompleta.
- **FR-004 - Gestione eventi:** l'amministratore deve creare, modificare, attivare, disattivare e archiviare un evento con titolo, data, luogo, indirizzo e fascia descrittiva.
- **FR-005 - Gestione tornei:** l'amministratore deve creare, modificare, ordinare, attivare e disattivare tornei associati a un evento, configurando categoria, formato, orari, quota, capienza, giocatori minimi e riferimenti Google Form.
- **FR-006 - Validazione configurazione:** il sistema deve impedire valori incoerenti, inclusi orario fine precedente all'inizio, capienza non positiva, categoria inesistente e date evento non valide.
- **FR-007 - Gestione iscrizioni:** l'amministratore deve elencare e filtrare le iscrizioni per torneo e stato, visualizzarne i dettagli e modificarne lo stato tra `Confirmed`, `Waitlist`, `Withdrawn` e `Cancelled`.
- **FR-008 - Ordinamento lista d'attesa:** il sistema deve conservare l'ordine di ingresso e consentire la promozione controllata dalla lista d'attesa quando si libera un posto.
- **FR-009 - Squadre iscritte:** il sistema deve trattare ogni `Registration` confermata come una squadra partecipante, identificarla tramite `Registration.Id` e mostrarla nei gironi tramite `TeamName`.
- **FR-010 - Configurazione gironi:** l'amministratore deve specificare numero di gironi, numero desiderato di squadre per girone e criterio di distribuzione (`casuale`, `bilanciato per seed`, `manuale`).
- **FR-011 - Validazione gironi:** prima della generazione il sistema deve mostrare capienza totale, squadre disponibili, eventuali esclusioni o posti vuoti e bloccare configurazioni matematicamente impossibili salvo esplicita gestione dei bye.
- **FR-012 - Generazione gironi:** il sistema deve assegnare ogni squadra confermata a non piu' di un girone, generare una bozza riproducibile e permettere rigenerazione finche' non viene confermata.
- **FR-013 - Modifica e conferma gironi:** l'amministratore deve spostare manualmente squadre tra gironi, rinominare i gironi e confermare la composizione; ogni rigenerazione successiva deve richiedere conferma esplicita.
- **FR-014 - Gestione campi:** l'amministratore deve configurare per evento il numero e il nome dei campi, con eventuali finestre di disponibilita'.
- **FR-015 - Calendario partite:** a partire dai gironi confermati, il sistema deve generare incontri round-robin e assegnare orario/campo evitando che una squadra giochi due incontri contemporaneamente.
- **FR-016 - Risultati e classifica:** l'amministratore deve inserire risultati, correggerli e visualizzare la classifica calcolata secondo regole configurate per il torneo.
- **FR-017 - Audit:** il sistema deve registrare amministratore, data/ora, operazione ed entita' interessata per modifiche a eventi, tornei, iscrizioni, gironi e risultati.

### 4.1 Primo incremento - Autenticazione admin

- L'area amministrativa e' esposta sotto `/admin`; ogni pagina diversa dal login richiede un utente autenticato nel ruolo `Admin`.
- `GET /admin/account/login` mostra il form email/password senza link di registrazione.
- `POST /admin/account/login` usa ASP.NET Core Identity, antiforgery token e un messaggio generico per credenziali non valide, senza rivelare se l'email esiste.
- `POST /admin/account/logout` termina la sessione e reindirizza al login; il logout non deve essere esposto tramite `GET`.
- `GET` e `POST /admin/account/change-password` consentono a un amministratore autenticato di sostituire la password iniziale.
- Il ruolo `Admin` e i due utenti vengono creati da un servizio di bootstrap idempotente leggendo `AdminBootstrap:Users` da Azure App Settings.
- Il bootstrap crea solo utenti mancanti e assegna il ruolo; non reimposta automaticamente la password di account gia' esistenti a ogni avvio.
- Email e password iniziali sono obbligatorie solo durante il provisioning e non devono essere scritte nei log.
- Dopo 5 tentativi falliti l'account viene bloccato per 15 minuti.
- Il cookie amministrativo usa `HttpOnly`, `Secure`, `SameSite=Lax`, scadenza inattiva di 30 minuti e rinnovo scorrevole.
- Il recupero password via email e' escluso dal primo incremento; un account bloccato definitivamente o con password dimenticata viene recuperato tramite procedura amministrativa protetta sull'App Service.

## 5) Requisiti non funzionali essenziali (NFR-001...)

- **NFR-001 - Sicurezza account:** password memorizzate esclusivamente mediante ASP.NET Core Identity; nessuna password o API key nel repository.
- **NFR-002 - Sessione:** cookie `HttpOnly`, `Secure`, scadenza limitata e protezione CSRF per tutte le operazioni mutative.
- **NFR-003 - Superficie API:** CORS di produzione limitato alle origini esplicitamente necessarie; endpoint admin protetti server-side, mai solo nascosti nel frontend.
- **NFR-004 - Integrita':** modifiche che coinvolgono piu' entita', come conferma gironi e generazione partite, devono essere transazionali.
- **NFR-005 - Concorrenza:** entita' amministrate devono supportare controllo di concorrenza ottimistico per evitare sovrascritture tra i due operatori.
- **NFR-006 - Usabilita':** l'area admin deve essere utilizzabile da desktop e tablet, con tabelle filtrabili e conferme chiare per azioni distruttive.
- **NFR-007 - Prestazioni:** dashboard ed elenchi devono completare il caricamento ordinario entro 2 secondi con almeno 500 iscrizioni per torneo.
- **NFR-008 - Recuperabilita':** eliminazioni di eventi, tornei, squadre e gironi devono essere logiche quando esistono dati collegati; cancellazione fisica solo per record privi di dipendenze.
- **NFR-009 - Osservabilita':** errori di login, import iscrizioni e generazione calendario devono essere registrati senza dati personali sensibili.

## 6) Criteri di accettazione (testabili)

1. Un utente non autenticato che apre `/admin` viene reindirizzato al login e riceve `401/403` chiamando una API admin.
2. I due account autorizzati possono accedere; un terzo account non configurato non puo' registrarsi ne' ottenere accesso.
3. Un amministratore crea un evento con tre tornei, lo pubblica e il sito pubblico lo visualizza tramite `GET /api/events` senza modifiche manuali al frontend.
4. Un torneo non valido, ad esempio con `EndTime <= StartTime`, viene rifiutato con messaggio comprensibile.
5. La dashboard mostra per ogni torneo conteggi coerenti con iscrizioni `Confirmed` e `Waitlist` e il numero corretto di posti residui.
6. Cambiando un'iscrizione da `Waitlist` a `Confirmed`, il conteggio posti viene aggiornato e non puo' superare `MaxTeams` senza override amministrativo esplicito e auditato.
7. Ogni iscrizione `Confirmed` con `TeamName` compare una sola volta tra le squadre selezionabili per i gironi; iscrizioni `Waitlist`, `Withdrawn` o `Cancelled` non sono selezionate automaticamente.
8. Con 16 squadre confermate e configurazione 4 gironi da 4, la generazione assegna tutte le squadre una sola volta e crea quattro gironi da quattro.
9. Con 15 squadre e configurazione 4 gironi da 4, l'anteprima segnala un posto vuoto e richiede una scelta esplicita prima della conferma.
10. Una squadra spostata manualmente da un girone a un altro resta nella posizione scelta dopo salvataggio e ricaricamento.
11. Con 4 gironi, 4 squadre per girone e 4 campi, il calendario genera 24 incontri round-robin e non assegna la stessa squadra a due partite sovrapposte.
12. Due amministratori che modificano contemporaneamente lo stesso torneo ricevono un conflitto sulla seconda scrittura obsoleta invece di perdere dati silenziosamente.
13. Ogni modifica amministrativa rilevante e' consultabile nell'audit con utente, timestamp, tipo operazione e identificativo entita'.

### Criteri di accettazione specifici TSK-001

1. Al primo avvio con configurazione valida vengono creati il ruolo `Admin` e i due utenti configurati; un secondo avvio non crea duplicati e non modifica le password esistenti.
2. Avviando l'applicazione senza configurazione completa in ambiente Production, il bootstrap fallisce con errore esplicito che non contiene password.
3. Credenziali valide creano una sessione e consentono di aprire `/admin`; credenziali errate restituiscono sempre lo stesso messaggio generico.
4. Dopo 5 password errate lo stesso account non puo' accedere per 15 minuti anche usando la password corretta.
5. Un utente autenticato ma privo del ruolo `Admin` riceve `403` sulle risorse amministrative.
6. Il logout tramite `POST` invalida la sessione; una successiva richiesta a `/admin` torna al login.
7. Le richieste `POST` prive di antiforgery token vengono rifiutate.
8. Il cambio password richiede la password corrente e rende immediatamente inutilizzabile quella precedente.
9. Il cookie emesso contiene gli attributi `HttpOnly`, `Secure` e `SameSite=Lax` e scade dopo 30 minuti di inattivita'.

## 7) Dipendenze e rischi

### Dependency Matrix (Requisiti)

| Requisito | depends on |
|---|---|
| FR-001 | depends on: none |
| FR-002 | depends on: FR-001 |
| FR-003 | depends on: FR-002, FR-004, FR-005, FR-007 |
| FR-004 | depends on: FR-002 |
| FR-005 | depends on: FR-002, FR-004 |
| FR-006 | depends on: FR-004, FR-005 |
| FR-007 | depends on: FR-002, FR-005 |
| FR-008 | depends on: FR-007 |
| FR-009 | depends on: FR-007 |
| FR-010 | depends on: FR-005, FR-009 |
| FR-011 | depends on: FR-010 |
| FR-012 | depends on: FR-010, FR-011 |
| FR-013 | depends on: FR-012 |
| FR-014 | depends on: FR-002, FR-004 |
| FR-015 | depends on: FR-013, FR-014 |
| FR-016 | depends on: FR-015 |
| FR-017 | depends on: FR-001, FR-002 |

### Dependency Matrix (Task candidati)

| Task | Descrizione | depends on |
|---|---|---|
| TSK-001 | Introdurre Identity locale, cookie auth, ruolo Admin e provisioning dei due account da Azure App Settings | depends on: none |
| TSK-002 | Servire shell admin `/admin` dalla App Service e proteggere route/API | depends on: TSK-001 |
| TSK-003 | Separare DTO pubblici e DTO amministrativi con validazione | depends on: TSK-001 |
| TSK-004 | Completare CRUD eventi, categorie e tornei con soft delete e concorrenza | depends on: TSK-003 |
| TSK-005 | Implementare dashboard e gestione iscrizioni/stati | depends on: TSK-002, TSK-003 |
| TSK-006 | Consolidare Registration come partecipante, validando TeamName e stati ammessi | depends on: TSK-003, TSK-005 |
| TSK-007 | Implementare modelli Pool e PoolEntry collegati a Registration con bozza/conferma | depends on: TSK-006 |
| TSK-008 | Implementare validatore e generatore gironi deterministico | depends on: TSK-007 |
| TSK-009 | Implementare editor manuale e conferma gironi | depends on: TSK-008 |
| TSK-010 | Implementare modelli Court, CourtAvailability e Match | depends on: TSK-004, TSK-007 |
| TSK-011 | Implementare generatore round-robin e schedulazione campi | depends on: TSK-009, TSK-010 |
| TSK-012 | Implementare risultati, regole classifica e standings | depends on: TSK-011 |
| TSK-013 | Implementare audit amministrativo trasversale | depends on: TSK-001, TSK-003 |
| TSK-014 | Restringere CORS e spostare segreti in Azure App Settings/Key Vault | depends on: TSK-001 |
| TSK-015 | Test integrazione auth/CRUD e test deterministici generatori | depends on: TSK-004, TSK-005, TSK-008, TSK-011 |

### Rischi principali

- `TeamName` non deve essere usato come chiave: omonimie e rinominazioni vanno gestite mantenendo `Registration.Id` come riferimento stabile nei gironi.
- Google Forms puo' continuare a essere il canale di ingresso, ma il mapping delle risposte deve supportare formati squadra diversi e idempotenza per evitare duplicati.
- Il generatore calendario e' un problema di vincoli: numero campi, durata match, pause e indisponibilita' devono essere configurati esplicitamente prima di promettere una schedulazione sempre risolvibile.
- La cancellazione fisica di tornei con iscrizioni, gironi o partite puo' compromettere lo storico; e' preferibile archiviazione logica.
- `AllowAnyOrigin` e l'API key nel file di configurazione sono adeguati solo allo sviluppo e vanno corretti prima di esporre endpoint amministrativi.

### Sequenza consigliata

1. **Fase 1 - Admin MVP:** TSK-001..TSK-005, TSK-013, TSK-014. Consente gestione sicura di eventi, tornei e iscrizioni.
2. **Fase 2 - Iscrizioni e gironi:** TSK-006..TSK-009. Usa direttamente le registrazioni confermate come squadre e introduce il nucleo competitivo configurabile.
3. **Fase 3 - Campi e calendario:** TSK-010..TSK-011. Produce incontri e assegnazioni operative.
4. **Fase 4 - Risultati:** TSK-012 e completamento test TSK-015.

## 8) Open question (solo se bloccanti)

- **OQ-002:** definire la durata standard di una partita, eventuale pausa tra partite e se un campo puo' ospitare tornei diversi nella stessa fascia. Questi dati sono bloccanti solo per TSK-011.
- **OQ-003:** definire le regole ufficiali di classifica (punti vittoria, quoziente set/punti, spareggi). Sono bloccanti solo per TSK-012.