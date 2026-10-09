import { en } from './en';

export type Translation = typeof en;

export const ar: Translation = {
  nav: {
    home: "KnowFlow",
    howItWorks: "كيف يعمل",
    pricing: "الأسعار",
    // #107, the owner's wording. `docs` was deleted, not renamed: it read
    // "المستندات" while pointing at /about, naming a page that does not exist.
    about: "عن KnowFlow",
    // The verb phrase already inside `auth.hasAccount`, not a fresh translation.
    signIn: "سجّل الدخول",
    getStarted: "ابدأ مجانًا",
    // Screen-reader only: the hamburger's name (#48). Never rendered as text.
    menu: "القائمة",
    appearance: "المظهر",
    themeDark: "داكن",
    themeLight: "فاتح"
  },
  landing: {
    howEyebrow: "كيف يعمل",
    featuresEyebrow: "ماذا ستجد",
    featuresTitle: "كل شيء من ملفاتك أنت.",
    featuresDesc: "لا بحث في الإنترنت ولا تخمين. كل إجابة وكل ملخص وكل اختبار يأتي من ملفاتك.",
    features: [
      { title: "ملخص تقرؤه في الاستراحة", desc: "ملخص واضح لكل ملف، بلغتك." },
      { title: "اختبارات تراجعك", desc: "خمسة أسئلة من الملف، تُصحَّح في الحال." },
      { title: "إجابات مع مصدرها", desc: "اسأل ما تشاء. كل إجابة تذكر الملف الذي جاءت منه." },
      { title: "سلسلة تبقيك مستمرًا", desc: "ذاكر قليلًا كل يوم، وحافظ على شعلتك." },
    ],
    bilingualEyebrow: "العربية أولًا",
    bilingualTitle: "العربية أولًا. والإنجليزية أيضًا.",
    bilingualDesc: "اسأل باللغة التي تفكر بها. ارفع ملاحظاتك بالعربية أو الإنجليزية، وتأتيك الإجابة بلغتك.",
    sampleArQ: "ما هي مرونة الطلب؟",
    sampleArA: "مرونة الطلب تقيس كيف تتغير الكمية المطلوبة عند تغير السعر.",
    sampleEnQ: "What is price elasticity?",
    sampleEnA: "It measures how much quantity demanded changes when the price changes.",
    kitSummary: "الملخص جاهز",
    kitQuiz: "الاختبار جاهز",
  },
  hero: {
    badge: "مصمم للطلاب · بالعربية والإنجليزية",
    title: "ملاحظاتك. أي سؤال. في ثوانٍ.",
    hook: "فكرة صعبة قبل الامتحان بليلة؟",
    // #108. Still generateMetadata's `description` ([locale]/layout.tsx:27),
    // so the key stays although the hero no longer prints it.
    subtitle: "ارفع ملاحظاتك ومحاضراتك وملفات PDF. ثم اسأل، وتأتيك إجابة واضحة بالعربية أو الإنجليزية. لا بحث ولا تقليب صفحات.",
    cta1: "ابدأ مجانًا",
    cta2: "شاهد كيف يعمل",
    disclaimer: "بلا بطاقة بنكية · ابدأ مجانًا"
  },
  /*
    #108, THE ANSWER CARD. NONE OF THIS IS INVENTED. The owner supplied the
    question he actually asked, the answer the product actually gave, and the
    two files it actually read. Do not "improve" the wording: it would stop
    being true. File-level provenance on his ruling — the chips name the file,
    never the page; register #16 stays out of this pass.
  */
  answer: {
    question: "كم كمّية التعادل في التمرين الثاني؟",
    body: "40 وحدة. نقسم التكاليف الثابتة (600 درهم) على هامش المساهمة (15 درهمًا للوحدة). عند هذا العدد لا ربح ولا خسارة.",
    files: ["مبادئ الاقتصاد الجزئي.pdf", "تمارين محلولة - الفصل 3.pdf"]
  },
  howItWorks: {
    title: "كيف يعمل",
    steps: [
      { step: "الخطوة 1", title: "ارفع موادك", desc: "أضف مادة، ثم ارفع ملفاتها: PDF أو شرائح أو ملاحظات." },
      { step: "الخطوة 2", title: "اسأل بالعربية أو الإنجليزية", desc: "اكتب سؤالك كما تقوله لصديقك. لا حاجة إلى كلمات مفتاحية." },
      { step: "الخطوة 3", title: "احصل على إجابة واضحة", desc: "يقرأ KnowFlow ملفات المادة ويجيبك منها في ثوانٍ." }
    ]
  },
  cta: {
    title: "جاهز لمذاكرة أذكى؟",
    button: "ابدأ مجانًا",
    note: "باقة مجانية · بلا بطاقة بنكية"
  },
  footer: {
    privacy: "الخصوصية",
    terms: "الشروط",
    refund: "الاسترداد",
    support: "الدعم",
    github: "GitHub",
    copyright: "KnowFlow. جميع الحقوق محفوظة."
  },
  pricing: {
    title: "أسعار شفافة وبسيطة.",
    free: {
      name: "مجاني",
      price: "$0",
      period: "/شهرياً",
      features: [
        "5 مواد",
        "10 ملفات لكل مادة",
        "100 محادثة/شهر",
        "بالعربية والإنجليزية"
      ],
      button: "ابدأ مجاناً"
    },
    pro: {
      name: "احترافي",
      price: "$49",
      period: "/شهرياً",
      features: [
        "مواد أكثر بكثير",
        "حدود سخية للملفات",
        "حدود يومية عالية"
      ],
      button: "الترقية للاحترافي"
    },
    checkout: {
      unavailable: "تعذّر الوصول إلى مزوّد الدفع. يرجى المحاولة مرة أخرى بعد قليل.",
      misconfigured: "الدفع غير متاح حالياً. المشكلة من جانبنا، وقد تم إبلاغ فريقنا.",
      failed: "حدث خطأ أثناء بدء عملية الدفع. يرجى المحاولة مرة أخرى.",
      reference: "الرقم المرجعي:"
    }
  },
  auth: {
    loginLabel: "تسجيل الدخول",
    signupLabel: "حساب جديد",
    loginTitle: "أهلًا بعودتك",
    loginSubtitle: "ادخل إلى حسابك",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    showPassword: "إظهار كلمة المرور",
    passwordMismatch: "كلمتا المرور غير متطابقتين.",
    loginButton: "تسجيل الدخول",
    googleLogin: "سجل الدخول باستخدام Google",
    googleSignup: "المتابعة باستخدام Google",
    googleFailed: "لم نستطع فتح الدخول عبر Google. جرّب مرة أخرى.",
    appleLogin: "سجل الدخول باستخدام Apple",
    appleSignup: "المتابعة باستخدام Apple",
    appleFailed: "لم نستطع فتح الدخول عبر Apple. جرّب مرة أخرى.",
    orDivider: "أو",
    loggingIn: "نُدخلك إلى حسابك…",
    noAccount: "ليس لديك حساب؟ أنشئ حسابًا",
    signupTitle: "أنشئ حسابك",
    signupSubtitle: "انضم إلى KnowFlow اليوم",
    hasAccount: "لديك حساب؟ ادخل إليه",
    name: "الاسم الكامل",
    createBtn: "أنشئ حسابي",
    creating: "ننشئ حسابك…",
    checkInboxTitle: "تفقد بريدك الإلكتروني",
    checkInboxBody: "أرسلنا رابط تأكيد إلى بريدك الإلكتروني. افتحه لتفعيل حسابك.",
    signupRepeatPassword: "إن سجّلت مرة أخرى ببريد استعملته من قبل، يصلك رابط تأكيد جديد، وتبقى كلمة المرور الأولى كما هي.",
    signupRepeatPasswordLink: "نسيتها؟ اختر كلمة مرور جديدة",
    noticeSigninRequired: "لم يعمل هذا الرابط. سجّل الدخول من الأسفل.",
    noticeLinkExpired: "هذا الرابط استُعمل من قبل أو انتهت صلاحيته. إن كنت فتحته من قبل، فبريدك مؤكد: سجّل الدخول بكلمة مرورك. وإن لم تفتحه، فسجّل من جديد بالبريد نفسه لتصلك رسالة جديدة.",
    noticeRecoveryExpired: "انتهى الرابط. اطلب رابطًا جديدًا.",
    forgotLink: "نسيت كلمة المرور؟",
    forgotTitle: "استعادة كلمة المرور",
    forgotSubtitle: "اكتب بريدك الإلكتروني، ونرسل لك رابطًا تختار به كلمة مرور جديدة.",
    forgotSubmit: "أرسل الرابط",
    forgotSending: "نرسل الرابط…",
    forgotSent: "إن كان لهذا البريد حساب، فالرابط في طريقه إليك. تفقد بريدك.",
    forgotAnyDevice: "يمكنك فتح الرابط على أي جهاز.",
    forgotRateLimited: "أرسلنا رابطًا للتو. انتظر دقيقة قبل أن تطلب رابطًا آخر.",
    resetTitle: "تعيين كلمة مرور جديدة",
    resetSubtitle: "اختر كلمة مرور جديدة لحسابك.",
    resetSubmit: "حفظ كلمة المرور",
    resetSaving: "نحفظ كلمة المرور…",
    resetNoSession: "افتح هذه الصفحة من الرابط في بريدك. أو اطلب رابطًا جديدًا.",
    resetCancel: "إلغاء وتسجيل الخروج",
    backToLogin: "ارجع إلى تسجيل الدخول"
  },
  about: {
    title: "المذاكرة يجب أن تكون أسهل.",
    subtitle: "يحوّل KnowFlow ملاحظاتك وشرائحك وملفات PDF إلى إجابات واضحة من ملفاتك أنت، بالعربية والإنجليزية.",
    missionLabel: "مهمتنا",
    mission: "نبني مساعد مذاكرة يتقن العربية، ليتعلم الطالب من ملفاته هو، باللغة التي يفكر بها.",
    giants: "مبني على أكتاف العمالقة",
    tools: [
      { title: "MarkItDown من Microsoft", desc: "يحوّل ملفاتك إلى نص نظيف" },
      { title: "Voyage AI", desc: "يفهم معنى ملاحظاتك" },
      { title: "Claude من Anthropic", desc: "يجيب على أسئلتك بوضوح" },
      { title: "Supabase", desc: "يحفظ ملفاتك لك وحدك" }
    ],
    ctaTitle: "جاهز لمذاكرة أذكى؟",
    cta: "ابدأ مجانًا"
  },
  contact: {
    title: "كيف يمكننا مساعدتك؟",
    intro: "راسلنا على هذا العنوان. يقرأ رسالتك شخص حقيقي.",
    emailButton: "افتح تطبيق البريد",
    copyButton: "انسخ العنوان",
    copied: "نُسخ العنوان. ألصقه في أي تطبيق بريد.",
    copyFailed: "لا يسمح هذا الجهاز بالنسخ. حدّد العنوان في الأعلى وانسخه بنفسك.",
    noMailApp: "إن لم يُفتح شيء بعد الضغط على الزر، فانسخ العنوان وراسلنا من Gmail أو من أي تطبيق بريد.",
    tip: "اكتب لنا ماذا كنت تفعل وماذا رأيت. واذكر بريد حسابك في KnowFlow لنجده بسرعة."
  },
  dashboard: {
    nav: {
      dashboard: "الرئيسية",
      knowledge: "المواد",
      agent: "اسأل",
      settings: "الإعدادات",
      signOut: "تسجيل الخروج"
    },
    passwordReplaced: {
      title: "أصبحت تدخل الآن عبر Google",
      body: "لم تؤكد بريدك الإلكتروني من قبل، لذلك صار حسابك يُفتح عبر Google. كل ما حفظته موجود كما هو. كلمة المرور القديمة لم تعد تعمل، ويمكنك اختيار كلمة جديدة متى شئت.",
      action: "اختر كلمة مرور",
      dismiss: "حسنًا"
    },
    home: {
      welcome: "أهلًا بك.",
      welcomeLine: "من أين نبدأ اليوم؟",
      streakLit: "رائع، حافظ على الشعلة.",
      streakUnlit: "سؤال واحد اليوم يشعل سلسلتك.",
      knowledgeBases: "المواد",
      knowledgeBasesDesc: "موادك الحالية",
      documents: "الملفات",
      documentsDesc: "ملفات جاهزة للأسئلة",
      conversations: "المحادثات",
      conversationsDesc: "أسئلة طرحتها",
      newKbTitle: "مادة جديدة",
      newKbDesc: "أضف مادة وارفع ملفاتها",
      newSubject: "مادة جديدة",
      talkAgentTitle: "اسأل ملفاتك",
      talkAgentDesc: "عندك سؤال؟ ملفاتك عندها الجواب.",
      streakLabel: "سلسلتك",
      // The six CLDR plural categories for يوم. Selected by `Intl.PluralRules('ar')`,
      // never by a suffix rule: `many` (11..99) takes the SINGULAR ACCUSATIVE يومًا,
      // not the plural, and `other` (100, 101, 102, 200...) takes the bare singular
      // يوم. Rendering "1 أيام" — the defect this replaces — was found on preview
      // `3af9dd5`.
      streakUnit: {
        zero: "أيام", // 0 أيام
        one: "يوم", // 1 يوم
        two: "يومان", // 2 يومان
        few: "أيام", // 3..10 أيام
        many: "يومًا", // 11..99 يومًا
        other: "يوم", // 100 يوم
      },
      streakZoneHint: "بتوقيتك المحلّي",
      recentActivity: "آخر ما فعلته",
      noActivity: "لا شيء هنا بعد. اطرح أول سؤال.",
      platformWeb: "المتصفح",
      conversation: "محادثة",
      showLess: "عرض أقل",
      viewAll: "عرض الكل",
      unknownKb: "مادة غير معروفة",
      // ── #85 student home. 23 keys, added to BOTH files in one pass from a
      //    single declaration so they cannot drift. `tsc` proves KEY parity only,
      //    so the STRINGS were counted by hand: 23 here, 23 in the other file.
      //    NO KEY HERE IS A COUNTED NOUN. That is deliberate: every quota renders
      //    as a large numeral with a caption beside it, so nothing has to agree
      //    with a number, and no Arabic plural category is involved.
      planTitle: "رصيدك اليوم",
      planFree: "مجاني",
      planPro: "الاحترافي",
      questionsLeft: "أسئلة باقية",
      uploadsLeft: "رفعات باقية",
      ofWord: "من",
      subjectsUsed: "مواد مستخدمة",
      allSubjects: "كل المواد",
      materialsWord: "ملخّص",
      noSubjects: "لا مواد بعد",
      noSubjectsDesc: "ستظهر موادك هنا حين تضيفها.",
      startTitle: "ثلاث خطوات وتصلك أول إجابة",
      step1Title: "أنشئ مادة",
      step1Desc: "مادة لكل مقرر.",
      step2Title: "ارفع ملفاتك",
      step2Desc: "PDF أو شرائح أو ملاحظات. كلّها تنفع.",
      step3Title: "اسأل ما تريد",
      step3Desc: "الجواب من ملفاتك أنت.",
      whatTitle: "ماذا يفعل KnowFlow لأجلك",
      whatLine1: "يقرأ ملفاتك ويرتّبها لتسأل عنها.",
      whatLine2: "يلخّصها لك ويصنع منها اختبارات.",
      whatLine3: "يجيبك من ملفاتك، لا من الإنترنت.",
      upgradeCta: "الترقية",
    },
    subjects: {
      subtitle: "مادة لكل مقرر. كل بطاقة تريك إلى أين وصلت.",
      summarised: "مُلخّصة",
      quizzed: "لها اختبار",
      processing: "قيد التحضير",
      noMaterials: "لا ملفات بعد. ارفع شرائح المقرر أو ملاحظاتك لنبدأ.",
      lastAsked: "آخر سؤال",
      lastAdded: "آخر إضافة",
      created: "أُنشئت",
      addMaterial: "أضف ملفًا",
    },
    subjectDetail: {
      askAbout: "اسأل عن هذه المادة",
      stillProcessing: "قيد التحضير",
      statusReady: "جاهز",
      statusProcessing: "قيد التحضير",
      statusError: "لم ينجح",
      statusNoText: "بلا نص",
      noTextLine: "لا نص في هذا الملف. ارفع نسخة فيها نص.",
      checklist: "عدة المذاكرة",
      summaryDone: "الملخص جاهز",
      summaryTodo: "بلا ملخص بعد",
      quizDone: "الاختبار جاهز",
      quizTodo: "بلا اختبار بعد",
      added: "أُضيف",
    },
    suggestions: {
      heading: "جرّب أن تسأل",
      mainIdeas: "ما أهم الأفكار في «{material}»؟",
      hardest: "بسّط لي أصعب فكرة في {subject}.",
      example: "أعطني مثالًا يختبر فهمي لـ«{material}».",
      overview: "لخّص لي {subject} في بضعة أسطر.",
    },
    continueCard: {
      title: "أكمل من حيث توقفت",
      body: "آخر محادثة لك كانت في {subject}.",
      cta: "تابع",
    },
    newKb: {
      title: "مادة جديدة",
      name: "اسم المادة",
      description: "وصف قصير (اختياري)",
      language: "اللغة",
      languageAr: "العربية",
      languageEn: "الإنجليزية",
      languageBoth: "العربية والإنجليزية",
      create: "أنشئ المادة",
      creating: "ننشئ مادتك…",
      errorAuth: "سجّل الدخول أولًا.",
      errorLimitFree: "وصلت إلى حد المواد في الباقة المجانية: {limit}.",
      errorLimitUpgrade: "انتقل إلى الباقة الاحترافية لتضيف المزيد.",
      errorLimitPro: "وصلت إلى حد المواد في باقتك: {limit}."
    },
    kbDetail: {
      documents: "الملفات",
      noDocuments: "لا ملفات هنا بعد. ارفع أول ملف من الأعلى.",
      deleteMaterial: {
        openButton: "حذف",
        warning: "هل تحذف هذا الملف نهائيًا؟ سيختفي الملف وملخّصه واختباراته. لن تستعمله صفحة اسأل بعد الآن، ولا يمكن استرجاع أي شيء.",
        answersKept: "الإجابات التي حصلت عليها من قبل تبقى في محادثاتك، حتى ما اقتبسته من هذا الملف.",
        confirmButton: "احذف نهائيًا",
        cancelButton: "إلغاء",
        deleting: "نحذفه الآن…",
        errorNotFound: "هذا الملف لم يعد موجودًا.",
        errorFailed: "لم يكتمل الحذف. جرّب مرة أخرى.",
        errorContact: "لا نستطيع حذف هذا الملف من هنا. راسلنا على {email} وسنحذفه لك."
      },
      renameMaterial: {
        openButton: "غيّر الاسم",
        label: "الاسم الجديد",
        hint: "يبقى نوع الملف كما هو.",
        saveButton: "احفظ الاسم",
        cancelButton: "إلغاء",
        saving: "نحفظ الاسم…",
        errorInvalid: "اكتب اسمًا فيه حرف واحد على الأقل، بلا / أو \\، وبحد أقصى 200 حرف.",
        errorNotFound: "هذا الملف لم يعد موجودًا.",
        errorConflict: "تغيّر هذا الملف وأنت تعيد تسميته. حدّث الصفحة وجرّب مرة أخرى.",
        errorContact: "لا نستطيع تغيير اسم هذا الملف من هنا. راسلنا على {email} وسنغيّره لك.",
        errorFailed: "لم يتغير الاسم، وبقي كل شيء كما هو. جرّب مرة أخرى."
      }
    },
    summary: {
      heading: "الملخّص",
      generate: "لخّص هذا الملف",
      generating: "نلخّص ملفك…",
      partialNotice: "هذا الملخّص يغطي الجزء الأول فقط من هذا الملف الطويل.",
      errors: {
        session: "انتهت جلستك. حدّث الصفحة وسجّل الدخول من جديد.",
        notFound: "لم نجد هذا الملف.",
        processing: "ما زلنا نجهّز هذا الملف. انتظر حتى يصبح جاهزًا ثم جرّب مرة أخرى.",
        notEnoughText: "في هذا الملف نص قليل جدًا، فلا يمكن تلخيصه.",
        limit: "استعملت كل ملخصات اليوم.",
        temporary: "لم نستطع كتابة الملخّص الآن. جرّب بعد قليل.",
        connection: "انقطع الاتصال. تأكد من الإنترنت وجرّب مرة أخرى."
      }
    },
    quiz: {
      heading: "الاختبار",
      start: "اختبرني في هذا الملف",
      starting: "نجهّز اختبارك…",
      partialNotice: "هذا الاختبار يغطي الجزء الأول فقط من هذا الملف الطويل.",
      submit: "صحّح إجاباتي",
      submitting: "نصحّح إجاباتك…",
      retake: "حاول مجددًا",
      score: "نتيجتك",
      correctAnswer: "الإجابة الصحيحة",
      noAnswer: "تركت هذا السؤال بلا إجابة.",
      errors: {
        session: "انتهت جلستك. حدّث الصفحة وسجّل الدخول من جديد.",
        notFound: "لم نجد هذا الملف.",
        processing: "ما زلنا نجهّز هذا الملف. انتظر حتى يصبح جاهزًا ثم جرّب مرة أخرى.",
        notEnoughText: "في هذا الملف نص قليل جدًا، فلا يمكن صنع اختبار منه.",
        limit: "استعملت كل اختبارات اليوم.",
        badRequest: "حدث خطأ في هذا الطلب. حدّث الصفحة وجرّب مرة أخرى.",
        incomplete: "هذا الاختبار ناقص، فلا يمكن تصحيحه.",
        temporary: "لم نستطع فعل ذلك الآن. جرّب بعد قليل.",
        connection: "انقطع الاتصال. تأكد من الإنترنت وجرّب مرة أخرى."
      }
    },
    settings: {
      title: "الإعدادات",
      subtitle: "حسابك وباقتك وتفضيلاتك.",
      freePlanDesc: "الباقة المجانية. رصيدك اليومي في صفحتك الرئيسية.",
      proPlanDesc: "شكرًا لدعمك KnowFlow.",
      preferences: "التفضيلات",
      language: "اللغة",
      helpLegal: "المساعدة والشروط",
      terms: "شروط الخدمة",
      support: "تواصل معنا",
      supportDesc: "نرد عليك بالبريد الإلكتروني.",
      account: "الحساب",
      email: "البريد الإلكتروني",
      plan: "الباقة",
      free: "مجاني",
      pro: "احترافي",
      renews: "تتجدد في",
      upgrade: "انتقل إلى الاحترافي",
      activeSubscription: "اشتراك نشط",
      privacyPolicy: "سياسة الخصوصية",
      cancels: "ينتهي في",
      cancelSubscription: {
        heading: "الاشتراك",
        description: "أوقف التجديد التلقائي لاشتراكك.",
        keepsAccess: "تحتفظ بالباقة الاحترافية حتى",
        noRefund: "لا تُسترد قيمة الفترة التي دفعت ثمنها بالفعل.",
        canResubscribe: "يمكنك الاشتراك مرة أخرى في أي وقت، ولا يُحذف أي شيء.",
        openButton: "إلغاء الاشتراك",
        confirmPrompt: "هل تلغي اشتراكك؟ حسابك وكل ما فيه يبقى كما هو.",
        confirmButton: "نعم، ألغِ الاشتراك",
        keepButton: "أبقِ اشتراكي",
        working: "نلغي اشتراكك…",
        done: "تم إلغاء اشتراكك. تحتفظ بالباقة الاحترافية حتى",
        errorFailed: "لم تنجح العملية، وبقي كل شيء كما هو. جرّب مرة أخرى.",
        errorPartial: "نجح جزء من العملية فقط. {scheduled} من {total} اشتراكات ستنتهي، لكن {failed} لم يُلغَ وما زال يُحتسب عليك. جرّب مرة أخرى لإلغاء الباقي. وإن فشل مرة أخرى فراسلنا على {email} واذكر الرقم المرجعي أدناه.",
        reference: "الرقم المرجعي:",
        errorElsewhere: "اشتريت جزءًا من اشتراكك خارج هذا التطبيق، فلا يمكن إلغاؤه من هنا. ألغِه من المكان الذي اشتريته منه. أما ما أمكننا إلغاؤه هنا فسينتهي."
      },
      deleteAccount: {
        heading: "حذف الحساب",
        description: "احذف حسابك وكل ما فيه نهائيًا.",
        permanentWarning: "لا يمكن التراجع عن هذا. لا توجد مهلة، ولا يمكن استرجاع أي شيء بعده.",
        whatIsRemoved: "تُحذف موادك وملفاتك ومحادثاتك واختباراتك وسجل مذاكرتك كله.",
        billingNote: "إن كان لديك اشتراك نشط فسيُلغى فورًا.",
        openButton: "حذف الحساب",
        confirmPrompt: "اكتب بريدك الإلكتروني للتأكيد:",
        confirmPlaceholder: "بريدك الإلكتروني",
        confirmButton: "احذف حسابي نهائيًا",
        cancelButton: "إلغاء",
        deleting: "نحذف حسابك…",
        errorMismatch: "هذا ليس بريدك الإلكتروني. تأكد منه واكتبه مرة أخرى.",
        errorFailed: "لم يكتمل الحذف، وبقي كل شيء كما هو. جرّب مرة أخرى.",
        errorBillingCanceled: "لم تفقد أي شيء. حسابك وكل بياناتك ما زالت هنا. ألغينا اشتراكك، لكن الحذف لم يكتمل. جرّب مرة أخرى، وإن فشل مجددًا فراسلنا على {email} لنكمله لك.",
        errorSubscriptionElsewhere: "لم نحذف حسابك، وبقي كل شيء كما هو. لديك اشتراك اشتريته خارج هذا التطبيق، ولا نستطيع إلغاءه من هنا. ألغِه أولًا من المكان الذي اشتريته منه، ثم احذف حسابك. توقفنا حتى لا نحذف حسابك وما زال شيء يُحتسب عليك."
      }
    },
    // Apple 5.1.2(i), STORE_PATH.md S4. مسودة من الوكيل، تنتظر دفعة نسخ المالك.
    aiConsent: {
      title: "إذنك قبل أن يقرأ الذكاء الاصطناعي ملفاتك",
      intro: "لنجيب عن أسئلتك ونلخّص ملفاتك ونعدّ لك الاختبارات، نرسل المحتوى إلى شركتين للذكاء الاصطناعي:",
      anthropic: "شركة Anthropic تتلقى نص ملفاتك وأسئلتك، وتكتب الإجابات والملخصات والاختبارات.",
      voyage: "شركة Voyage AI تتلقى النص نفسه، وتحوّله إلى الصيغة التي يستعملها بحثنا للعثور على المقطع المناسب.",
      notSent: "لا تتلقى أيّ منهما اسمك ولا بريدك الإلكتروني، ولا تستعمل أيّ منهما محتواك لتدريب نماذجها.",
      withdrawHint: "يمكنك سحب هذا الإذن في أي وقت من الإعدادات.",
      privacyLink: "اقرأ سياسة الخصوصية",
      accept: "أوافق، تابِع",
      notNow: "ليس الآن",
      saving: "نحفظ اختيارك…",
      saveFailed: "تعذّر حفظ اختيارك، ولم نرسل شيئًا. جرّب مرة أخرى.",
      declined: "لم نرسل شيئًا. يحتاج الرفع والأسئلة والملخصات والاختبارات إلى إذنك باستعمال Anthropic وVoyage AI. يمكنك منحه في المرة القادمة أو من الإعدادات.",
      heading: "المعالجة بالذكاء الاصطناعي",
      stateOn: "مسموح. نرسل ملفاتك وأسئلتك إلى Anthropic وVoyage AI عند الرفع أو السؤال أو التلخيص أو إعداد اختبار.",
      stateOff: "غير مسموح. لا نرسل شيئًا، ولا يتاح الرفع ولا الأسئلة ولا الملخصات ولا الاختبارات حتى تسمح بذلك.",
      withdrawButton: "اسحب الإذن",
      allowButton: "اسمح",
      withdrawFailed: "لم ينجح ذلك، وبقي كل شيء كما هو. جرّب مرة أخرى."
    },
    agent: {
      chatWith: "تسأل عن",
      startTyping: "كل جواب يأتي من ملفات هذه المادة.",
      emptyTitle: "ما الذي يحيّرك اليوم؟",
      askPlaceholder: "اكتب سؤالك…",
      sendHintMac: "⌘ + Enter للإرسال",
      sendHintOther: "Ctrl + Enter للإرسال",
      send: "أرسل",
      connectionError: "انقطع الاتصال. حاول مرة أخرى.",
      newConversation: "+ محادثة جديدة",
      noHistory: "لا محادثات بعد.",
      history: "محادثاتك"
    },
    upload: {
      uploadFailed: "لم نتأكد من وصول ملفك. حدّث الصفحة لترى إن كان قد وصل، وإن لم يصل فارفعه مرة أخرى.",
      dropHere: "اسحب ملفاتك إلى هنا أو اضغط لرفعها",
      supported: "الملفات المقبولة: PDF, DOCX, PPTX, XLSX, TXT, MD (حتى {limit} للملف الواحد)",
      uploading: "نرفع ملفك…",
      reading: "نقرأ ملفك…",
      preparing: "نجهّزه للأسئلة…",
      stillWorking: "ما زلنا نعمل عليه…",
      usuallyAbout: "عادةً نحو {n} ثانية لملف بهذا الحجم.",
      leaveNote: "الملفات الكبيرة قد تأخذ دقيقة أو دقيقتين. يمكنك مغادرة الصفحة، وسيظهر الملف هنا بعد تحديثها.",
      tryAnother: "اختر ملفًا آخر وجرّب مرة أخرى.",
      ready: "جاهز ✓",
      error: "لم ينجح"
    }
  }
};
