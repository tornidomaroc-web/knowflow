import type { useTranslation } from '@/lib/i18n';
import type { SubjectsListLabels } from '@/components/dashboard/SubjectsList';

type Dict = ReturnType<typeof useTranslation>;

/**
 * The subjects screen's labels, read from the dictionary in one place so the
 * dashboard page and the preview route cannot drift (register #85).
 */
export function buildSubjectsLabels(t: Dict): SubjectsListLabels {
  const s = t.dashboard.subjects;
  return {
    title: t.dashboard.nav.knowledge,
    subtitle: s.subtitle,
    newSubject: t.dashboard.home.newSubject,
    emptyTitle: t.dashboard.home.noSubjects,
    emptyPrompt: t.dashboard.home.noSubjectsDesc,
    materials: t.dashboard.home.documents,
    summarised: s.summarised,
    quizzed: s.quizzed,
    processing: s.processing,
    noMaterials: s.noMaterials,
    lastAsked: s.lastAsked,
    lastAdded: s.lastAdded,
    created: s.created,
    ask: t.dashboard.nav.agent,
    addMaterial: s.addMaterial,
  };
}
