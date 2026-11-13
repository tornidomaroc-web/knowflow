'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { buttonVariants } from '@/components/ui';
import { cn } from '@/lib/utils';
import { MessageBubble, Citation } from './MessageBubble';
import { Locale, useTranslation, resolveLocale } from '@/lib/i18n';
import { askSuggestions, type MaterialForSuggestion } from '@/lib/ask-suggestions';
import { useAiConsent } from '@/components/ai-consent/AiConsentProvider';
import Link from 'next/link';
import { ClayAnswer, ClayAskArt, ClayBook, ClayQuiz, ClaySend, ClaySpark, ClaySummary, ClayUploadGlyph } from '@/components/clay/ClayIcons';
import { UserName } from '@/components/ui/UserName';
import { NO_MATERIAL_REFUSAL, subjectUploadHref } from '@/lib/ask-material';
import { QUESTION_TOO_LONG } from '@/lib/question-cap';
import { AskNoAnswerableSubject } from './SubjectChips';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface ChatBoxProps {
  kbId: string;
  kbName: string;
  /** The subject's materials (name and summary lead), for the suggested first questions (#85, #121). */
  materials?: MaterialForSuggestion[];
  initialConversationId?: string | null;
  /** A loaded conversation. `citations` only where they are known: the
   *  messages table stores none, so a reopened conversation shows its answers
   *  without sources (the design preview passes them, Step Redesign-3). */
  initialMessages?: { role: string; content: string; citations?: Citation[] }[] | null;
  onConversationCreated?: (id: string) => void;
  /**
   * Activation 5 (cause #6): false when the subject holds no file Ask can
   * answer from (#129's rule). The chat then offers the way to the subject's
   * upload tile instead of a composer, so no question is typed into it. The
   * route refuses such a question on its own as well (`no_material`).
   */
  answerable?: boolean;
  /** Activation 5: the card is sized to its content (KBSelector's `compact`). */
  compact?: boolean;
  /** Activation 5: the route answered `no_material` after the page loaded. */
  onNoMaterial?: () => void;
  /**
   * The sample file (audit cause 9): the ready question, only in a subject
   * that holds the sample. Shown as a chip under the field until the first
   * message; pressing it puts the question IN the field and sends nothing.
   */
  sampleQuestion?: string | null;
}

/**
 * `atob` ALONE IS NOT A BASE64 DECODER FOR TEXT, AND THAT IS THE WHOLE BUG.
 *
 * This line used to read `atob(header)` and hand the result straight to
 * `JSON.parse`. `atob` returns a BINARY STRING - one character per byte, each in
 * U+0000..U+00FF - which is Latin-1 by definition. The server encodes with
 * `Buffer.from(JSON.stringify(citations))` (api/agent/route.ts), and
 * `Buffer.from(string)` defaults to UTF-8, so every non-ASCII character crossed
 * the `X-Citations` header as multiple bytes and arrived as that many separate
 * characters. An Arabic filename rendered as mojibake in the citation pills.
 *
 * THE CORRUPTION WAS ONLY EVER IN THIS HOP. Storage, the database and every
 * normal HTML render of the same filename were always correct - which is why
 * nothing upstream needs touching, and why the fix is one expression.
 *
 * IT WAS BROWSER-ONLY, WHICH IS WHY IT SURVIVED UNTIL SOMEONE LOOKED AT A PHONE.
 * The `Buffer.from(header, 'base64').toString()` fallback below defaults to UTF-8
 * and has always been correct, so no server-side test could reproduce this. The
 * two branches now agree instead of disagreeing.
 *
 * AND IT WAS NEVER ONLY ARABIC. UTF-8 and Latin-1 coincide exactly on
 * U+0000..U+007F, so pure-ASCII filenames were unaffected and are byte-identical
 * after this change. Everything above U+007F was broken: accented Latin
 * (`é`, `ñ`), Cyrillic, Hebrew, CJK, and emoji alike.
 */
function decodeCitations(header: string | null): Citation[] | undefined {
  if (!header) return undefined;
  try {
    // base64 -> bytes -> UTF-8. `TextDecoder` is the mirror of the `TextEncoder`
    // the route already uses, and it reconstructs surrogate pairs correctly, so
    // characters outside the BMP survive the round trip.
    const json =
      typeof atob === 'function'
        ? new TextDecoder().decode(Uint8Array.from(atob(header), (c) => c.charCodeAt(0)))
        : Buffer.from(header, 'base64').toString();
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Step Redesign-2: the FSI…PDI isolates a suggestion carries (ask-suggestions.ts,
 * register #121) become <bdi> elements. A character isolate is resolved line by
 * line, so a Latin title that wrapped put the Arabic marks around it (« », ؟)
 * on the wrong side; an element isolate keeps them in place.
 *
 * The SUBJECT name is also kept in one piece (UserName inline, 2026-11-03 phone
 * test: a Latin name split across two lines left the full stop against
 * ".CHECK 2026-08-10"). A material TOPIC is not: it can be a summary's first
 * sentence, and it sits inside quotes, which a one-piece box would leave
 * alone at a line's end.
 */
function isolated(q: string, subject: string) {
  const parts = q.split(/(\u2068[^\u2069]*\u2069)/);
  return parts.map((part, i) => {
    if (!part.startsWith('\u2068')) {
      // Design "C", PR 4: punctuation right after the subject's name goes
      // with the name (below), so it is not drawn twice.
      return parts[i - 1] && parts[i - 1].slice(1, -1) === subject ? part.replace(TRAILING, '') : part;
    }
    const text = part.slice(1, -1);
    if (text !== subject) return <bdi key={i}>{text}</bdi>;
    // The name is one box (UserName inline), and a line may break after a
    // box: a full stop or question mark right after the name could start a
    // line on its own (the proof run's "." alone). It is kept with the name.
    const tail = (parts[i + 1] ?? '').match(TRAILING)?.[0] ?? '';
    const box = <UserName key={i} inline>{text}</UserName>;
    return tail ? <span key={i} className="whitespace-nowrap">{box}{tail}</span> : box;
  });
}
const TRAILING = /^[.,!?\u060C\u061F\u00BB\u201D:;]+/;

export function ChatBox({ kbId, kbName, materials = [], initialConversationId, initialMessages, onConversationCreated, answerable = true, compact = false, onNoMaterial, sampleQuestion = null }: ChatBoxProps) {
  const params = useParams<{ locale: Locale }>();
  const safeLocale: Locale = resolveLocale(params.locale);
  const t = useTranslation(safeLocale);
  const { ensure: ensureAiConsent } = useAiConsent();
  const [messages, setMessages] = useState<Message[]>(
    initialMessages?.map((m, i) => ({ id: String(i), role: m.role as 'user' | 'assistant', content: m.content, citations: m.citations })) ?? []
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null);
  // Activation 5 (cause #6): starts from the page's reading of the subject and
  // turns on if the route answers `no_material` (the last file was deleted in
  // another tab, or failed, after this page loaded).
  const [noMaterial, setNoMaterial] = useState(!answerable);
  const uploadPath = {
    href: subjectUploadHref(safeLocale, kbId),
    labels: { title: t.dashboard.home.step2Title, desc: t.dashboard.home.step2Desc, cta: t.dashboard.upload.uploadButton },
  };
  const scrollRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  // The keyboard hint is shown only where a keyboard is likely (md and up, via
  // CSS) and names the modifier the platform has (review #122, defect 5):
  // Cmd on a Mac, Ctrl elsewhere. Read after mount; the server renders none.
  const [modifier, setModifier] = useState<'mac' | 'other' | null>(null);
  useEffect(() => {
    setModifier(/Mac|iPhone|iPad/.test(navigator.platform) ? 'mac' : 'other');
  }, []);

  useEffect(() => {
    // Only with messages: on the empty state this scrolled the illustration and
    // the headline out of view on a phone (seen on the preview, #122).
    if (scrollRef.current && messages.length > 0) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  // `preset` is a pressed suggestion (#85); it goes exactly where typed text goes.
  const handleSend = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || isLoading) return;
    // Apple 5.1.2(i): the question goes to Voyage AI and Anthropic only with
    // the student's permission. Declined, nothing is sent and the typed text
    // stays in the box.
    if (!(await ensureAiConsent())) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: t.dashboard.aiConsent.declined }]);
      return;
    }
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, kb_id: kbId, conversation_id: conversationId, locale: safeLocale }),
      });

      // Surface the server's own message on a non-OK response — notably the
      // rate-limit 429, whose reason ("you've hit today's limit…") is sent as
      // text/plain and was previously swallowed into a misleading generic error.
      // Confined to the !res.ok branch: we render the body and return before the
      // SSE stream loop / decodeCitations / header reads below. Falls back to the
      // generic string only when the body is empty; genuine network/stream
      // failures still land in catch and keep the friendly fallback.
      // Activation 5 (cause #6): the subject has no file to answer from. The
      // question was not counted and nothing was sent on; it is taken back
      // off the screen and the way to the upload tile shows instead.
      if (res.status === 409 && res.headers.get('X-KF-Refusal') === NO_MATERIAL_REFUSAL) {
        setMessages(prev => prev.filter(m => m.id !== userMsg.id));
        setNoMaterial(true);
        onNoMaterial?.();
        setIsLoading(false);
        return;
      }

      // fix/ai-cost-caps: a question over the length cap was not counted or
      // sent. It leaves the thread and goes back in the box, so a long paste
      // is not lost; the server's sentence says how long a question can be.
      if (res.status === 413 && res.headers.get('X-KF-Refusal') === QUESTION_TOO_LONG) {
        const body = (await res.text()).trim();
        setMessages(prev => [...prev.filter(m => m.id !== userMsg.id), {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: body || t.dashboard.agent.connectionError,
        }]);
        setInput(userMsg.content);
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        const body = (await res.text()).trim();
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: body || t.dashboard.agent.connectionError,
        }]);
        setIsLoading(false);
        return;
      }

      const newConvoId = res.headers.get('X-Conversation-Id');
      if (newConvoId && !conversationId) {
        setConversationId(newConvoId);
        onConversationCreated?.(newConvoId);
      }

      const citations = decodeCitations(res.headers.get('X-Citations'));

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader');

      const assistantMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', citations }]);

      let done = false;
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m));
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: t.dashboard.agent.connectionError }]);
    }
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSend();
  };

  // The owner's review of PR #322: in the sample subject, before the first
  // message, two suggestions and the ready question; the well fits them (it
  // kept the height of three cards). The chat column and the Ask card
  // (KBSelector, `:has([data-kf-ask-fit])`) stop stretching too, so the
  // composer sits under the well. From the first message on, as before.
  const fit = Boolean(sampleQuestion) && messages.length === 0 && !noMaterial;

  return (
    /*
      THE MAGIC NUMBER THAT USED TO BE HERE IS GONE AND MUST NOT COME BACK.
      This read `h-[calc(100dvh-100px)]`. A leaf component cannot know how much
      chrome sits above and below it, and this one guessed wrong by 135px: the
      real total is 72px of <main> top padding + 61px of the KBSelector subject
      bar + 2px of card border + 96px of <main> bottom padding. The card
      therefore ended 35px past the bottom of the viewport with a fixed 57px nav
      over it, and `elementFromPoint` at the Send button's centre returned a nav
      link instead of the button.

      The height now belongs to the page (dashboard/agent/page.tsx), which is the
      only place that can see the layout it lives in. Here we simply fill what we
      are given. `min-h-0` is load-bearing, not tidiness: a flex item defaults to
      `min-height: auto`, which resolves to min-content and would refuse to
      shrink below the full un-scrolled message list — reintroducing the same
      overflow from the inside.
    */
    /* Design "C", PR 4: no hairline left in the box. The subject line sits
       on the card; the conversation is a pressed-in well inside it; the
       composer is the card's last row. The well's corners and its 0.5rem
       side inset are paint only: the list keeps its height (the Ask fit of
       render-fix2.mjs reads it). */
    <div className={`flex min-h-0 flex-col bg-surface ${compact ? 'flex-none pb-2' : fit ? 'flex-none' : 'flex-1'}`}>
      <div className="flex items-center gap-3 bg-surface px-4 py-3">
        <span className="kf-tile inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <ClayBook width={22} height={22} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t.dashboard.agent.chatWith}</p>
          <UserName as="h2" className="truncate text-sm font-semibold text-foreground">{kbName}</UserName>
        </div>
      </div>

      <div data-kf-thread="" data-kf-ask-fit={fit ? '' : undefined} className={`kf-well mx-2 ${fit || (compact && noMaterial && messages.length === 0) ? 'flex-none' : 'flex-1'} space-y-6 overflow-y-auto rounded-[1.25rem] p-4 md:p-6`} ref={scrollRef}>
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            citations={m.citations}
            sourceHref={(c) => `/${safeLocale}/dashboard/knowledge/${kbId}#material-${c.document_id}`}
            sourcesLabel={t.dashboard.agent.sources}
            pageLabels={t.dashboard.agent}
            readingDir={safeLocale === 'ar' ? 'rtl' : 'ltr'}
            isStreaming={isLoading && m.role === 'assistant' && i === messages.length - 1}
          />
        ))}
        {messages.length === 0 && noMaterial && (
          <AskNoAnswerableSubject kind="material" href={uploadPath.href} labels={uploadPath.labels} />
        )}
        {messages.length === 0 && !noMaterial && (
          /* Register #85 (SIGNED_IN_FEATURES.md 2.3): a first screen with
             something to press. Built here from names only; nothing is sent
             until a suggestion is pressed, and then it is the student's own
             message through the same path and the same daily cap. Design
             "C", PR 4: the home ask card's clay picture, clay suggestion
             cards with a clay tile each. */
          <div data-kf-ask-empty="" className="mx-auto max-w-lg [text-wrap:pretty]">
            {/* The owner's review of #305: at 390 x 844 the third suggestion
                was cut by the well. The picture is 56 pt (was 96) and the
                gaps tighter, so all three show whole above the composer;
                design-c's render checks fail on a suggestion cut by its list. */}
            <div className="rise flex flex-col items-center text-center">
              <ClayAskArt width={56} height={56} mark={safeLocale === 'ar' ? '؟' : '?'} data-kf-clay-art="empty-ask" />
              <h3 className="mt-2 text-lg font-bold text-foreground [text-wrap:balance]">{t.dashboard.agent.emptyTitle}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.dashboard.agent.startTyping}</p>
            </div>
            <p className="rise rise-1 mt-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <ClaySpark width={20} height={20} />
              {t.dashboard.suggestions.heading}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {/* With the ready question under the field, two suggestions:
                  the chip takes a row of the screen, and all of them must
                  show whole above the composer at 390 x 844. */}
              {askSuggestions(t.dashboard.suggestions, kbName, materials, sampleQuestion ? 2 : 3, { sample: Boolean(sampleQuestion) }).map((q, i) => {
                const icon = [
                  <ClaySummary key="s" width={24} height={24} />,
                  <ClayAnswer key="a" width={24} height={24} mark={safeLocale === 'ar' ? '؟' : '?'} />,
                  <ClayQuiz key="q" width={24} height={24} />,
                ][i] ?? <ClaySummary width={24} height={24} />;
                return (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    disabled={isLoading}
                    dir="auto"
                    data-kf-suggestion=""
                    className={`kf-card pressable liftable rise rise-${i + 2} flex min-h-[3.25rem] items-center gap-3 rounded-2xl bg-surface px-4 py-2.5 text-start text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                  >
                    <span className="kf-tile inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                      {icon}
                    </span>
                    <span className="min-w-0 flex-1">{isolated(q, kbName)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Step Redesign-3: the composer is the last row of a column whose height
          the page fixes, so it stays put at the bottom while the conversation
          above it scrolls (`sticky` keeps it there should the column ever grow). */}
      {/* Activation 5 (cause #6): no composer in a subject with no file to
          answer from. Over an old conversation the way to the upload tile
          takes the composer's row; on an empty one it is the well above. */}
      {noMaterial && messages.length > 0 && (
        <div data-kf-ask-upload-path="material-row" className="sticky bottom-0 flex shrink-0 items-center gap-3 bg-surface p-3 pb-6 md:p-4">
          <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">{uploadPath.labels.title}</p>
          <Link href={uploadPath.href} data-kf-ask-upload-link="" className={cn(buttonVariants({ variant: 'primary' }), 'shrink-0')}>
            <ClayUploadGlyph width={24} height={24} />
            {uploadPath.labels.cta}
          </Link>
        </div>
      )}
      {!noMaterial && (
      <div data-kf-composer="" className="sticky bottom-0 shrink-0 bg-surface p-3 pb-6 md:p-4">
        <div className="kf-composer flex items-end gap-2 rounded-2xl border border-control-border bg-background p-2 focus-within:border-primary">
          <textarea
            ref={fieldRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t.dashboard.agent.askPlaceholder}
            className="max-h-40 min-h-[2.75rem] flex-1 resize-none bg-transparent px-2 py-2.5 text-base leading-5 md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            rows={2}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            aria-label={t.dashboard.agent.send}
            className={cn(buttonVariants({ variant: 'primary', size: 'icon' }), 'rounded-full')}
          >
            <ClaySend className="rtl:-scale-x-100" />
          </button>
        </div>
        {/* The sample file (audit cause 9): the ready question, under the
            field. A press fills the field and moves the caret there; the
            student sends it, so nothing leaves without their own tap on send. */}
        {sampleQuestion && messages.length === 0 && (
          <button
            type="button"
            onClick={() => { setInput(sampleQuestion); fieldRef.current?.focus(); }}
            data-kf-sample-question=""
            className="kf-pill pressable mt-2 inline-flex min-h-[2.75rem] max-w-full items-center gap-2 rounded-full px-4 text-start text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ClaySpark width={20} height={20} className="shrink-0" />
            <span className="min-w-0 truncate">{sampleQuestion}</span>
          </button>
        )}
        {/* Only where a keyboard is likely: md and up, and only once the platform
            is known, so a phone never reads a shortcut it cannot press. */}
        {modifier && (
          <p className="mt-1.5 hidden text-[11px] text-faint md:block">
            {modifier === 'mac' ? t.dashboard.agent.sendHintMac : t.dashboard.agent.sendHintOther}
          </p>
        )}
      </div>
      )}
    </div>
  );
}
