/**
 * THE TAB BAR'S ICONS. Design "C" (2026-11-03): filled clay glyphs (house,
 * stacked books, chat, gear) from the approved mockups, drawn in
 * src/components/clay/ClayIcons.tsx; the active tab's glyph is the ink-and-
 * cream version on the gold pill. They replace the Phosphor outline/fill pair
 * of Step Redesign-2 (the static mockups in docs/design/redesign-mockups still
 * use Phosphor, under docs/licenses/phosphor-icons-LICENSE.txt).
 */
import { TabBooks, TabChat, TabGear, TabHome } from '@/components/clay/ClayIcons';

export const TAB_ICONS = {
  dashboard: TabHome,
  knowledge: TabBooks,
  agent: TabChat,
  settings: TabGear,
} as const;
