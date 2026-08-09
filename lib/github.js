/**
 * lib/github.js
 *
 * Ukládání obsahu jde přímo do GitHub repozitáře (žádná databáze).
 * Pro uložení VÍCE souborů najednou (content.json + theme.json + nově
 * přegenerované index.html) používáme nízkoúrovňové Git Data API místo
 * tří samostatných Contents API volání — díky tomu vznikne jeden atomický
 * commit: buď se zapíší všechny soubory, nebo žádný (na rozdíl od tří
 * po sobě jdoucích PUT requestů, kde by pád uprostřed nechal repo
 * v nekonzistentním stavu). Pro upload jednoho obrázku stačí obyčejné
 * Contents API (putSingleFile).
 */

'use strict';

function envConfig() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH } = process.env;
  const missing = ['GITHUB_TOKEN', 'GITHUB_OWNER', 'GITHUB_REPO'].filter(k => !process.env[k]);
  return {
    token: GITHUB_TOKEN,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH || 'main',
    missing
  };
}

function ghHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'platnerstvi-admin'
  };
}

async function ghFetch(url, token, options) {
  const res = await fetch(url, { ...options, headers: { ...ghHeaders(token), ...(options && options.headers) } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status} na ${url}: ${text}`);
  }
  return res.json();
}

/**
 * Atomicky zapíše více souborů v jednom commitu.
 * files: [{ path: 'data/content.json', content: '...string...' }, ...]
 */
async function commitFiles(cfg, files, message) {
  const { owner, repo, branch, token } = cfg;
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  // 1) aktuální commit na větvi (VŽDY čteme čerstvý stav před zápisem)
  const refData = await ghFetch(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, token);
  const parentCommitSha = refData.object.sha;

  const commitData = await ghFetch(`${base}/git/commits/${parentCommitSha}`, token);
  const baseTreeSha = commitData.tree.sha;

  // 2) blob pro každý soubor
  const blobs = await Promise.all(files.map(async (file) => {
    const isBase64 = !!file.base64;
    const body = isBase64
      ? { content: file.content, encoding: 'base64' }
      : { content: file.content, encoding: 'utf-8' };
    const blob = await ghFetch(`${base}/git/blobs`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return { path: file.path, sha: blob.sha };
  }));

  // 3) nový strom nad aktuálním stavem větve
  const tree = await ghFetch(`${base}/git/trees`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: blobs.map(b => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha }))
    })
  });

  // 4) nový commit
  const newCommit = await ghFetch(`${base}/git/commits`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: tree.sha, parents: [parentCommitSha] })
  });

  // 5) posun větve na nový commit
  await ghFetch(`${base}/git/refs/heads/${encodeURIComponent(branch)}`, token, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommit.sha })
  });

  return { commitSha: newCommit.sha, files: files.map(f => f.path) };
}

/**
 * Zapíše jeden soubor (typicky binární — nahraný obrázek) přes Contents API.
 * contentBase64 už musí být base64 string.
 */
async function putSingleFile(cfg, filePath, contentBase64, message) {
  const { owner, repo, branch, token } = cfg;
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const url = `${base}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`;

  let sha;
  const getRes = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers: ghHeaders(token) });
  if (getRes.status === 200) {
    const data = await getRes.json();
    sha = data.sha;
  } else if (getRes.status !== 404) {
    const text = await getRes.text();
    throw new Error(`GitHub GET selhal (${getRes.status}): ${text}`);
  }

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: contentBase64, branch, sha })
  });
  if (!putRes.ok) {
    const text = await putRes.text();
    throw new Error(`GitHub PUT selhal (${putRes.status}): ${text}`);
  }
  const data = await putRes.json();
  return { path: filePath, commitSha: data.commit && data.commit.sha };
}

/** Přečte aktuální obsah souboru z GitHubu (vždy čerstvá živá verze, ne z cache). */
async function getFileJSON(cfg, filePath) {
  const { owner, repo, branch, token } = cfg;
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const url = `${base}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`;
  const data = await ghFetch(url, token);
  const buf = Buffer.from(data.content, data.encoding || 'base64');
  return JSON.parse(buf.toString('utf-8'));
}

/** Stejné jako getFileJSON, ale vrací i git sha souboru — pro detekci konfliktů. */
async function getFileWithSha(cfg, filePath) {
  const { owner, repo, branch, token } = cfg;
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const url = `${base}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`;
  const data = await ghFetch(url, token);
  const buf = Buffer.from(data.content, data.encoding || 'base64');
  return { json: JSON.parse(buf.toString('utf-8')), sha: data.sha };
}

module.exports = { envConfig, commitFiles, putSingleFile, getFileJSON, getFileWithSha };
