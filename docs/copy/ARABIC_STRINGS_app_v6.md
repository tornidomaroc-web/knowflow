# Arabic copy, app v6: New Conversation without the typed "+"

Approved by Abo Jad on 2026-11-06, after the device proof of #305.
- `newConversation` (dashboard.agent): the typed "+" is dropped in both languages. Arabic "+ محادثة جديدة" becomes "محادثة جديدة"; English "+ New Conversation" becomes "New Conversation". No other word changes.

Since the owner's review of #305 the button draws the clay plus icon at its start, in both languages, and stripped the typed "+" from the string at render (it drew at the end of the Arabic label). With the "+" gone from the dictionaries there is nothing left to strip, so the render-time strip is removed; the clay plus icon stays.
Shown on the Ask screen's history drawer and web sidebar (src/components/agent/ConversationSidebar.tsx), in both shells.

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.agent.newConversation` | محادثة جديدة | + محادثة جديدة |
