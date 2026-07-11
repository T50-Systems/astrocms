import { TermsManager } from "./terms-manager.tsx";

export function TagsPage() {
  return (
    <TermsManager
      taxonomyKey="tag"
      title="Etiquetas"
      subtitle="Agrupa contenido con términos planos y flexibles."
      singular="etiqueta"
      plural="etiquetas"
      hierarchical={false}
    />
  );
}
