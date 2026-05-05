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
    badge: "مفتوح المصدر · رخصة MIT",
    title: "وثائقك. أي سؤال. في ثوانٍ.",
    subtitle: "ارفع عقودك أو كتالوجاتك أو سياسات HR — واحصل على إجابات فورية بالعربية أو الإنجليزية. بدون بحث. بدون تنقل. فقط اسأل.",
    note: "مصمم للفرق التي تتعامل مع مستندات حقيقية كل يوم.",
    cta1: "ارفع أول مستند لك",
    cta2: "شاهد كيف يعمل",
    disclaimer: "لا يتطلب بطاقة ائتمانية · باقة مجانية متوفرة · يعمل في ثوانٍ"
  },
  features: {
    title: "لماذا KnowFlow",
    items: [
      { title: "يعمل بالعربية والإنجليزية", desc: "بشكل أصلي، وليس مترجماً" },
      { title: "مدرب على مستنداتك", desc: "وليس على الإنترنت" },
      { title: "بدون إعداد. بدون برمجة.", desc: "ارفع ملفاتك وابدأ." }
    ]
  },
  usecases: {
    title: "ماذا يمكن لفريقك أن يفعل مع KnowFlow",
    items: [
      { num: "01", title: "أجب على أسئلة الموارد البشرية فوراً", desc: "يسأل الموظف عن سياسة الإجازات في 9 مساءً. يجيب KnowFlow من مستندات HR الخاصة بك — بدون انتظار." },
      { num: "02", title: "ابحث في العقود في ثوانٍ", desc: "توقف عن قراءة عقود من 40 صفحة للبحث عن بند واحد. اسأل KnowFlow واحصل على الإجابة الدقيقة." },
      { num: "03", title: "حوّل كتالوجاتك لمساعد مبيعات", desc: "يسأل فريقك أسئلة عن المنتجات طوال اليوم. ارفع الكتالوج مرة واحدة — وسيجيب KnowFlow دائماً." },
      { num: "04", title: "تأهيل الموظفين الجدد أسرع", desc: "الموظف الجديد لديه 50 سؤالاً. KnowFlow يعرف كل سياسة وعملية وإجراء في مؤسستك." }
    ]
  },
  howItWorks: {
    title: "كيف يعمل",
    steps: [
      { step: "الخطوة 1", title: "ارفع مستنداتك", desc: "PDF، Word، Excel — أي صيغة يستخدمها فريقك." },
      { step: "الخطوة 2", title: "اسأل بالعربية أو الإنجليزية", desc: "اكتب سؤالك بشكل طبيعي. بدون كلمات مفتاحية أو مصطلحات معقدة." },
      { step: "الخطوة 3", title: "احصل على الإجابة الدقيقة", desc: "يقرأ KnowFlow مستنداتك ويقدم المعلومات الصحيحة فوراً." }
    ]
  },
  cta: {
    title: "جاهز للبدء؟",
    placeholder: "name@company.com",
    button: "ابدأ الآن",
    badge: "مفتوح المصدر · رخصة MIT",
    success: "تم تسجيلك في القائمة. سنتواصل معك قريباً.",
    errorDuplicate: "هذا البريد مسجّل مسبقاً في القائمة.",
    errorGeneric: "حدث خطأ ما. حاول مرة أخرى."
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
        "قاعدة معرفة واحدة",
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
      knowledge: "قواعد المعرفة",
      agent: "الوكيل",
      settings: "الإعدادات",
      signOut: "تسجيل الخروج"
    },
    home: {
      welcome: "مرحباً بعودتك.",
      knowledgeBases: "قواعد المعرفة",
      knowledgeBasesDesc: "قواعد المعرفة النشطة",
      documents: "المستندات",
      documentsDesc: "ملفات تمت معالجتها",
      conversations: "المحادثات",
      conversationsDesc: "تفاعلات الوكيل",
      newKbTitle: "قاعدة معرفة جديدة",
      newKbDesc: "ارفع مستندات وأنشئ وكيلاً",
      talkAgentTitle: "تحدث مع الوكيل",
      talkAgentDesc: "اطرح أسئلة حول قواعد معرفتك",
      recentActivity: "النشاط الأخير",
      noActivity: "لا يوجد نشاط بعد",
      conversation: "محادثة",
      showLess: "عرض أقل",
      viewAll: "عرض الكل",
      unknownKb: "قاعدة معرفة غير معروفة"
    },
    newKb: {
      title: "إنشاء قاعدة معرفة",
      name: "الاسم",
      description: "الوصف (اختياري)",
      language: "اللغة",
      languageAr: "العربية",
      languageEn: "الإنجليزية",
      languageBoth: "كلاهما",
      create: "إنشاء قاعدة معرفة",
      creating: "جارٍ الإنشاء...",
      errorAuth: "غير مصادق عليه",
      errorLimit: "تسمح الباقة المجانية بقاعدة معرفة واحدة فقط. قم بالترقية إلى الاحترافي للمزيد."
    },
    kbDetail: {
      documents: "المستندات",
      noDocuments: "لا توجد مستندات بعد. ارفع أول ملف لك أعلاه.",
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
      chatWith: "محادثة مع",
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
      supported: "المدعوم: PDF, DOCX, XLSX, MP3, MP4 (الحد الأقصى: 50 ميجابايت)",
      uploading: "جارٍ الرفع...",
      processing: "جارٍ المعالجة...",
      ready: "جاهز ✓",
      error: "خطأ"
    }
  }
};
