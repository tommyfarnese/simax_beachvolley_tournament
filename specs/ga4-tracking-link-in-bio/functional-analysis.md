## 1) Obiettivo
Implementare una misurazione affidabile con Google Analytics 4 (GA4) per il sito SiMax_BVT, così da monitorare:
- aperture pagina (traffico da link in bio)
- provenienza da Instagram
- provenienza geografica (citta)
- visite giornaliere
- utenti nuovi vs di ritorno
- click su ogni pulsante chiave (con focus su iscrizione 3x3 e 2x2)

## 2) Stato attuale (as-is)
- Il progetto e una landing page statica singola in [index.html](index.html) con CSS e JavaScript inline.
- Esistono CTA e link di conversione in pagina:
  - pulsanti iscrizione con classe js-register-btn e attributo data-tournament-id
  - link form esterni con classe js-register-link
  - CTA hero e navbar verso sezione iscrizioni
  - contatti/social (Instagram, Facebook, WhatsApp, email, mappa)
- Non e presente alcun snippet GA4 (gtag.js) ne dataLayer custom per event tracking.
- Esiste JavaScript custom per UI (modal, tab, accordion, status torneo) ma senza telemetria eventi.

## 3) Ambito (in-scope / out-of-scope)
In-scope:
- Integrazione GA4 base (page_view)
- Tracciamento sorgente traffico e campagne UTM
- Definizione e invio eventi click su pulsanti/link principali
- Modellazione report per metriche richieste
- Definizione naming convention eventi/parametri
- Configurazione minima privacy/cookie banner (se necessario per conformita)

Out-of-scope:
- Migrazione a Google Tag Manager (GTM) completa (opzionale futura)
- Dashboard BI esterne (Looker Studio avanzato) oltre template minimo
- Tracking server-side
- Modifiche UX non legate a misurazione

## 4) Requisiti funzionali (FR-001...)
FR-001 - Tracciamento visite pagina:
Il sistema deve inviare page_view a GA4 ad ogni caricamento pagina.

FR-002 - Identificazione traffico da Instagram:
Il sistema deve distinguere il traffico proveniente da Instagram attraverso almeno uno dei seguenti meccanismi:
- referrer contiene instagram.com
- parametri UTM (utm_source=instagram)

FR-003 - Geolocalizzazione aggregata:
Il sistema deve rendere disponibili in GA4 le metriche geografiche aggregate per citta/area (senza raccolta di coordinate precise lato client).

FR-004 - Visite giornaliere:
Il sistema deve permettere visualizzazione del numero di visite per giorno (dimensione data + metrica visualizzazioni/sedute).

FR-005 - Nuovi vs ritornanti:
Il sistema deve consentire il confronto tra nuovi utenti e utenti di ritorno nei report standard GA4.

FR-006 - Tracking click pulsanti iscrizione:
Il sistema deve inviare un evento dedicato quando l utente clicca su:
- Iscriviti 3x3 (data-tournament-id=ev1-t2)
- Iscriviti 2x2 (data-tournament-id=ev1-t1)

FR-007 - Tracking click su altri CTA principali:
Il sistema deve inviare eventi click per CTA hero/navbar e link di contatto principali (WhatsApp, Instagram, Facebook, Email, Mappa).

FR-008 - Parametri evento minimi:
Ogni evento click deve includere almeno:
- event_name
- button_text o cta_label
- cta_location (hero/navbar/card/modal/footer)
- destination_url (se disponibile)
- tournament_id (se applicabile)

FR-009 - Distinzione click vs conversione:
Il sistema deve distinguere il click sul bottone dal completamento modulo; se il completamento non e tecnicamente osservabile sul dominio corrente, deve essere esplicitato come limite e proposta alternativa.

FR-010 - Report operativo:
Il sistema deve definire un report operativo con lettura settimanale che includa:
- utenti totali
- utenti da Instagram
- visite giornaliere
- nuovi/ritornanti
- click per ogni pulsante chiave

## 5) Requisiti non funzionali essenziali (NFR-001...)
NFR-001 - Accuratezza base:
Scostamento atteso entro limiti normali GA4 (ad blocker, consenso, anti-tracking).

NFR-002 - Performance:
Impatto minimo sul caricamento pagina; script analytics caricato in modo asincrono.

NFR-003 - Privacy e compliance:
Configurazione conforme a policy locale (consenso cookie/analytics dove richiesto).

NFR-004 - Manutenibilita:
Naming eventi e parametri documentati in modo coerente e riusabile.

NFR-005 - Verificabilita:
Ogni evento deve essere testabile in DebugView/Realtime prima del rilascio.

## 6) Criteri di accettazione (testabili)
CA-001:
Dato un utente che apre la home, quando la pagina termina il load, allora in GA4 appare page_view in Realtime.

CA-002:
Dato un accesso con UTM instagram, quando la sessione e registrata, allora source/medium mostra instagram / social (o mapping equivalente).

CA-003:
Dato traffico reale, quando si apre il report geografia GA4, allora e visibile la distribuzione per citta.

CA-004:
Dato almeno 48h di dati, quando si apre report temporale, allora si vede il conteggio visite per giorno.

CA-005:
Dato traffico misto nuovi/ritorno, quando si apre report audience, allora e disponibile il confronto nuovi vs ritornanti.

CA-006:
Dato click su bottone Iscriviti 3x3, quando l utente clicca, allora viene inviato evento con tournament_id=ev1-t2.

CA-007:
Dato click su bottone Iscriviti 2x2, quando l utente clicca, allora viene inviato evento con tournament_id=ev1-t1.

CA-008:
Dato click su CTA contatto/social, quando l utente clicca, allora evento include cta_location e destination_url.

CA-009:
Dato l uso del report eventi, quando si filtra per event_name di iscrizione, allora si puo leggere il totale click per singolo torneo.

CA-010:
Dato l assenza di cross-domain completion tracking su Google Forms, quando si analizza la funnel, allora il report evidenzia che il dato rappresenta click-intent e non submit garantito.

## 7) Dipendenze e rischi
### Dependency Matrix (Requisiti)
- FR-002 depends on: FR-001
- FR-003 depends on: FR-001
- FR-004 depends on: FR-001
- FR-005 depends on: FR-001
- FR-006 depends on: FR-001
- FR-007 depends on: FR-001
- FR-008 depends on: FR-006, FR-007
- FR-009 depends on: FR-006
- FR-010 depends on: FR-001, FR-002, FR-004, FR-005, FR-006, FR-007
- FR-001 depends on: none

### Dependency Matrix (Task candidati)
- TASK-001 Setup proprieta GA4 e data stream web depends on: none
- TASK-002 Inserimento snippet gtag.js in pagina depends on: TASK-001
- TASK-003 Definizione naming eventi/parametri depends on: TASK-001
- TASK-004 Implementazione click tracking iscrizioni (3x3, 2x2) depends on: TASK-002, TASK-003
- TASK-005 Implementazione click tracking CTA non iscrizione depends on: TASK-002, TASK-003
- TASK-006 Setup naming UTM per link in bio Instagram depends on: TASK-001
- TASK-007 Validazione Realtime + DebugView depends on: TASK-004, TASK-005, TASK-006
- TASK-008 Configurazione report/esplorazioni GA4 operative depends on: TASK-007
- TASK-009 Revisione privacy banner/consenso analytics depends on: TASK-002

Rischi principali:
- Ad blocker e browser privacy possono ridurre i volumi misurati.
- Senza UTM coerenti, attribuzione Instagram puo risultare incompleta.
- Il submit finale su Google Forms potrebbe non essere tracciabile in modo certo senza setup aggiuntivo.

## 8) Open question (solo se bloccanti)
- OQ-001 (bloccante per deploy): e gia presente un cookie banner/consent mode compatibile con GA4?
- OQ-002 (bloccante per accuratezza attribuzione): il link in bio Instagram puo essere aggiornato con UTM standardizzati?
- OQ-003 (non bloccante ma raccomandata): vuoi tracciare come conversione primaria il click su Iscriviti o il click su Apri form (intento piu vicino al submit)?
