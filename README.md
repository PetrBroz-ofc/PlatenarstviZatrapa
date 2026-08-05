# Platnéřství Pavel Zátrapa — web

Prémiový jednostránkový web pro řemeslnou dílnu historických zbrojí, přileb, štítů a chladných zbraní. Bez e‑shopu — cílem je ukázat kvalitu řemesla a získávat poptávky.

Styl: **dark luxury / museum aesthetic** — tmavé pozadí, zlatý akcent, velké fotografie, minimum textu, jemné animace.

## Struktura projektu

```
index.html          kostra webu — main.js do ní vykreslí celý obsah z data/content.json
admin.html           administrace (needexuje se v Googlu, chráněno heslem)
css/style.css        veškerý vzhled veřejného webu
css/admin.css         vzhled administrace
js/main.js            vykreslí web z JSON, animace, galerie, lightbox
js/admin.js            logika administrace, formuláře, živý náhled, ukládání
data/content.json      VEŠKERÝ text, fotky (URL), produkty, novinky, kontakt
data/theme.json         barvy a písma
api/save-content.js     serverless funkce — ověření hesla + zápis do GitHubu
favicon.svg, robots.txt, sitemap.xml, vercel.json
```

Žádný build krok, žádný framework — čistý HTML/CSS/JS. `api/` běží jako Vercel serverless funkce (Node).

## Spuštění lokálně

Web čte JSON přes `fetch`, proto nejde otevřít přímo jako soubor (`file://`) — musí běžet přes lokální server:

```bash
npx serve .
# nebo
python3 -m http.server 5173
```

Administrace (`admin.html`) navíc potřebuje běžící `api/save-content.js`, takže pro plné otestování včetně ukládání je nejjednodušší nasadit rovnou na Vercel (viz níže) nebo použít `vercel dev`.

## Nasazení na Vercel

1. Nahraj tuto složku jako repozitář na GitHub.
2. Repozitář naimportuj ve Vercelu jako nový projekt (Framework Preset: "Other" / statický web).
3. V **Project → Settings → Environment Variables** nastav:

   | Proměnná | Popis |
   |---|---|
   | `ADMIN_PASSWORD` | heslo, kterým se přihlašuješ do administrace |
   | `GITHUB_TOKEN` | GitHub Personal Access Token s právem zápisu do repozitáře (níže) |
   | `GITHUB_OWNER` | tvé uživatelské jméno / organizace na GitHubu |
   | `GITHUB_REPO` | název repozitáře s tímto webem |
   | `GITHUB_BRANCH` | volitelné, výchozí `main` |

4. Deploy. Vercel automaticky rozpozná `api/save-content.js` jako serverless funkci.

### Vytvoření GitHub tokenu

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → New token:
- Repository access: pouze tento repozitář
- Permissions → Contents: **Read and write**

Token vlož do `GITHUB_TOKEN` na Vercelu. Nikdy se neposílá do prohlížeče — administrace s ním komunikuje jen přes server (`api/save-content.js`).

## Jak funguje administrace

1. Otevři `/admin.html`, zadej heslo (`ADMIN_PASSWORD`).
2. V levém panelu přepínáš sekce (Hero, O mně, Služby, Galerie, Katalog, Novinky, Kontakt, SEO, Vzhled).
3. Každá změna se okamžitě promítne do živého náhledu vpravo (přepínatelný na Desktop / Tablet / Mobil).
4. Tlačítko **Publikovat na GitHub** uloží `data/content.json` a `data/theme.json` do repozitáře — Vercel poté web automaticky znovu nasadí (během cca minuty).
5. **Zahodit změny** vrátí formulář na naposledy publikovaný stav.
6. Záložka **JSON (pokročilé)** umožňuje upravit úplně cokoli přímo v surovém JSONu, pro případ, že by něco chybělo ve formulářích.

## Fotografie

Všechny fotografie jsou v `data/content.json` zadané jako URL nebo cesta (pole `image`, `hero.image`, `about.portraitImage` apod.) a v administraci se mění jednoduše vložením nové URL adresy — vpravo se hned zobrazí náhled.

**Aktuální stav:**
- Přilby a kyrysy (Hero, galerie, katalog) už mají **reálné fotky** nahrané v `assets/img/produkty/` — žádný placeholder.
- Štíty, meče, filmové a fantasy kusy a portrét Pavla u sekce „O mně" **stále používají dočasné placeholder fotky** z `picsum.photos` — je potřeba je nahradit reálnými snímky, než web půjde ostře.
- V `assets/img/produkty/` je navíc jedna nepoužitá fotka (`helma-salet-02.jpg`) pro případ, že by se hodila jinam.

Doporučený postup pro doplnění zbylých fotek:
1. Fotku nahraj do `assets/img/` v repozitáři (nebo na CDN dle vlastní volby).
2. V administraci vlož URL/relativní cestu k nahrané fotce do příslušného pole.

## SEO

- `index.html` obsahuje statické `<title>`, meta description, Open Graph a Twitter Card tagy a JSON‑LD strukturovaná data.
- Schema.org bohužel nemá oficiální typ „Artisan“ — použit je nejbližší validní typ `LocalBusiness` se zakladatelem typu `Person` (Pavel Zátrapa, jobTitle „Platnéř“).
- `robots.txt` explicitně povoluje běžné i AI vyhledávací roboty (GPTBot, ClaudeBot, Google-Extended…) a blokuje `/admin.html` a `/api/`.
- Pozor: pole SEO v administraci mění titulek/description pouze v JS vykresleném obsahu (živě v prohlížeči). Pro sociální sítě (Open Graph) čtou crawlery statický `<head>` v `index.html` — při zásadní změně titulku/popisu doporučujeme stejné texty ručně promítnout i tam.
- Obrázek pro Open Graph (`og:image`) používá reálnou fotku saletu — pokud budeš měnit hlavní vizuál webu, aktualizuj ho i zde.

## Přístupnost

- Viditelný focus stav na všech interaktivních prvcích, `skip-link` na začátku stránky.
- Respektuje `prefers-reduced-motion` (animace se vypnou).
- Kontrast textu na tmavém pozadí odpovídá WCAG AA pro běžný i sekundární text.
