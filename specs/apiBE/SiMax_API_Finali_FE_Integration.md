# SiMax – API Finali / Frontend Integration

Documento per il collegamento del Frontend alle API delle fasi finali.

## 1. Configurazione delle fasi finali

### GET
`/api/admin/tournaments/{tournamentId}/final-phases`

Restituisce la configurazione delle fasi finali.

Esempio:

```json
[
  {
    "id": 1,
    "name": "GOLD",
    "eliminationType": "SingleElimination",
    "qualifiedTeamsCount": 8,
    "rules": [
      {
        "ruleType": "Position",
        "poolPosition": 1,
        "count": 1
      },
      {
        "ruleType": "Position",
        "poolPosition": 2,
        "count": 1
      },
      {
        "ruleType": "BestOfPosition",
        "poolPosition": 3,
        "count": 2
      }
    ]
  }
]
```

### Tipi di regola

- `Position`: prende una squadra da ogni girone che occupa quella posizione.
- `BestOfPosition`: prende le migliori N squadre tra tutti i gironi in quella posizione.
- `WorstOfPosition`: prende le peggiori N squadre tra tutti i gironi in quella posizione.

La classifica usa:

1. Vittorie
2. Punti fatti
3. Differenza punti
4. Nome squadra (solo spareggio tecnico deterministico)

---

## 2. Configurazione / modifica delle fasi

### PUT
`/api/admin/tournaments/{tournamentId}/final-phases`

Esempio body:

```json
{
  "phases": [
    {
      "name": "GOLD",
      "eliminationType": "SingleElimination",
      "rules": [
        {
          "ruleType": "Position",
          "poolPosition": 1,
          "count": 1
        },
        {
          "ruleType": "Position",
          "poolPosition": 2,
          "count": 1
        }
      ]
    },
    {
      "name": "SILVER",
      "eliminationType": "SingleElimination",
      "rules": [
        {
          "ruleType": "Position",
          "poolPosition": 3,
          "count": 1
        }
      ]
    }
  ]
}
```

Il backend valida:

- nome fase obbligatorio e univoco;
- almeno una fase;
- almeno una regola per fase;
- `SingleElimination`;
- regole supportate;
- posizione valida;
- `Position` deve avere `count = 1`;
- `BestOfPosition` / `WorstOfPosition` non possono richiedere più squadre del numero di gironi;
- nessuna posizione duplicata nella stessa fase;
- ogni fase deve avere un numero di qualificate potenza di 2.

Valori validi:

`2, 4, 8, 16, 32, ...`

---

## 3. Qualificate di una fase

### GET
`/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/qualifiers`

Esempio:

```json
[
  {
    "registrationId": 12,
    "teamName": "Team A",
    "poolId": 1,
    "poolName": "Pool A",
    "position": 1,
    "matchesPlayed": 3,
    "wins": 3,
    "losses": 0,
    "pointsFor": 63,
    "pointsAgainst": 42,
    "pointDifference": 21
  }
]
```

Il FE può usare questi dati per mostrare la preview delle squadre qualificate.

---

## 4. Generazione del tabellone

### POST
`/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/generate`

Genera il bracket della fase finale.

Importante: questo endpoint genera il tabellone, ma NON assegna ancora campo e orario.

Con 8 squadre:

```text
QUARTER FINALS
       ↓
SEMIFINALS
       ↓
FINAL
```

I turni successivi hanno riferimenti alle partite precedenti tramite:

- `team1SourceMatchId`
- `team2SourceMatchId`

Esempio:

```text
QF1 ─┐
     ├── SF1 ─┐
QF2 ─┘        │
              ├── FINAL
QF3 ─┐        │
     ├── SF2 ─┘
QF4 ─┘
```

Le semifinali possono inizialmente avere una squadra non ancora determinata.

---

## 5. Lettura delle partite finali

### GET
`/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/matches`

Esempio:

```json
[
  {
    "id": 101,
    "finalPhaseId": 1,
    "roundNumber": 1,
    "matchNumber": 1,
    "courtId": 2,
    "courtName": "Campo 2",
    "startTime": "2026-10-10T15:00:00",
    "endTime": "2026-10-10T15:20:00",
    "team1RegistrationId": 12,
    "team1Name": "Team A",
    "team2RegistrationId": 18,
    "team2Name": "Team B",
    "team1Score": null,
    "team2Score": null,
    "status": "Scheduled",
    "team1SourceMatchId": null,
    "team2SourceMatchId": null
  }
]
```

Il FE non deve calcolare il bracket: usa i dati restituiti dalle API.

---

## 6. Programmazione automatica delle finali

### POST
`/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/schedule`

Assegna automaticamente:

- campo;
- data/ora di inizio;
- data/ora di fine.

La durata è sempre di 20 minuti.

Gli slot sono:

```text
09:30
09:50
10:10
10:30
10:50
...
```

Lo scheduler considera:

- campi assegnati al torneo;
- campi attivi;
- `CourtAvailability`;
- partite dei gironi già programmate;
- conflitti tra finali;
- dipendenze tra i turni.

Esempio con 4 campi:

```text
15:00  QF1 → Campo 1
15:00  QF2 → Campo 2
15:00  QF3 → Campo 3
15:00  QF4 → Campo 4

15:20  SF1 → Campo 1
15:20  SF2 → Campo 2

15:40  FINAL → Campo 1
```

Il FE deve visualizzare il risultato restituito dal backend.

---

## 7. Modifica manuale di una partita

### PUT
`/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/matches/{matchId}/schedule`

Body:

```json
{
  "courtId": 3,
  "startTime": "2026-10-10T15:40:00"
}
```

Il FE NON invia `endTime`.

Il backend calcola automaticamente:

```text
startTime = 15:40
endTime   = 16:00
```

Il backend controlla:

1. campo appartenente all'evento;
2. campo attivo;
3. campo assegnato al torneo;
4. disponibilità del campo;
5. conflitti con partite dei gironi;
6. conflitti con altre finali;
7. la partita successiva non deve iniziare prima della fine di questa;
8. questa partita non deve iniziare prima della fine delle sue partite precedenti;
9. non deve essere prima dell'inizio del torneo.

In caso di errore viene restituito:

`400 Bad Request`

con un messaggio descrittivo.

---

## 8. Inserimento risultato finale

### PUT
`/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/matches/{matchId}/result`

Body:

```json
{
  "team1Score": 21,
  "team2Score": 18
}
```

Regole:

- punteggi >= 0;
- niente pareggio;
- entrambe le squadre devono essere determinate;
- una partita cancellata non può ricevere risultato.

Quando viene inserito il risultato, il vincitore viene automaticamente propagato alla partita successiva.

Esempio:

```text
QF1
 ↓
winner
 ↓
SF1
```

Il FE non deve aggiornare manualmente la semifinale.

---

## 9. Stati delle FinalMatch

Gli stati utilizzati sono:

- `Scheduled`
- `Completed`
- `Cancelled`

### Scheduled
Partita programmata ma non ancora conclusa.

### Completed
Risultato inserito.

### Cancelled
Partita annullata.

---

## 10. Struttura consigliata della pagina FE

La pagina admin delle finali può essere organizzata in:

### Fasi finali

```text
GOLD  • 8 squadre
SILVER • 4 squadre

[Configura] [Qualificate]
```

### Bracket

```text
QF1 ─────┐
QF2 ─────┤─ SF1 ─────┐
          │           │
QF3 ─────┤─ SF2 ─────┤─ FINAL
QF4 ─────┘            │
                      │
```

### Programmazione

```text
[Genera automaticamente]

QF1  Team A - Team B
     Campo 1  15:00-15:20
     [Modifica]

QF2  Team C - Team D
     Campo 2  15:00-15:20
     [Modifica]
```

---

## 11. Responsabilità FE / BE

Il FE NON deve implementare:

- algoritmo di qualificazione;
- algoritmo di generazione del bracket;
- algoritmo di scheduling;
- controllo sovrapposizioni;
- controllo dipendenze tra i turni;
- calcolo dell'orario di fine.

Il FE deve:

1. chiamare le API;
2. visualizzare fasi e qualificate;
3. visualizzare il bracket;
4. chiamare la generazione del bracket;
5. chiamare la programmazione automatica;
6. permettere all'admin di modificare campo/orario;
7. mostrare gli eventuali errori restituiti dal BE;
8. inserire i risultati delle partite.

---

## 12. Riepilogo API

| Funzione | Metodo | Endpoint |
|---|---|---|
| Leggi fasi | GET | `/api/admin/tournaments/{tournamentId}/final-phases` |
| Configura fasi | PUT | `/api/admin/tournaments/{tournamentId}/final-phases` |
| Leggi qualificate | GET | `/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/qualifiers` |
| Genera bracket | POST | `/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/generate` |
| Leggi partite | GET | `/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/matches` |
| Scheduling automatico | POST | `/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/schedule` |
| Scheduling manuale | PUT | `/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/matches/{matchId}/schedule` |
| Inserisci risultato | PUT | `/api/admin/tournaments/{tournamentId}/final-phases/{phaseId}/matches/{matchId}/result` |
