import type { PluralForms } from '../plural';

export const en = {
  nav: {
    home: "KnowFlow",
    howItWorks: "How it works",
    pricing: "Pricing",
    // #107. `docs` was deleted, not renamed: it read "Docs" in English and
    // "المستندات" in Arabic while pointing at /about, which is a page about the
    // product and holds no documentation. It named a page that does not exist.
    about: "About",
    // Taken from `auth.hasAccount` ("Already have an account? Sign in") rather
    // than written fresh, so the header and the auth pages say one thing.
    signIn: "Sign in",
    getStarted: "Start free",
    // Screen-reader only: the hamburger's name (#48). Never rendered as text.
    menu: "Menu"
  },
  hero: {
    badge: "Made for students · Arabic & English",
    title: "Your notes. Any question. In seconds.",
    hook: "Stuck on a concept the night before an exam?",
    // #108. STILL THE PAGE DESCRIPTION, and that is why it survives the hero.
    // `[locale]/layout.tsx:27` reads it as generateMetadata's `description`, so
    // deleting the key would have emptied every <meta name="description"> and
    // every og:description on the site. The hero stops PRINTING it, because the
    // answer card below now shows what this sentence describes.
    subtitle: "Upload your lecture notes, slides, and PDFs. Then ask questions and get clear answers in Arabic or English. No searching. No scrolling. Just ask.",
    cta1: "Start free",
    cta2: "See how it works",
    disclaimer: "No credit card · Free to start"
  },
  /*
    #108, THE ANSWER CARD. NONE OF THIS IS INVENTED. The owner supplied the
    question he actually asked, the answer the product actually gave, and the
    two files it actually read, so the 40 on this page is a measured number and
    not a marketing one. Do not "improve" the wording: it would stop being true.

    File-level provenance, on the owner's ruling: the sentence promises WHICH
    FILE was read, never which page. Register #16 (page-level citations) stays
    out of this pass, so the chips carry filenames and nothing more.
  */
  answer: {
    question: "What is the break-even quantity in exercise two?",
    body: "40 units. Fixed costs of 600 divided by a margin of 15 per unit. At that point there is no profit and no loss.",
    files: ["Microeconomics-Principles.pdf", "Solved-Exercises-Ch3.pdf"]
  },
  howItWorks: {
    title: "How it works",
    steps: [
      { step: "Step 1", title: "Upload your materials", desc: "Add a subject and upload its notes, slides, or PDFs in any format you already have." },
      { step: "Step 2", title: "Ask in Arabic or English", desc: "Type your question naturally. No keywords, no searching." },
      { step: "Step 3", title: "Get a clear answer", desc: "KnowFlow reads that subject's materials and answers with the right information, in seconds." }
    ]
  },
  cta: {
    title: "Ready to study smarter?",
    button: "Start free",
    note: "Free plan · No credit card"
  },
  footer: {
    privacy: "Privacy",
    terms: "Terms",
    refund: "Refund",
    support: "Support",
    github: "GitHub",
    copyright: "KnowFlow. All rights reserved."
  },
  pricing: {
    title: "Simple, transparent pricing.",
    free: {
      name: "Free",
      price: "$0",
      period: "/month",
      features: [
        "5 Subjects",
        "10 materials per subject",
        "100 conversations/month",
        "Arabic & English"
      ],
      button: "Start free"
    },
    pro: {
      name: "Pro",
      price: "$49",
      period: "/month",
      features: [
        "Many more subjects",
        "Generous material limits",
        "High daily limits"
      ],
      button: "Upgrade to Pro"
    },
    checkout: {
      unavailable: "We could not reach the payment provider. Please try again in a moment.",
      misconfigured: "Checkout is not available right now. This is a problem on our side, and our team has been notified.",
      failed: "Something went wrong starting checkout. Please try again.",
      reference: "Reference:"
    }
  },
  auth: {
    loginLabel: "Sign In",
    signupLabel: "Sign Up",
    loginTitle: "Welcome back",
    loginSubtitle: "Sign in to your account",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    showPassword: "Show password",
    passwordMismatch: "The two passwords don't match.",
    loginButton: "Sign In",
    googleLogin: "Sign in with Google",
    googleSignup: "Continue with Google",
    googleFailed: "We could not open Google sign in. Please try again.",
    orDivider: "or",
    loggingIn: "Signing in...",
    noAccount: "Don't have an account? Sign up",
    signupTitle: "Create Account",
    signupSubtitle: "Join KnowFlow today",
    hasAccount: "Already have an account? Sign in",
    name: "Full Name",
    createBtn: "Create Account",
    creating: "Creating...",
    checkInboxTitle: "Check your inbox",
    checkInboxBody: "We sent a confirmation link to your email address. Open it to activate your account.",
    signupRepeatPassword: "Signing up again with an email you already used sends a new confirmation link, but keeps your first password.",
    signupRepeatPasswordLink: "Forgot it? Reset your password",
    noticeSigninRequired: "We could not finish that link. Please sign in below.",
    noticeLinkExpired: "That confirmation link is no longer valid. Sign up again to get a new one.",
    forgotLink: "Forgot your password?",
    forgotTitle: "Reset your password",
    forgotSubtitle: "Enter your email and we will send you a link to set a new password.",
    forgotSubmit: "Send reset link",
    forgotSending: "Sending...",
    forgotSent: "If that address has an account, a reset link is on its way. Check your inbox.",
    forgotAnyDevice: "You can open the link on any device.",
    forgotRateLimited: "A link was just sent. Wait about a minute before asking for another.",
    resetTitle: "Set a new password",
    resetSubtitle: "Choose a new password for your account.",
    resetSubmit: "Save new password",
    resetSaving: "Saving...",
    resetNoSession: "This page needs a valid reset link. Ask for a new one and open it from your email.",
    resetCancel: "Cancel and sign out",
    backToLogin: "Back to sign in"
  },
  about: {
    title: "We believe studying should feel simpler.",
    subtitle: "KnowFlow turns your notes, slides, and PDFs into clear answers, grounded in your own material, in Arabic and English.",
    missionLabel: "Our Mission",
    mission: "We're building a study assistant that speaks Arabic natively, so students can learn from their own material, in the language they think in.",
    giants: "Built on the shoulders of giants",
    tools: [
      { title: "MarkItDown by Microsoft", desc: "turns your files into clean text" },
      { title: "Voyage AI", desc: "understands what your notes mean" },
      { title: "Claude by Anthropic", desc: "answers your questions clearly" },
      { title: "Supabase", desc: "keeps your material private to you" }
    ],
    ctaTitle: "Ready to study smarter?",
    cta: "Start free"
  },
  contact: {
    title: "How can we help?",
    general: "Support",
    name: "Name",
    email: "Email",
    message: "Message",
    send: "Send Message",
    githubText: "View on GitHub"
  },
  dashboard: {
    nav: {
      dashboard: "Dashboard",
      knowledge: "Subjects",
      agent: "Ask",
      settings: "Settings",
      signOut: "Sign Out"
    },
    passwordReplaced: {
      title: "You are now signing in with Google",
      body: "Your email address was never confirmed, so signing in with Google took over this account. Everything you saved is still here, but the password you chose earlier no longer works. You can set a new one whenever you like.",
      action: "Set a password",
      dismiss: "Dismiss"
    },
    home: {
      welcome: "Welcome back.",
      knowledgeBases: "Subjects",
      knowledgeBasesDesc: "Active subjects",
      documents: "Materials",
      documentsDesc: "Materials processed",
      conversations: "Conversations",
      conversationsDesc: "Questions asked",
      newKbTitle: "NEW SUBJECT",
      newKbDesc: "Add a subject and upload its materials",
      newSubject: "New subject",
      talkAgentTitle: "Ask your materials",
      talkAgentDesc: "Ask about the materials in one subject",
      streakLabel: "Study streak",
      // A COUNTED NOUN, so it carries its plural forms rather than one baked string.
      // `as PluralForms` is load-bearing: `ar.ts` is typed `typeof en`, so without the
      // widening annotation this literal would infer `{ one: string; other: string }`
      // and Arabic could not declare its `zero`/`two`/`few`/`many` forms at all.
      //
      // English declares exactly the two categories its CLDR rules can select. It is
      // NOT forced through an Arabic-shaped API — there is no empty `two` here.
      streakUnit: { one: "day", other: "days" } as PluralForms,
      // Shown beneath the streak number, never beside the ghost placeholder. §5
      // forbids promising what the app does not do: the count is bucketed into days
      // in the STUDENT'S timezone, which is true but invisible, so a student who
      // studies at 00:30 and watches the number tick has no way to know why. This
      // says so in one line.
      streakZoneHint: "in your local time",
      recentActivity: "Recent Activity",
      noActivity: "No activity yet",
      conversation: "CONVERSATION",
      showLess: "Show less",
      viewAll: "View all",
      unknownKb: "Unknown subject",
      // ── #85 student home. 23 keys, added to BOTH files in one pass from a
      //    single declaration so they cannot drift. `tsc` proves KEY parity only,
      //    so the STRINGS were counted by hand: 23 here, 23 in the other file.
      //    NO KEY HERE IS A COUNTED NOUN. That is deliberate: every quota renders
      //    as a large numeral with a caption beside it, so nothing has to agree
      //    with a number, and no Arabic plural category is involved.
      planTitle: "Your plan",
      planFree: "Free",
      planPro: "Pro",
      questionsLeft: "Questions left",
      uploadsLeft: "Uploads left",
      ofWord: "of",
      subjectsUsed: "Subjects used",
      allSubjects: "All subjects",
      materialsWord: "summarised",
      noSubjects: "No subjects yet",
      noSubjectsDesc: "A subject is one course. Add one, then upload its materials.",
      startTitle: "Get started",
      step1Title: "Create a subject",
      step1Desc: "One subject per course.",
      step2Title: "Upload your materials",
      step2Desc: "PDFs, slides and notes.",
      step3Title: "Ask a question",
      step3Desc: "Answers come from your own materials.",
      whatTitle: "What KnowFlow does",
      whatLine1: "Reads the files you upload and turns them into searchable text.",
      whatLine2: "Writes summaries and builds quizzes from them.",
      whatLine3: "Answers your questions from your materials, not from the web.",
      upgradeCta: "Upgrade",
    },
    newKb: {
      title: "Create Subject",
      name: "Name",
      description: "Description (Optional)",
      language: "Language",
      languageAr: "Arabic",
      languageEn: "English",
      languageBoth: "Both",
      create: "Create Subject",
      creating: "Creating...",
      errorAuth: "Not authenticated",
      errorLimitFree: "You've reached the free plan's limit of {limit} subjects. Upgrade to Pro for more.",
      errorLimitPro: "You've reached your limit of {limit} subjects."
    },
    kbDetail: {
      documents: "Materials",
      noDocuments: "No materials yet. Upload your first file above.",
      chunks: "chunks",
      // #47. `answersKept` is ruled, not decoration: deleting a material does NOT
      // remove the answers Ask already gave from it, and the student is told so
      // before they confirm rather than discovering it afterwards.
      deleteMaterial: {
        openButton: "Delete",
        warning: "Delete this material permanently? Its file, its summary and its quizzes are removed, Ask stops using it, and nothing can be restored.",
        answersKept: "Answers you already got in Ask stay in your conversations, including anything they quoted from this material.",
        confirmButton: "Delete permanently",
        cancelButton: "Cancel",
        deleting: "Deleting…",
        errorNotFound: "This material no longer exists.",
        errorFailed: "The deletion did not finish. You can try again.",
        errorContact: "This material could not be deleted from here. Email support@tryknowflow.com and we will remove it for you."
      },
      // #47, rename. The extension is shown but not editable: the server keeps
      // it, so the name can never claim a different file type.
      renameMaterial: {
        openButton: "Rename",
        label: "New name",
        hint: "The file type stays the same.",
        saveButton: "Save name",
        cancelButton: "Cancel",
        saving: "Saving…",
        errorInvalid: "Enter a name that is not empty, has no / or \\, and is at most 200 characters long.",
        errorNotFound: "This material no longer exists.",
        errorConflict: "This material changed while you were renaming it. Reload the page and try again.",
        errorContact: "This material cannot be renamed from here. Email support@tryknowflow.com and we will rename it for you.",
        errorFailed: "The rename did not finish and nothing was changed. You can try again."
      }
    },
    summary: {
      heading: "Summary",
      generate: "Summarize this material",
      generating: "Summarizing…",
      partialNotice: "This summary covers only the first part of this long material.",
      errors: {
        session: "Your session expired. Please refresh the page and sign in again.",
        notFound: "This material could not be found.",
        processing: "This material is still processing. Wait until it's ready, then try again.",
        notEnoughText: "There isn't enough text in this material to summarize.",
        limit: "You've reached today's summary limit.",
        temporary: "Couldn't create the summary right now. Please try again shortly.",
        connection: "Connection failed. Check your connection and try again."
      }
    },
    quiz: {
      heading: "Quiz",
      start: "Quiz me on this material",
      starting: "Preparing your quiz…",
      partialNotice: "This quiz covers only the first part of this long material.",
      submit: "Check my answers",
      submitting: "Checking…",
      retake: "Try again",
      score: "Your score",
      correctAnswer: "Correct answer",
      noAnswer: "You didn't answer this question.",
      errors: {
        session: "Your session expired. Please refresh the page and sign in again.",
        notFound: "This material could not be found.",
        processing: "This material is still processing. Wait until it's ready, then try again.",
        notEnoughText: "There isn't enough text in this material to make a quiz.",
        limit: "You've reached today's quiz limit.",
        badRequest: "Something went wrong with that request. Please refresh the page and try again.",
        incomplete: "This quiz is incomplete and can't be graded.",
        temporary: "Couldn't do that right now. Please try again shortly.",
        connection: "Connection failed. Check your connection and try again."
      }
    },
    settings: {
      title: "Settings",
      account: "Account",
      email: "Email",
      plan: "Plan",
      free: "Free",
      pro: "Pro",
      renews: "Renews",
      upgrade: "Upgrade to Pro",
      activeSubscription: "Active subscription",
      privacyPolicy: "Privacy Policy",
      cancels: "Cancels on",
      cancelSubscription: {
        heading: "Subscription",
        description: "Stop your subscription from renewing.",
        keepsAccess: "You keep Pro until",
        noRefund: "The period you have already paid for is not refunded.",
        canResubscribe: "You can subscribe again at any time, and nothing is deleted.",
        openButton: "Cancel subscription",
        confirmPrompt: "Cancel your subscription? Your account and everything in it stays exactly as it is.",
        confirmButton: "Yes, cancel it",
        keepButton: "Keep my subscription",
        working: "Cancelling…",
        done: "Your subscription is cancelled. You keep Pro until",
        errorFailed: "That did not work and nothing was changed. You can try again.",
        errorPartial: "Only part of it worked. {scheduled} of {total} subscriptions are now set to end, but {failed} could not be cancelled and is still billing. Please try again to cancel the rest. If it fails again, contact support with the reference below.",
        reference: "Reference:",
        errorElsewhere: "Part of your subscription was purchased outside this app, so it cannot be cancelled here. Please cancel it where you bought it. Anything we could cancel here has already been set to end."
      },
      deleteAccount: {
        heading: "Delete account",
        description: "Permanently delete your account and everything in it.",
        permanentWarning: "This cannot be undone. There is no grace period, and nothing can be restored afterwards.",
        whatIsRemoved: "Your subjects, materials, conversations, quizzes and study history are deleted, along with every file you have uploaded.",
        billingNote: "If you have an active subscription, it is cancelled immediately.",
        openButton: "Delete account",
        confirmPrompt: "Type your email address to confirm:",
        confirmPlaceholder: "your email address",
        confirmButton: "Delete my account permanently",
        cancelButton: "Cancel",
        deleting: "Deleting\u2026",
        errorMismatch: "That does not match your email address.",
        errorFailed: "Deletion failed and nothing was changed. You can try again.",
        errorBillingCanceled: "Nothing was lost. Your account and everything in it is still here. Your subscription was cancelled, but the deletion did not finish. Please try again. If it fails again, contact us and we will finish it for you.",
        errorSubscriptionElsewhere: "Your account was not deleted, and nothing was changed. You still have a subscription that was purchased outside this app, and we cannot cancel it for you from here. Cancel it where you bought it first, then delete your account. We stopped rather than delete your account while something was still charging you."
      }
    },
    agent: {
      chatWith: "Asking about",
      startTyping: "Start typing to ask questions.",
      askPlaceholder: "Ask a question (Cmd+Enter to send)...",
      send: "Send",
      connectionError: "Connection error.",
      newConversation: "+ New Conversation",
      noHistory: "No history yet.",
      history: "History"
    },
    upload: {
      uploadFailed: "We could not confirm that your file was uploaded. Refresh the page to see whether it arrived, and upload it again if it did not.",
      dropHere: "Drop files here or click to upload",
      supported: "Supported: PDF, DOCX, PPTX, XLSX, TXT, MD (up to {limit} per file)",
      uploading: "Uploading...",
      processing: "Processing...",
      ready: "Ready ✓",
      error: "Error"
    }
  }
};
