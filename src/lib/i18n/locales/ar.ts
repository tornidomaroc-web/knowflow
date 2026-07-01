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
        "قاعدتا معرفة",
        "10 مستندات",
        "100 محادثة/شهر",
        "الوصول عبر الويب فقط"
      ],
      button: "ابدأ مجاناً"
    },
    pro: {
      name: "احترافي",
      price: "$49",
      period: "/شهرياً",
      features: [
        "10 قواعد معرفة",
        "مستندات غير محدودة",
        "محادثات غير محدودة",
        "تيليجرام + سلاك + API",
        "دعم ذو أولوية"
      ],
      button: "الترقية للاحترافي"
    },
    enterprise: {
      name: "الشركات",
      price: "مخصص",
      features: [
        "كل شيء غير محدود",
        "نطاق مخصص",
        "دعم مخصص",
        "ضمان مستوى الخدمة (SLA)"
      ],
      button: "اتصل بنا"
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
    title: "نؤمن بأن المعرفة يجب أن تعمل من أجلك.",
    subtitle: "يحول KnowFlow مستنداتك إلى وكلاء ذكاء اصطناعي يستجيبون ويتعلمون وينفذون — بالعربية والإنجليزية.",
    missionLabel: "مهمتنا",
    mission: "نبني أول منصة معرفة ذكاء اصطناعي مصممة للشركات والفرق المتحدثة بالعربية.",
    giants: "مبني على أكتاف العمالقة",
    tools: [
      { title: "MarkItDown تقنية مايكروسوفت", desc: "ذكاء المستندات" },
      { title: "Hermes Agent بواسطة NousResearch", desc: "التعلم الذاتي" },
      { title: "Archon Workflows", desc: "التنفيذ الحتمي" },
      { title: "Claude بواسطة Anthropic", desc: "فهم اللغة" }
    ],
    ctaTitle: "جاهز لتحويل معرفتك؟",
    cta: "ابدأ مجاناً"
  },
  contact: {
    title: "تواصل معنا.",
    general: "عام",
    enterprise: "الشركات",
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
