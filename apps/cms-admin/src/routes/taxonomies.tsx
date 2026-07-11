import { TermsManager } from "./terms-manager.tsx";

export function TaxonomiesPage() {
  return (
    <TermsManager
      taxonomyKey="category"
      title="Categorías"
      subtitle="Clasifica tus páginas y entradas en grupos."
      singular="categoría"
      plural="categorías"
      hierarchical
    />
  );
}
