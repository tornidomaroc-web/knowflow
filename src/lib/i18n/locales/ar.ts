import { en } from './en';

export type Translation = typeof en;

export const ar: Translation = {
  nav: {
    home: "KnowFlow",
    howItWorks: "كيف يعمل",
    pricing: "الأسعار",
    docs: "المستندات",
    getStarted: "ابدأ مجاناً"
  },
  hero: {
    badge: "مصمم للطلاب · بالعربية والإنجليزية",
    title: "ملاحظاتك. أي سؤال. في ثوانٍ.",
    subtitle: "ارفع ملاحظاتك ومحاضراتك وملفات PDF — ثم اطرح أسئلتك واحصل على إجابات واضحة بالعربية أو الإنجليزية. بدون بحث. بدون تنقّل. فقط اسأل.",
    note: "مصمم للطلاب الذين يفضّلون الفهم على التنقيب في ملفات PDF.",
    cta1: "ابدأ مجاناً",
    cta2: "شاهد كيف يعمل",
    disclaimer: "بدون بطاقة ائتمانية · ابدأ مجاناً · جاهز في ثوانٍ"
  },
  features: {
    title: "لماذا KnowFlow",
    items: [
      { title: "يعمل بالعربية والإنجليزية", desc: "بشكل أصلي، وليس مترجماً" },
      { title: "يجيب من ملاحظاتك", desc: "وليس من الإنترنت" },
      { title: "بدون إعداد. بدون برمجة.", desc: "ارفع ملفاتك وابدأ." }
    ]
  },
  usecases: {
    title: "ماذا يمكنك أن تفعل مع KnowFlow",
    items: [
      { num: "01", title: "افهم المواضيع الصعبة بسرعة", desc: "عالق في فكرة قبل الامتحان بليلة؟ اسأل KnowFlow واحصل على شرح واضح مأخوذ من ملاحظاتك أنت." },
      { num: "02", title: "اعثر على الإجابة دون تنقّل", desc: "توقف عن تصفّح 60 شريحة للعثور على تعريف واحد. اسأل KnowFlow واحصل على الإجابة الدقيقة." },
      { num: "03", title: "راجع قبل الامتحانات", desc: "حوّل ملاحظات مادة إلى شريك مذاكرة. اسأل أي شيء عن تلك المادة واحصل على إجابات مبنية على ملفاتك." },
      { num: "04", title: "ذاكر بلغتك", desc: "اسأل بالعربية أو الإنجليزية — أيّهما يساعدك على الفهم. يجيبك KnowFlow من موادك في الحالتين." }
    ]
  },
  howItWorks: {
    title: "كيف يعمل",
    steps: [
      { step: "الخطوة 1", title: "ارفع موادك", desc: "أضف مادة وارفع ملاحظاتها أو شرائحها أو ملفات PDF — أي صيغة لديك." },
      { step: "الخطوة 2", title: "اسأل بالعربية أو الإنجليزية", desc: "اكتب سؤالك بشكل طبيعي. بدون كلمات مفتاحية أو بحث." },
      { step: "الخطوة 3", title: "احصل على إجابة واضحة", desc: "يقرأ KnowFlow ملفات تلك المادة ويجيب بالمعلومة الصحيحة فوراً." }
    ]
  },
  cta: {
    title: "جاهز لمذاكرة أذكى؟",
    button: "ابدأ مجاناً",
    note: "باقة مجانية · بدون بطاقة ائتمانية · جاهز في دقيقة"
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
        "10 ملفات",
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
        "10 مواد",
        "حدود سخية للملفات",
        "حدود يومية عالية",
        "دعم ذو أولوية"
      ],
      button: "الترقية للاحترافي"
    }
  },
  auth: {
    loginLabel: "تسجيل الدخول",
    signupLabel: "حساب جديد",
    loginTitle: "مرحباً بعودتك",
    loginSubtitle: "سجل الدخول لحسابك",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    loginButton: "تسجيل الدخول",
    loggingIn: "جاري تسجيل الدخول...",
    noAccount: "ليس لديك حساب؟ سجل الآن",
    signupTitle: "أنشئ حسابك",
    signupSubtitle: "انضم إلى KnowFlow اليوم",
    hasAccount: "لديك حساب بالفعل؟ سجل الدخول",
    name: "الاسم الكامل",
    createBtn: "إنشاء الحساب",
    creating: "جاري الإنشاء..."
  },
  about: {
    title: "نؤمن بأن المذاكرة يجب أن تكون أبسط.",
    subtitle: "يحوّل KnowFlow ملاحظاتك وشرائحك وملفات PDF إلى إجابات واضحة — مبنية على موادك أنت، بالعربية والإنجليزية.",
    missionLabel: "مهمتنا",
    mission: "نبني مساعد مذاكرة يتحدث العربية بطلاقة — ليتمكّن الطلاب من التعلّم من موادهم الخاصة، باللغة التي يفكرون بها.",
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
    general: "الدعم",
    name: "الاسم",
    email: "البريد الإلكتروني",
    message: "الرسالة",
    send: "إرسال الرسالة",
    githubText: "عرض على جيت هب"
  },
  dashboard: {
    nav: {
      dashboard: "اللوحة",
      knowledge: "المواد",
      agent: "اسأل",
      settings: "الإعدادات",
      signOut: "تسجيل الخروج"
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
      talkAgentTitle: "اسأل ملفاتك",
      talkAgentDesc: "اطرح أسئلة على ملفات مادة واحدة",
      recentActivity: "النشاط الأخير",
      noActivity: "لا يوجد نشاط بعد",
      conversation: "محادثة",
      showLess: "عرض أقل",
      viewAll: "عرض الكل",
      unknownKb: "مادة غير معروفة"
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
      errorLimit: "تسمح الباقة المجانية بقاعدتي معرفة فقط. قم بالترقية إلى الاحترافي للمزيد."
    },
    kbDetail: {
      documents: "الملفات",
      noDocuments: "لا توجد ملفات بعد. ارفع أول ملف لك أعلاه.",
      chunks: "مقاطع"
    },
    settings: {
      title: "الإعدادات",
      account: "الحساب",
      email: "البريد الإلكتروني",
      plan: "الباقة",
      free: "مجاني",
      pro: "احترافي",
      renews: "تتجدد في",
      upgrade: "الترقية إلى الاحترافي",
      activeSubscription: "اشتراك نشط"
    },
    agent: {
      chatWith: "تسأل عن",
      startTyping: "ابدأ بالكتابة لطرح أسئلتك.",
      askPlaceholder: "اطرح سؤالاً (Cmd+Enter للإرسال)...",
      send: "إرسال",
      connectionError: "خطأ في الاتصال.",
      newConversation: "+ محادثة جديدة",
      noHistory: "لا يوجد سجل بعد."
    },
    upload: {
      fileTooBig: "الملف كبير جدًا. الحد الأقصى للحجم 50 ميجابايت.",
      uploadFailed: "فشل الرفع",
      dropHere: "أسقط الملفات هنا أو انقر للرفع",
      supported: "المدعوم: PDF, DOCX, PPTX, XLSX, TXT, MD (الحد الأقصى: 50 ميجابايت)",
      uploading: "جارٍ الرفع...",
      processing: "جارٍ المعالجة...",
      ready: "جاهز ✓",
      error: "خطأ"
    }
  }
};
