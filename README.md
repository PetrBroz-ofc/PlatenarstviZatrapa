# Platnéřství Pavel Zátrapa — web

Prémiový jednostránkový web pro řemeslnou dílnu historických zbrojí, přileb, štítů a chladných zbraní. Bez e‑shopu — cílem je ukázat kvalitu řemesla a získávat poptávky.

Architektura je stejná jako u webu Tesařství a pokrývačství Šuta: **statické HTML + JSON obsah + Vercel serverless API + GitHub jako úložiště obsahu** (žádná databáze).

## Jak to funguje

- **`data/content.json`** a **`data/theme.json`** jsou jediný zdroj pravdy pro veškerý text, fotky, ceny i barvy.
- **`index.html` je vygenerovaný staticky** ze `content.json`/`theme.json` (viz `lib/render.js` + `scripts/build.js`) — obsah je natvrdo v HTML, takže web funguje i bez JavaScriptu a při načítání nic nebliká ani nemizí.
- **`js/main.js`** už nic nevykresluje z JSON — jen "oživuje" existující HTML (scroll v hlavičce, mobilní menu, animace, filtr galerie, lightbox).
- **Administrace (`admin.html`)** čte a zapisuje obsah přes `/api/save`, které ho ukládá přímo do GitHub repozitáře. Po uložení GitHub automaticky spustí nový Vercel deploy a web se do pár desítek sekund aktualizuje.

```
index.html          staticky vygenerované HTML (viz lib/render.js)
admin.html            administrace — vyžaduje heslo při KAŽDÉM načtení
css/style.css          vzhled veřejného webu
css/admin.css           vzhled administrace
js/main.js               "oživení" statického HTML (bez fetchování JSON)
js/admin.js                logika administrace
lib/render.js               šablony — jediný zdroj pravdy pro HTML (Node, sdílí ho scripts/build.js i api/save.js)
lib/auth.js                  session cookie, rate limiting, konstantní čas porovnání hesla
lib/github.js                 GitHub Contents/Git Data API
lib/validate.js                lehká validace tvaru content.json/theme.json
api/login.js               přihlášení / odhlášení (POST / DELETE)
api/save.js                  načtení a uložení obsahu (GET / POST)
api/upload-image.js            nahrávání fotek
scripts/build.js              lokální přegenerování index.html (`npm run build`)
tests/smoke.test.js            jsdom testy (`npm test`)
data/content.json, data/theme.json
```

Žádný frontendový framework, žádný bundler. `api/`, `lib/` a `scripts/` běží v Node (Vercel serverless funkce / lokální skripty).

## Nasazení na Vercel

1. Nahraj tuto složku jako repozitář na GitHub.
2. Repozitář naimportuj ve Vercelu jako nový projekt (Framework Preset: „Other“).
3. V **Project → Settings → Environment Variables** nastav:

   | Proměnná | Popis |
   |---|---|
   | `ADMIN_PASSWORD` | heslo do administrace — obyčejný text, lze kdykoliv změnit přímo ve Vercelu, nikde se nehashuje |
   | `SESSION_SECRET` | náhodný dlouhý řetězec pro podepisování session cookie — vygeneruj např. `openssl rand -hex 32` |
   | `GITHUB_TOKEN` | GitHub Personal Access Token s právem zápisu do repozitáře (níže) |
   | `GITHUB_OWNER` | uživatelské jméno / organizace na GitHubu |
   | `GITHUB_REPO` | název repozitáře s tímto webem |
   | `GITHUB_BRANCH` | volitelné, výchozí `main` |

4. Deploy. Vercel automaticky rozpozná `api/*.js` jako serverless funkce.

### Vytvoření GitHub tokenu

GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → New token:
- Repository access: pouze tento repozitář
- Permissions → Contents: **Read and write**

Token vlož do `GITHUB_TOKEN` na Vercelu. Nikdy se neposílá do prohlížeče — administrace s ním komunikuje jen přes server (`api/*.js`).

## Bezpečnost administrace

- **Přihlášení je vyžadováno při každém načtení `/admin.html`** — i kdyby ještě platila session cookie z minula, přihlašovací obrazovka se zobrazí vždy znovu. Cookie (`pz_session`, httpOnly) pak jen drží přihlášení pro následné akce (uložení, upload) během té jedné návštěvy.
- Porovnání hesla probíhá v konstantním čase (`crypto.timingSafeEqual` nad hashem obou hodnot), aby nešlo heslo uhodnout měřením času odpovědi.
- **Rate limiting** na přihlašování: max. 8 pokusů za 10 minut. Bezstavově přes podepsanou cookie (bez databáze) — při opakovaném selhání vrací `429`.
- Session cookie i cookie s počtem pokusů jsou **HttpOnly** (nejdou přečíst z JS) a se **Secure** flagem v produkci.
- **CSP, HSTS a další bezpečnostní hlavičky** jsou nastavené v `vercel.json`.
- `admin.html` má `X-Robots-Tag: noindex` a `Cache-Control: no-store`.

## Ochrana proti přepsání souběžných změn

`api/save.js` si **vždy znovu stáhne aktuální (živou) verzi `content.json`/`theme.json` z GitHubu** těsně před zápisem a porovná jejich git `sha` s tím, ze kterého vycházel prohlížeč při načtení administrace. Pokud se mezitím obsah na GitHubu změnil (např. běžela jiná admin session, nebo někdo commitnul změnu ručně), uložení se **odmítne s chybou 409** — nic se tiše nepřepíše. Administrátor v takovém případě musí stránku obnovit a úpravu provést znovu.

Totéž pravidlo platí pro mě (Claude), pokud budu mít přímý GitHub token k repozitáři: **před jakýmkoliv zápisem vždy nejdřív stáhnu aktuální živou verzi `content.json`/`theme.json`**, ať nepřepíšu nic, co bylo mezitím upraveno přes administraci.

## Automatické testy (jsdom)

```bash
npm install
npm test
```

`tests/smoke.test.js` ověří:
- že `content.json`/`theme.json` mají validní tvar (stejná kontrola jako v `api/save.js`),
- že se z aktuálního obsahu vygeneruje validní `index.html` se správným počtem sekcí/položek odpovídajícím JSONu,
- že se `js/main.js` v jsdom spustí bez chyby a interaktivita (mobilní menu, filtr galerie, lightbox) reálně funguje.

**Tyto testy je potřeba spustit a mít zelené před každým přímým zápisem do GitHub repozitáře** (ať už přes tuto administraci, nebo při budoucí práci s přímým GitHub tokenem).

## Lokální vývoj

```bash
npm install
npm run build     # přegeneruje index.html z data/content.json + data/theme.json
npm test          # jsdom testy
npx serve .        # lokální server pro prohlížení veřejného webu (bez api/ funkcí)
```

Pro plné otestování administrace včetně `api/*.js` (přihlášení, ukládání, upload) je potřeba buď `vercel dev`, nebo rovnou nasazení na Vercel s nastavenými proměnnými prostředí — `api/*.js` jsou Vercel serverless funkce a bez Vercel runtime (nebo jeho lokální emulace) neběží.

## Fotografie

Obrázky se v `content.json` zadávají jako URL nebo relativní cesta (`image`, `hero.image`, `about.portraitImage` apod.). V administraci je lze buď vložit jako URL, nebo rovnou **nahrát soubor** (tlačítko „Nahrát soubor“ u každého obrázkového pole) — nahraje se přes `/api/upload-image` do `assets/img/uploads/` v repozitáři a cesta se doplní automaticky.

**Aktuální stav:**
- Přilby a kyrysy (Hero, galerie, katalog) mají reálné fotky v `assets/img/produkty/`.
- Štíty, meče, filmové/fantasy kusy a portrét Pavla u „O mně“ zatím používají placeholder z `picsum.photos` — je potřeba je nahradit před ostrým nasazením.

## SEO

- `index.html` má statické `<title>`, meta description, Open Graph/Twitter Card tagy a JSON‑LD (`LocalBusiness`) — všechno se generuje z `content.seo`/`content.contact` při každém publikování, takže je vždy v souladu s obsahem.
- Schema.org nemá oficiální typ „Artisan“ — použit je nejbližší validní typ `LocalBusiness` se zakladatelem typu `Person`.
- `robots.txt` povoluje běžné i AI vyhledávací roboty a blokuje `/admin.html` a `/api/`.

## Přístupnost

- Viditelný focus stav na interaktivních prvcích, `skip-link` na začátku stránky.
- Respektuje `prefers-reduced-motion`.
- Kontrast textu odpovídá WCAG AA pro běžný i sekundární text.
