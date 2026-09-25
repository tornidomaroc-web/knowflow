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
    signIn: "سجل الدخول",
    getStarted: "ابدأ مجاناً",
    // Screen-reader only: the hamburger's name (#48). Never rendered as text.
    menu: "القائمة",
    appearance: "المظهر",
    themeDark: "داكن",
    themeLight: "فاتح"
  },
  hero: {
    badge: "مصمم للطلاب · بالعربية والإنجليزية",
    title: "ملاحظاتك. أي سؤال. في ثوانٍ.",
    hook: "عالق في فكرة قبل الامتحان بليلة؟",
    // #108. Still generateMetadata's `description` ([locale]/layout.tsx:27),
    // so the key stays although the hero no longer prints it.
    subtitle: "ارفع ملاحظاتك ومحاضراتك وملفات PDF، ثم اطرح أسئلتك واحصل على إجابات واضحة بالعربية أو الإنجليزية. بدون بحث. بدون تنقّل. فقط اسأل.",
    cta1: "ابدأ مجاناً",
    cta2: "شاهد كيف يعمل",
    disclaimer: "بدون بطاقة ائتمانية · ابدأ مجاناً"
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
    body: "40 وحدة. التكاليف الثابتة 600 درهم على هامش المساهمة 15 درهماً. عندها لا ربح ولا خسارة.",
    files: ["مبادئ الاقتصاد الجزئي.pdf", "تمارين محلولة - الفصل 3.pdf"]
  },
  howItWorks: {
    title: "كيف يعمل",
    steps: [
      { step: "الخطوة 1", title: "ارفع موادك", desc: "أضف مادة وارفع ملاحظاتها أو شرائحها أو ملفات PDF بأيّ صيغة لديك." },
      { step: "الخطوة 2", title: "اسأل بالعربية أو الإنجليزية", desc: "اكتب سؤالك بشكل طبيعي. بدون كلمات مفتاحية أو بحث." },
      { step: "الخطوة 3", title: "احصل على إجابة واضحة", desc: "يقرأ KnowFlow ملفات تلك المادة ويجيب بالمعلومة الصحيحة في ثوانٍ." }
    ]
  },
  cta: {
    title: "جاهز لمذاكرة أذكى؟",
    button: "ابدأ مجاناً",
    note: "باقة مجانية · بدون بطاقة ائتمانية"
  },
  footer: {
    privacy: "الخصوصية",
    terms: "الشروط",
    refund: "الاسترجاع",
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
    loginTitle: "مرحباً بعودتك",
    loginSubtitle: "سجل الدخول لحسابك",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    showPassword: "إظهار كلمة المرور",
    passwordMismatch: "كلمتا المرور غير متطابقتين.",
    loginButton: "تسجيل الدخول",
    googleLogin: "سجل الدخول باستخدام Google",
    googleSignup: "المتابعة باستخدام Google",
    googleFailed: "لم نتمكن من فتح تسجيل الدخول عبر Google. حاول مرة أخرى.",
    orDivider: "أو",
    loggingIn: "جاري تسجيل الدخول...",
    noAccount: "ليس لديك حساب؟ سجل الآن",
    signupTitle: "أنشئ حسابك",
    signupSubtitle: "انضم إلى KnowFlow اليوم",
    hasAccount: "لديك حساب بالفعل؟ سجل الدخول",
    name: "الاسم الكامل",
    createBtn: "إنشاء الحساب",
    creating: "جاري الإنشاء...",
    checkInboxTitle: "تفقد بريدك الإلكتروني",
    checkInboxBody: "أرسلنا رابط تأكيد إلى بريدك الإلكتروني. افتحه لتفعيل حسابك.",
    signupRepeatPassword: "التسجيل مرة أخرى ببريد استخدمته من قبل يرسل رابط تأكيد جديداً، لكنه يبقي كلمة المرور الأولى.",
    signupRepeatPasswordLink: "نسيتها؟ استعد كلمة المرور",
    noticeSigninRequired: "لم نتمكن من إتمام هذا الرابط. سجل الدخول بالأسفل.",
    noticeLinkExpired: "رابط التأكيد لم يعد صالحاً. أنشئ حساباً جديداً للحصول على رابط جديد.",
    forgotLink: "نسيت كلمة المرور؟",
    forgotTitle: "استعادة كلمة المرور",
    forgotSubtitle: "اكتب بريدك الإلكتروني وسنرسل لك رابطاً لتعيين كلمة مرور جديدة.",
    forgotSubmit: "أرسل الرابط",
    forgotSending: "جاري الإرسال...",
    forgotSent: "إن كان لهذا البريد حساب، فالرابط في طريقه إليك. تفقد بريدك.",
    forgotAnyDevice: "يمكنك فتح الرابط على أي جهاز.",
    forgotRateLimited: "تم إرسال رابط للتو. انتظر دقيقة قبل طلب رابط آخر.",
    resetTitle: "تعيين كلمة مرور جديدة",
    resetSubtitle: "اختر كلمة مرور جديدة لحسابك.",
    resetSubmit: "حفظ كلمة المرور",
    resetSaving: "جاري الحفظ...",
    resetNoSession: "تحتاج هذه الصفحة إلى رابط استعادة صالح. اطلب رابطاً جديداً وافتحه من بريدك الإلكتروني.",
    resetCancel: "إلغاء وتسجيل الخروج",
    backToLogin: "العودة لتسجيل الدخول"
  },
  about: {
    title: "نؤمن بأن المذاكرة يجب أن تكون أبسط.",
    subtitle: "يحوّل KnowFlow ملاحظاتك وشرائحك وملفات PDF إلى إجابات واضحة، مبنية على موادك أنت، بالعربية والإنجليزية.",
    missionLabel: "مهمتنا",
    mission: "نبني مساعد مذاكرة يتحدث العربية بطلاقة، ليتمكّن الطلاب من التعلّم من موادهم الخاصة، باللغة التي يفكرون بها.",
    giants: "مبني على أكتاف العمالقة",
    tools: [
      { title: "MarkItDown تقنية مايكروسوفت", desc: "يحوّل ملفاتك إلى نص نظيف" },
      { title: "Voyage AI", desc: "يفهم معنى ملاحظاتك" },
      { title: "Claude بواسطة Anthropic", desc: "يجيب على أسئلتك بوضوح" },
      { title: "Supabase", desc: "يحفظ موادك خاصة بك وحدك" }
    ],
    ctaTitle: "جاهز لمذاكرة أذكى؟",
    cta: "ابدأ مجاناً"
  },
  contact: {
    title: "كيف يمكننا مساعدتك؟",
    intro: "راسلنا على هذا العنوان. يقرأه إنسان.",
    emailButton: "افتح تطبيق البريد",
    copyButton: "انسخ العنوان",
    copied: "تم النسخ. ألصقه في أي تطبيق بريد أو بريد ويب.",
    copyFailed: "النسخ محظور على هذا الجهاز. حدّد العنوان أعلاه وانسخه.",
    noMailApp: "إذا لم يُفتح شيء عند الضغط على الزر، فانسخ العنوان وراسله من Gmail أو أي تطبيق بريد.",
    tip: "أخبرنا بما كنت تفعله وما رأيته، وبالبريد الإلكتروني لحسابك في KnowFlow حتى نجده."
  },
  dashboard: {
    nav: {
      dashboard: "اللوحة",
      knowledge: "المواد",
      agent: "اسأل",
      settings: "الإعدادات",
      signOut: "تسجيل الخروج"
    },
    passwordReplaced: {
      title: "أصبح دخولك الآن عبر Google",
      body: "لم يتم تأكيد بريدك الإلكتروني، لذلك أصبح الدخول عبر Google هو طريقة الوصول إلى هذا الحساب. كل ما حفظته لا يزال موجوداً، لكن كلمة المرور التي اخترتها سابقاً لم تعد تعمل. يمكنك تعيين كلمة مرور جديدة متى شئت.",
      action: "تعيين كلمة مرور",
      dismiss: "إخفاء"
    },
    home: {
      welcome: "مرحباً بعودتك.",
      knowledgeBases: "المواد",
      knowledgeBasesDesc: "المواد النشطة",
      documents: "الملفات",
      documentsDesc: "ملفات تمت معالجتها",
      conversations: "المحادثات",
      conversationsDesc: "الأسئلة المطروحة",
      newKbTitle: "مادة جديدة",
      newKbDesc: "أضف مادة وارفع ملفاتها",
      newSubject: "مادة جديدة",
      talkAgentTitle: "اسأل ملفاتك",
      talkAgentDesc: "اطرح أسئلة على ملفات مادة واحدة",
      streakLabel: "سلسلة المذاكرة",
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
      recentActivity: "النشاط الأخير",
      noActivity: "لا يوجد نشاط بعد",
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
      planTitle: "خطتك",
      planFree: "مجاني",
      planPro: "الاحترافي",
      questionsLeft: "الأسئلة المتبقية",
      uploadsLeft: "الرفعات المتبقية",
      ofWord: "من",
      subjectsUsed: "المواد المستخدمة",
      allSubjects: "كل المواد",
      materialsWord: "ملخّص",
      noSubjects: "لا توجد مواد بعد",
      noSubjectsDesc: "المادة هي مقرر واحد. أضف مادة، ثم ارفع ملفاتها.",
      startTitle: "ابدأ من هنا",
      step1Title: "أنشئ مادة",
      step1Desc: "مادة واحدة لكل مقرر.",
      step2Title: "ارفع ملفاتك",
      step2Desc: "ملفات PDF والشرائح والملاحظات.",
      step3Title: "اطرح سؤالًا",
      step3Desc: "الإجابات تأتي من ملفاتك أنت.",
      whatTitle: "ماذا يفعل KnowFlow",
      whatLine1: "يقرأ الملفات التي ترفعها ويحوّلها إلى نص قابل للبحث.",
      whatLine2: "يكتب ملخصات ويبني اختبارات منها.",
      whatLine3: "يجيب عن أسئلتك من ملفاتك، لا من الإنترنت.",
      upgradeCta: "الترقية",
    },
    newKb: {
      title: "إنشاء مادة",
      name: "الاسم",
      description: "الوصف (اختياري)",
      language: "اللغة",
      languageAr: "العربية",
      languageEn: "الإنجليزية",
      languageBoth: "كلاهما",
      create: "إنشاء مادة",
      creating: "جارٍ الإنشاء...",
      errorAuth: "غير مصادق عليه",
      errorLimitFree: "لقد بلغت الحد الأقصى للمواد في الباقة المجانية ({limit}).",
      errorLimitUpgrade: "قم بالترقية إلى الاحترافي للمزيد.",
      errorLimitPro: "لقد بلغت الحد الأقصى للمواد ({limit})."
    },
    kbDetail: {
      documents: "الملفات",
      noDocuments: "لا توجد ملفات بعد. ارفع أول ملف لك أعلاه.",
      chunks: "مقاطع",
      deleteMaterial: {
        openButton: "حذف",
        warning: "هل تريد حذف هذا الملف نهائيًا؟ سيُحذف الملف وملخّصه واختباراته، ولن تستخدمه صفحة اسأل بعد الآن، ولا يمكن استرجاع أي شيء.",
        answersKept: "الإجابات التي حصلت عليها سابقًا في صفحة اسأل تبقى في محادثاتك، بما في ذلك ما اقتبسته من هذا الملف.",
        confirmButton: "احذف نهائيًا",
        cancelButton: "إلغاء",
        deleting: "جارٍ الحذف…",
        errorNotFound: "هذا الملف لم يعد موجودًا.",
        errorFailed: "لم يكتمل الحذف. يمكنك المحاولة مرة أخرى.",
        errorContact: "تعذّر حذف هذا الملف من هنا. راسلنا على {email} وسنحذفه لك."
      },
      renameMaterial: {
        openButton: "إعادة تسمية",
        label: "الاسم الجديد",
        hint: "يبقى نوع الملف كما هو.",
        saveButton: "حفظ الاسم",
        cancelButton: "إلغاء",
        saving: "جارٍ الحفظ…",
        errorInvalid: "أدخل اسمًا غير فارغ، بلا / أو \\، ولا يتجاوز 200 حرف.",
        errorNotFound: "هذا الملف لم يعد موجودًا.",
        errorConflict: "تغيّر هذا الملف أثناء إعادة تسميته. أعد تحميل الصفحة وحاول مرة أخرى.",
        errorContact: "تعذّرت إعادة تسمية هذا الملف من هنا. راسلنا على {email} وسنعيد تسميته لك.",
        errorFailed: "لم تكتمل إعادة التسمية ولم يتغير أي شيء. يمكنك المحاولة مرة أخرى."
      }
    },
    summary: {
      heading: "الملخّص",
      generate: "لخّص هذه المادة",
      generating: "جارٍ التلخيص…",
      partialNotice: "هذا الملخّص يغطّي الجزء الأول فقط من هذه المادة الطويلة.",
      errors: {
        session: "انتهت جلستك. يُرجى تحديث الصفحة وتسجيل الدخول من جديد.",
        notFound: "تعذّر العثور على هذه المادة.",
        processing: "لا تزال هذه المادة قيد المعالجة. انتظر حتى تصبح جاهزة ثم حاول مجددًا.",
        notEnoughText: "لا يوجد نص كافٍ في هذه المادة لتلخيصها.",
        limit: "بلغت حدك اليومي من الملخصات.",
        temporary: "تعذّر إنشاء الملخّص الآن. يُرجى المحاولة بعد قليل.",
        connection: "تعذّر الاتصال. تحقّق من اتصالك وحاول مجددًا."
      }
    },
    quiz: {
      heading: "الاختبار",
      start: "اختبرني في هذه المادة",
      starting: "جارٍ تحضير اختبارك…",
      partialNotice: "هذا الاختبار يغطّي الجزء الأول فقط من هذه المادة الطويلة.",
      submit: "تحقّق من إجاباتي",
      submitting: "جارٍ التحقّق…",
      retake: "حاول مجددًا",
      score: "نتيجتك",
      correctAnswer: "الإجابة الصحيحة",
      noAnswer: "لم تُجب عن هذا السؤال.",
      errors: {
        session: "انتهت جلستك. يُرجى تحديث الصفحة وتسجيل الدخول من جديد.",
        notFound: "تعذّر العثور على هذه المادة.",
        processing: "لا تزال هذه المادة قيد المعالجة. انتظر حتى تصبح جاهزة ثم حاول مجددًا.",
        notEnoughText: "لا يوجد نص كافٍ في هذه المادة لإنشاء اختبار.",
        limit: "بلغت حدك اليومي من الاختبارات.",
        badRequest: "حدث خطأ في هذا الطلب. يُرجى تحديث الصفحة والمحاولة مجددًا.",
        incomplete: "هذا الاختبار غير مكتمل ولا يمكن تصحيحه.",
        temporary: "تعذّر تنفيذ ذلك الآن. يُرجى المحاولة بعد قليل.",
        connection: "تعذّر الاتصال. تحقّق من اتصالك وحاول مجددًا."
      }
    },
    settings: {
      title: "الإعدادات",
      subtitle: "حسابك وباقتك وتفضيلاتك.",
      freePlanDesc: "الباقة المجانية. حصتك اليومية معروضة في صفحتك الرئيسية.",
      proPlanDesc: "شكرًا لدعمك KnowFlow.",
      preferences: "التفضيلات",
      language: "اللغة",
      helpLegal: "المساعدة والقانوني",
      terms: "شروط الخدمة",
      support: "تواصل مع الدعم",
      supportDesc: "نرد عبر البريد الإلكتروني.",
      account: "الحساب",
      email: "البريد الإلكتروني",
      plan: "الباقة",
      free: "مجاني",
      pro: "احترافي",
      renews: "تتجدد في",
      upgrade: "الترقية إلى الاحترافي",
      activeSubscription: "اشتراك نشط",
      privacyPolicy: "سياسة الخصوصية",
      cancels: "ينتهي في",
      cancelSubscription: {
        heading: "الاشتراك",
        description: "أوقف تجديد اشتراكك.",
        keepsAccess: "تحتفظ بالباقة الاحترافية حتى",
        noRefund: "لا تُسترد قيمة الفترة التي دفعت ثمنها بالفعل.",
        canResubscribe: "يمكنك الاشتراك مرة أخرى في أي وقت، ولا يُحذف أي شيء.",
        openButton: "إلغاء الاشتراك",
        confirmPrompt: "هل تريد إلغاء اشتراكك؟ يبقى حسابك وكل ما فيه كما هو تمامًا.",
        confirmButton: "نعم، ألغِ الاشتراك",
        keepButton: "الاحتفاظ بالاشتراك",
        working: "جارٍ الإلغاء…",
        done: "تم إلغاء اشتراكك. تحتفظ بالباقة الاحترافية حتى",
        errorFailed: "لم تنجح العملية ولم يتغير أي شيء. يمكنك المحاولة مرة أخرى.",
        errorPartial: "نجح جزء من العملية فقط. {scheduled} من {total} اشتراكات أصبحت مُجدولة للإنهاء، لكن {failed} لم يُلغَ ولا يزال يُحتسب عليك. يرجى المحاولة مرة أخرى لإلغاء الباقي. وإذا تكرر الفشل فراسلنا على {email} مع ذكر الرقم المرجعي أدناه.",
        reference: "الرقم المرجعي:",
        errorElsewhere: "جزء من اشتراكك تم شراؤه خارج هذا التطبيق، لذلك لا يمكن إلغاؤه من هنا. يرجى إلغاؤه من المكان الذي اشتريته منه. أما ما استطعنا إلغاءه هنا فقد جرى ضبطه لينتهي."
      },
      deleteAccount: {
        heading: "حذف الحساب",
        description: "احذف حسابك وكل ما فيه نهائيًا.",
        permanentWarning: "لا يمكن التراجع عن هذا الإجراء. لا توجد فترة سماح، ولا يمكن استرجاع أي شيء بعده.",
        whatIsRemoved: "تُحذف موضوعاتك وموادك ومحادثاتك واختباراتك وسجل دراستك، مع كل ملف رفعته.",
        billingNote: "إذا كان لديك اشتراك نشط فسيتم إلغاؤه فورًا.",
        openButton: "حذف الحساب",
        confirmPrompt: "اكتب بريدك الإلكتروني للتأكيد:",
        confirmPlaceholder: "بريدك الإلكتروني",
        confirmButton: "احذف حسابي نهائيًا",
        cancelButton: "إلغاء",
        deleting: "جارٍ الحذف\u2026",
        errorMismatch: "لا يطابق هذا بريدك الإلكتروني.",
        errorFailed: "فشل الحذف ولم يتغير أي شيء. يمكنك المحاولة مرة أخرى.",
        errorBillingCanceled: "لم تفقد أي شيء. حسابك وكل بياناتك ما زالت كما هي. تم إلغاء اشتراكك، لكن عملية الحذف لم تكتمل. أعد المحاولة، وإذا تكرر الفشل فراسلنا على {email} لإتمامها.",
        errorSubscriptionElsewhere: "لم يُحذف حسابك ولم يتغير أي شيء. لا يزال لديك اشتراك تم شراؤه خارج هذا التطبيق، ولا يمكننا إلغاؤه لك من هنا. ألغِ الاشتراك من المكان الذي اشتريته منه أولًا، ثم احذف حسابك. توقفنا بدلًا من حذف حسابك بينما لا يزال هناك ما يُحتسب عليك."
      }
    },
    agent: {
      chatWith: "تسأل عن",
      startTyping: "ابدأ بالكتابة لطرح أسئلتك.",
      askPlaceholder: "اطرح سؤالاً (Cmd+Enter للإرسال)...",
      send: "إرسال",
      connectionError: "خطأ في الاتصال.",
      newConversation: "+ محادثة جديدة",
      noHistory: "لا يوجد سجل بعد.",
      history: "السجل"
    },
    upload: {
      uploadFailed: "لم نتمكن من التأكد من رفع ملفك. حدّث الصفحة لترى إن كان قد وصل، وارفعه مجددًا إن لم يصل.",
      dropHere: "أسقط الملفات هنا أو انقر للرفع",
      supported: "المدعوم: PDF, DOCX, PPTX, XLSX, TXT, MD (حتى {limit} للملف الواحد)",
      uploading: "جارٍ الرفع...",
      processing: "جارٍ المعالجة...",
      ready: "جاهز ✓",
      error: "خطأ"
    }
  }
};
