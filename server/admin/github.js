// Stockage des produits sur GitHub : l'espace admin lit products-data.js et
// enregistre chaque modification en un seul commit (fichier produits + photo).
// Netlify détecte le commit et republie le site automatiquement.
//
// Variables d'environnement (Netlify) :
//   GITHUB_TOKEN   jeton GitHub « fine-grained » limité à ce dépôt, droit Contents en écriture
//   GITHUB_REPO    propriétaire/dépôt, par ex. mwa-c-mwa-57-jpg/empira-studio
//   GITHUB_BRANCH  branche publiée par Netlify (main par défaut)
import { PRODUCTS_PATH, serializeProducts, parseProducts } from "./products-file.js";

const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const BRANCH_PATTERN = /^[\w.-]+(\/[\w.-]+)*$/;

export class StorageConflict extends Error {}

const decodeBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

export function githubStorage(env) {
  const repo = env.GITHUB_REPO || "";
  const branch = env.GITHUB_BRANCH || "main";
  if (!env.GITHUB_TOKEN || !REPO_PATTERN.test(repo) || !BRANCH_PATTERN.test(branch)) return null;

  async function api(path, init = {}) {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "empira-studio-admin",
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Mise à jour de branche refusée : quelqu'un a enregistré entre-temps.
      if (res.status === 422 && path.startsWith("/git/refs/")) throw new StorageConflict("Conflit d'enregistrement.");
      throw new Error(`GitHub ${res.status} sur ${path.split("?")[0]} : ${data.message || "réponse inattendue"}`);
    }
    return data;
  }
  const post = (path, body, method = "POST") => api(path, { method, body: JSON.stringify(body) });

  return {
    async load() {
      const ref = await api(`/git/ref/heads/${branch}`);
      const version = ref.object.sha;
      const file = await api(`/contents/${PRODUCTS_PATH}?ref=${version}`);
      return { products: parseProducts(decodeBase64(file.content)), version };
    },

    async save({ products, files = [], message, version }) {
      const commit = await api(`/git/commits/${version}`);
      const tree = [];
      for (const f of files) {
        const blob = await post("/git/blobs", { content: f.base64, encoding: "base64" });
        tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
      }
      tree.push({ path: PRODUCTS_PATH, mode: "100644", type: "blob", content: serializeProducts(products) });
      const newTree = await post("/git/trees", { base_tree: commit.tree.sha, tree });
      const next = await post("/git/commits", { message, tree: newTree.sha, parents: [version] });
      await post(`/git/refs/heads/${branch}`, { sha: next.sha, force: false }, "PATCH");
      return { version: next.sha };
    },
  };
}
