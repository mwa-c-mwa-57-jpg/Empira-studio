// French articles for départements and regions: "la Vienne", "du Nord", "de l'Eure", "des Vosges", "Paris".

const PLURAL = /^(Alpes|Hautes-|Ardennes|Bouches|Côtes-d'Armor|Landes|Pyrénées|Yvelines|Deux-Sèvres|Vosges|Hauts-de-Seine|Hauts-de-France|Pays de la Loire)/;
const NO_ARTICLE = new Set(['Paris', 'Mayotte', 'La Réunion']);
const ELIDED = /^(Ain|Aisne|Allier|Ardèche|Ariège|Aube|Aude|Aveyron|Eure|Hérault|Ille-et-Vilaine|Indre|Isère|Oise|Orne|Yonne|Essonne|Auvergne|Île-de-France|Occitanie)/;
const FEMININE = new Set([
  'Charente', 'Charente-Maritime', 'Corrèze', 'Corse-du-Sud', 'Haute-Corse', "Côte-d'Or", 'Creuse', 'Dordogne', 'Drôme',
  'Haute-Garonne', 'Gironde', 'Loire', 'Haute-Loire', 'Loire-Atlantique', 'Lozère', 'Manche', 'Marne', 'Haute-Marne', 'Mayenne',
  'Meurthe-et-Moselle', 'Meuse', 'Moselle', 'Nièvre', 'Haute-Saône', 'Saône-et-Loire', 'Sarthe', 'Savoie', 'Haute-Savoie',
  'Seine-Maritime', 'Seine-et-Marne', 'Somme', 'Vendée', 'Vienne', 'Haute-Vienne', 'Seine-Saint-Denis', 'Guadeloupe', 'Martinique',
  'Guyane', 'Bretagne', 'Normandie', 'Nouvelle-Aquitaine', "Provence-Alpes-Côte d'Azur", 'Corse', 'Bourgogne-Franche-Comté',
]);

/** Returns the forms of a place name: { the: "la Vienne", of: "de la Vienne", to: "à la Vienne" }. */
export function placeForms(name) {
  if (NO_ARTICLE.has(name)) return { the: name, of: `de ${name}`, to: `à ${name}`, plural: false };
  if (PLURAL.test(name)) return { the: `les ${name}`, of: `des ${name}`, to: `aux ${name}`, plural: true };
  if (ELIDED.test(name)) return { the: `l'${name}`, of: `de l'${name}`, to: `à l'${name}`, plural: false };
  if (FEMININE.has(name)) return { the: `la ${name}`, of: `de la ${name}`, to: `à la ${name}`, plural: false };
  return { the: `le ${name}`, of: `du ${name}`, to: `au ${name}`, plural: false };
}

/** Subject–verb agreement: verb(forms, 'atteint', 'atteignent'). */
export const verb = (forms, singular, plural) => (forms.plural ? plural : singular);

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
