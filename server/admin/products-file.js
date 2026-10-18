// Lecture et écriture du fichier des produits (src/assets/js/products-data.js).
// Le fichier est un module JavaScript qui contient du JSON pur : le site et la
// fonction de paiement l'importent tels quels, l'espace admin le réécrit.

export const PRODUCTS_PATH = "src/assets/js/products-data.js";
export const IMAGES_DIR = "src/assets/img/products";

const HEADER = `// Produits de la boutique. Ce fichier est mis à jour par l'espace admin du site
// (/admin) : chaque enregistrement crée une nouvelle version sur GitHub et le
// site se republie tout seul. Il reste modifiable à la main (format JSON).
export default `;

export const serializeProducts = (products) => `${HEADER}${JSON.stringify(products, null, 2)};\n`;

export function parseProducts(source) {
  const start = source.indexOf("export default");
  if (start < 0) throw new Error("Fichier produits illisible.");
  const json = source.slice(start + "export default".length).trim().replace(/;\s*$/, "");
  const data = JSON.parse(json);
  if (!Array.isArray(data)) throw new Error("Fichier produits illisible.");
  return data;
}
