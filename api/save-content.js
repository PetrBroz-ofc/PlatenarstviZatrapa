/**
 * api/save-content.js
 *
 * Vercel serverless funkce (Node runtime).
 * 1) action "verify" — ověří heslo administrace proti proměnné prostředí ADMIN_PASSWORD.
 * 2) action "save"   — ověří heslo a uloží zadané soubory (data/content.json, data/theme.json)
 *                      do GitHub repozitáře přes GitHub Contents API. GitHub token nikdy
 *                      neopouští server (je uložený jen jako proměnná prostředí na Vercelu).
 *
 * Potřebné proměnné prostředí (Vercel → Project → Settings → Environment Variables):
 *   ADMIN_PASSWORD  — heslo pro přístup do administrace
 *   GITHUB_TOKEN    — GitHub Personal Access Token s právem "repo" (Contents: Read and write)
 *   GITHUB_OWNER    — uživatelské jméno / organizace na GitHubu
 *   GITHUB_REPO     — název repozitáře
 *   GITHUB_BRANCH   — volitelné, výchozí "main"
 */

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Povolena je pouze metoda POST.' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const { ADMIN_PASSWORD, GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } = process.env;

  if (!ADMIN_PASSWORD) {
    res.status(500).json({ ok: false, error: 'Na serveru chybí proměnná prostředí ADMIN_PASSWORD.' });
    return;
  }

  if (body.action === 'verify') {
    res.status(200).json({ ok: body.password === ADMIN_PASSWORD });
    return;
  }

  if (body.action === 'save') {
    if (body.password !== ADMIN_PASSWORD) {
      res.status(401).json({ ok: false, error: 'Nesprávné heslo.' });
      return;
    }
    const missing = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'].filter(k => !process.env[k]);
    if (missing.length) {
      res.status(500).json({ ok: false, error: 'Na serveru chybí proměnné prostředí: ' + missing.join(', ') });
      return;
    }
    if (!Array.isArray(body.files) || body.files.length === 0) {
      res.status(400).json({ ok: false, error: 'Nebyly zadány žádné soubory k uložení.' });
      return;
    }

    const branch = GITHUB_BRANCH || 'main';
    const results = [];

    try {
      for (const file of body.files) {
        if (!file.path || typeof file.content === 'undefined') {
          throw new Error('Neplatný záznam souboru (chybí path nebo content).');
        }
        const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${encodeURIComponent(file.path).replace(/%2F/g, '/')}`;
        const ghHeaders = {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'platnerstvi-admin'
        };

        // 1) Zjištění aktuálního sha souboru (pokud existuje)
        let sha;
        const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders });
        if (getRes.status === 200) {
          const getData = await getRes.json();
          sha = getData.sha;
        } else if (getRes.status !== 404) {
          const errText = await getRes.text();
          throw new Error(`GitHub GET selhal (${getRes.status}): ${errText}`);
        }

        // 2) Zápis nového obsahu
        const jsonString = JSON.stringify(file.content, null, 2) + '\n';
        const base64Content = Buffer.from(jsonString, 'utf-8').toString('base64');

        const putRes = await fetch(apiUrl, {
          method: 'PUT',
          headers: { ...ghHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `Aktualizace obsahu webu: ${file.path}`,
            content: base64Content,
            branch,
            sha
          })
        });

        if (!putRes.ok) {
          const errText = await putRes.text();
          throw new Error(`GitHub PUT selhal (${putRes.status}): ${errText}`);
        }
        const putData = await putRes.json();
        results.push({ path: file.path, commit: putData.commit && putData.commit.sha });
      }

      res.status(200).json({ ok: true, results });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || 'Neznámá chyba při ukládání do GitHubu.' });
    }
    return;
  }

  res.status(400).json({ ok: false, error: 'Neznámá akce. Použijte "verify" nebo "save".' });
};
