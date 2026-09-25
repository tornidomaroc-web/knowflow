'use client'

import { ConversationSidebar } from '@/components/agent/ConversationSidebar'

/**
 * The history list as the phone's history sheet shows it, for the Ask preview
 * (register #123). ConversationSidebar takes callbacks, which a server route
 * cannot pass, so this client wrapper supplies no-ops. An empty list shows the
 * `dashboard.agent.noHistory` line, the only visible state of that key.
 */
export function PreviewHistory() {
  return <ConversationSidebar activeId={null} conversations={[]} onSelect={() => {}} onNew={() => {}} />
}
