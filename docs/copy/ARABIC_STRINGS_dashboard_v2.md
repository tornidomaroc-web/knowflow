# Arabic copy batch 2: signed-in app

Source: `docs/copy/ARABIC_STRINGS.md` generated 2026-09-25 from main.
Scope: `dashboard.home` (2 fixes), `dashboard.nav`, `dashboard.passwordReplaced`, `dashboard.newKb`, `dashboard.kbDetail`, `dashboard.summary`, `dashboard.quiz`, `dashboard.settings`, `dashboard.upload`.
84 rows change. Every key in these groups that is not listed below keeps its current Arabic unchanged.
Rules kept: every key and every `{placeholder}` byte for byte, product names unchanged, Western digits only, the subject is "مادة" and an uploaded file is "ملف".

## dashboard.home (fixes)

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.home.welcome` | أهلًا بك. | أهلًا من جديد. |
| `dashboard.home.noSubjectsDesc` | ستظهر موادك هنا حين تضيفها. | كل مادة تمثّل مقررًا واحدًا. أنشئ أول مادة وارفع ملفاتها. |

## dashboard.nav

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.nav.dashboard` | الرئيسية | اللوحة |

## dashboard.passwordReplaced

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.passwordReplaced.title` | أصبحت تدخل الآن عبر Google | أصبح دخولك الآن عبر Google |
| `dashboard.passwordReplaced.body` | لم تؤكد بريدك الإلكتروني من قبل، لذلك صار حسابك يُفتح عبر Google. كل ما حفظته موجود كما هو. كلمة المرور القديمة لم تعد تعمل، ويمكنك اختيار كلمة جديدة متى شئت. | لم يتم تأكيد بريدك الإلكتروني، لذلك أصبح الدخول عبر Google هو طريقة الوصول إلى هذا الحساب. كل ما حفظته لا يزال موجوداً، لكن كلمة المرور التي اخترتها سابقاً لم تعد تعمل. يمكنك تعيين كلمة مرور جديدة متى شئت. |
| `dashboard.passwordReplaced.action` | اختر كلمة مرور | تعيين كلمة مرور |
| `dashboard.passwordReplaced.dismiss` | حسنًا | إخفاء |

## dashboard.newKb

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.newKb.title` | مادة جديدة | إنشاء مادة |
| `dashboard.newKb.name` | اسم المادة | الاسم |
| `dashboard.newKb.description` | وصف قصير (اختياري) | الوصف (اختياري) |
| `dashboard.newKb.languageBoth` | العربية والإنجليزية | كلاهما |
| `dashboard.newKb.create` | أنشئ المادة | إنشاء مادة |
| `dashboard.newKb.creating` | ننشئ مادتك… | جارٍ الإنشاء... |
| `dashboard.newKb.errorAuth` | سجّل الدخول أولًا. | غير مصادق عليه |
| `dashboard.newKb.errorLimitFree` | وصلت إلى حد المواد في الباقة المجانية: {limit}. | لقد بلغت الحد الأقصى للمواد في الباقة المجانية ({limit}). |
| `dashboard.newKb.errorLimitUpgrade` | انتقل إلى الباقة الاحترافية لتضيف المزيد. | قم بالترقية إلى الاحترافي للمزيد. |
| `dashboard.newKb.errorLimitPro` | وصلت إلى حد المواد في باقتك: {limit}. | لقد بلغت الحد الأقصى للمواد ({limit}). |

## dashboard.kbDetail

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.kbDetail.noDocuments` | لا ملفات هنا بعد. ارفع أول ملف من الأعلى. | لا توجد ملفات بعد. ارفع أول ملف لك أعلاه. |
| `dashboard.kbDetail.chunks` | أجزاء | مقاطع |
| `dashboard.kbDetail.deleteMaterial.warning` | هل تحذف هذا الملف نهائيًا؟ سيختفي الملف وملخّصه واختباراته. لن تستعمله صفحة اسأل بعد الآن، ولا يمكن استرجاع أي شيء. | هل تريد حذف هذا الملف نهائيًا؟ سيُحذف الملف وملخّصه واختباراته، ولن تستخدمه صفحة اسأل بعد الآن، ولا يمكن استرجاع أي شيء. |
| `dashboard.kbDetail.deleteMaterial.answersKept` | الإجابات التي حصلت عليها من قبل تبقى في محادثاتك، حتى ما اقتبسته من هذا الملف. | الإجابات التي حصلت عليها سابقًا في صفحة اسأل تبقى في محادثاتك، بما في ذلك ما اقتبسته من هذا الملف. |
| `dashboard.kbDetail.deleteMaterial.deleting` | نحذفه الآن… | جارٍ الحذف… |
| `dashboard.kbDetail.deleteMaterial.errorFailed` | لم يكتمل الحذف. جرّب مرة أخرى. | لم يكتمل الحذف. يمكنك المحاولة مرة أخرى. |
| `dashboard.kbDetail.deleteMaterial.errorContact` | لا نستطيع حذف هذا الملف من هنا. راسلنا على {email} وسنحذفه لك. | تعذّر حذف هذا الملف من هنا. راسلنا على {email} وسنحذفه لك. |
| `dashboard.kbDetail.renameMaterial.openButton` | غيّر الاسم | إعادة تسمية |
| `dashboard.kbDetail.renameMaterial.saveButton` | احفظ الاسم | حفظ الاسم |
| `dashboard.kbDetail.renameMaterial.saving` | نحفظ الاسم… | جارٍ الحفظ… |
| `dashboard.kbDetail.renameMaterial.errorInvalid` | اكتب اسمًا فيه حرف واحد على الأقل، بلا / أو \، وبحد أقصى 200 حرف. | أدخل اسمًا غير فارغ، بلا / أو \، ولا يتجاوز 200 حرف. |
| `dashboard.kbDetail.renameMaterial.errorConflict` | تغيّر هذا الملف وأنت تعيد تسميته. حدّث الصفحة وجرّب مرة أخرى. | تغيّر هذا الملف أثناء إعادة تسميته. أعد تحميل الصفحة وحاول مرة أخرى. |
| `dashboard.kbDetail.renameMaterial.errorContact` | لا نستطيع تغيير اسم هذا الملف من هنا. راسلنا على {email} وسنغيّره لك. | تعذّرت إعادة تسمية هذا الملف من هنا. راسلنا على {email} وسنعيد تسميته لك. |
| `dashboard.kbDetail.renameMaterial.errorFailed` | لم يتغير الاسم، وبقي كل شيء كما هو. جرّب مرة أخرى. | لم تكتمل إعادة التسمية ولم يتغير أي شيء. يمكنك المحاولة مرة أخرى. |

## dashboard.summary

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.summary.generate` | لخّص هذا الملف | لخّص هذه المادة |
| `dashboard.summary.generating` | نلخّص ملفك… | جارٍ التلخيص… |
| `dashboard.summary.partialNotice` | هذا الملخّص يغطي الجزء الأول فقط من هذا الملف الطويل. | هذا الملخّص يغطّي الجزء الأول فقط من هذه المادة الطويلة. |
| `dashboard.summary.errors.session` | انتهت جلستك. حدّث الصفحة وسجّل الدخول من جديد. | انتهت جلستك. يُرجى تحديث الصفحة وتسجيل الدخول من جديد. |
| `dashboard.summary.errors.notFound` | لم نجد هذا الملف. | تعذّر العثور على هذه المادة. |
| `dashboard.summary.errors.processing` | ما زلنا نجهّز هذا الملف. انتظر حتى يصبح جاهزًا ثم جرّب مرة أخرى. | لا تزال هذه المادة قيد المعالجة. انتظر حتى تصبح جاهزة ثم حاول مجددًا. |
| `dashboard.summary.errors.notEnoughText` | في هذا الملف نص قليل جدًا، فلا يمكن تلخيصه. | لا يوجد نص كافٍ في هذه المادة لتلخيصها. |
| `dashboard.summary.errors.limit` | استعملت كل ملخصات اليوم. | بلغت حدك اليومي من الملخصات. |
| `dashboard.summary.errors.temporary` | لم نستطع كتابة الملخّص الآن. جرّب بعد قليل. | تعذّر إنشاء الملخّص الآن. يُرجى المحاولة بعد قليل. |
| `dashboard.summary.errors.connection` | انقطع الاتصال. تأكد من الإنترنت وجرّب مرة أخرى. | تعذّر الاتصال. تحقّق من اتصالك وحاول مجددًا. |

## dashboard.quiz

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.quiz.start` | اختبرني في هذا الملف | اختبرني في هذه المادة |
| `dashboard.quiz.starting` | نجهّز اختبارك… | جارٍ تحضير اختبارك… |
| `dashboard.quiz.partialNotice` | هذا الاختبار يغطي الجزء الأول فقط من هذا الملف الطويل. | هذا الاختبار يغطّي الجزء الأول فقط من هذه المادة الطويلة. |
| `dashboard.quiz.submit` | صحّح إجاباتي | تحقّق من إجاباتي |
| `dashboard.quiz.submitting` | نصحّح إجاباتك… | جارٍ التحقّق… |
| `dashboard.quiz.noAnswer` | تركت هذا السؤال بلا إجابة. | لم تُجب عن هذا السؤال. |
| `dashboard.quiz.errors.session` | انتهت جلستك. حدّث الصفحة وسجّل الدخول من جديد. | انتهت جلستك. يُرجى تحديث الصفحة وتسجيل الدخول من جديد. |
| `dashboard.quiz.errors.notFound` | لم نجد هذا الملف. | تعذّر العثور على هذه المادة. |
| `dashboard.quiz.errors.processing` | ما زلنا نجهّز هذا الملف. انتظر حتى يصبح جاهزًا ثم جرّب مرة أخرى. | لا تزال هذه المادة قيد المعالجة. انتظر حتى تصبح جاهزة ثم حاول مجددًا. |
| `dashboard.quiz.errors.notEnoughText` | في هذا الملف نص قليل جدًا، فلا يمكن صنع اختبار منه. | لا يوجد نص كافٍ في هذه المادة لإنشاء اختبار. |
| `dashboard.quiz.errors.limit` | استعملت كل اختبارات اليوم. | بلغت حدك اليومي من الاختبارات. |
| `dashboard.quiz.errors.badRequest` | حدث خطأ في هذا الطلب. حدّث الصفحة وجرّب مرة أخرى. | حدث خطأ في هذا الطلب. يُرجى تحديث الصفحة والمحاولة مجددًا. |
| `dashboard.quiz.errors.incomplete` | هذا الاختبار ناقص، فلا يمكن تصحيحه. | هذا الاختبار غير مكتمل ولا يمكن تصحيحه. |
| `dashboard.quiz.errors.temporary` | لم نستطع فعل ذلك الآن. جرّب بعد قليل. | تعذّر تنفيذ ذلك الآن. يُرجى المحاولة بعد قليل. |
| `dashboard.quiz.errors.connection` | انقطع الاتصال. تأكد من الإنترنت وجرّب مرة أخرى. | تعذّر الاتصال. تحقّق من اتصالك وحاول مجددًا. |

## dashboard.settings

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.settings.freePlanDesc` | الباقة المجانية. رصيدك اليومي في صفحتك الرئيسية. | الباقة المجانية. حصتك اليومية معروضة في صفحتك الرئيسية. |
| `dashboard.settings.helpLegal` | المساعدة والشروط | المساعدة والقانوني |
| `dashboard.settings.support` | تواصل معنا | تواصل مع الدعم |
| `dashboard.settings.supportDesc` | نرد عليك بالبريد الإلكتروني. | نرد عبر البريد الإلكتروني. |
| `dashboard.settings.upgrade` | انتقل إلى الاحترافي | الترقية إلى الاحترافي |
| `dashboard.settings.cancelSubscription.description` | أوقف التجديد التلقائي لاشتراكك. | أوقف تجديد اشتراكك. |
| `dashboard.settings.cancelSubscription.confirmPrompt` | هل تلغي اشتراكك؟ حسابك وكل ما فيه يبقى كما هو. | هل تريد إلغاء اشتراكك؟ يبقى حسابك وكل ما فيه كما هو تمامًا. |
| `dashboard.settings.cancelSubscription.keepButton` | أبقِ اشتراكي | الاحتفاظ بالاشتراك |
| `dashboard.settings.cancelSubscription.working` | نلغي اشتراكك… | جارٍ الإلغاء… |
| `dashboard.settings.cancelSubscription.errorFailed` | لم تنجح العملية، وبقي كل شيء كما هو. جرّب مرة أخرى. | لم تنجح العملية ولم يتغير أي شيء. يمكنك المحاولة مرة أخرى. |
| `dashboard.settings.cancelSubscription.errorPartial` | نجح جزء من العملية فقط. {scheduled} من {total} اشتراكات ستنتهي، لكن {failed} لم يُلغَ وما زال يُحتسب عليك. جرّب مرة أخرى لإلغاء الباقي. وإن فشل مرة أخرى فراسلنا على {email} واذكر الرقم المرجعي أدناه. | نجح جزء من العملية فقط. {scheduled} من {total} اشتراكات أصبحت مُجدولة للإنهاء، لكن {failed} لم يُلغَ ولا يزال يُحتسب عليك. يرجى المحاولة مرة أخرى لإلغاء الباقي. وإذا تكرر الفشل فراسلنا على {email} مع ذكر الرقم المرجعي أدناه. |
| `dashboard.settings.cancelSubscription.errorElsewhere` | اشتريت جزءًا من اشتراكك خارج هذا التطبيق، فلا يمكن إلغاؤه من هنا. ألغِه من المكان الذي اشتريته منه. أما ما أمكننا إلغاؤه هنا فسينتهي. | جزء من اشتراكك تم شراؤه خارج هذا التطبيق، لذلك لا يمكن إلغاؤه من هنا. يرجى إلغاؤه من المكان الذي اشتريته منه. أما ما استطعنا إلغاءه هنا فقد جرى ضبطه لينتهي. |
| `dashboard.settings.deleteAccount.permanentWarning` | لا يمكن التراجع عن هذا. لا توجد مهلة، ولا يمكن استرجاع أي شيء بعده. | لا يمكن التراجع عن هذا الإجراء. لا توجد فترة سماح، ولا يمكن استرجاع أي شيء بعده. |
| `dashboard.settings.deleteAccount.whatIsRemoved` | تُحذف موادك وملفاتك ومحادثاتك واختباراتك وسجل مذاكرتك كله. | تُحذف موضوعاتك وموادك ومحادثاتك واختباراتك وسجل دراستك، مع كل ملف رفعته. |
| `dashboard.settings.deleteAccount.billingNote` | إن كان لديك اشتراك نشط فسيُلغى فورًا. | إذا كان لديك اشتراك نشط فسيتم إلغاؤه فورًا. |
| `dashboard.settings.deleteAccount.deleting` | نحذف حسابك… | جارٍ الحذف… |
| `dashboard.settings.deleteAccount.errorMismatch` | هذا ليس بريدك الإلكتروني. تأكد منه واكتبه مرة أخرى. | لا يطابق هذا بريدك الإلكتروني. |
| `dashboard.settings.deleteAccount.errorFailed` | لم يكتمل الحذف، وبقي كل شيء كما هو. جرّب مرة أخرى. | فشل الحذف ولم يتغير أي شيء. يمكنك المحاولة مرة أخرى. |
| `dashboard.settings.deleteAccount.errorBillingCanceled` | لم تفقد أي شيء. حسابك وكل بياناتك ما زالت هنا. ألغينا اشتراكك، لكن الحذف لم يكتمل. جرّب مرة أخرى، وإن فشل مجددًا فراسلنا على {email} لنكمله لك. | لم تفقد أي شيء. حسابك وكل بياناتك ما زالت كما هي. تم إلغاء اشتراكك، لكن عملية الحذف لم تكتمل. أعد المحاولة، وإذا تكرر الفشل فراسلنا على {email} لإتمامها. |
| `dashboard.settings.deleteAccount.errorSubscriptionElsewhere` | لم نحذف حسابك، وبقي كل شيء كما هو. لديك اشتراك اشتريته خارج هذا التطبيق، ولا نستطيع إلغاءه من هنا. ألغِه أولًا من المكان الذي اشتريته منه، ثم احذف حسابك. توقفنا حتى لا نحذف حسابك وما زال شيء يُحتسب عليك. | لم يُحذف حسابك ولم يتغير أي شيء. لا يزال لديك اشتراك تم شراؤه خارج هذا التطبيق، ولا يمكننا إلغاؤه لك من هنا. ألغِ الاشتراك من المكان الذي اشتريته منه أولًا، ثم احذف حسابك. توقفنا بدلًا من حذف حسابك بينما لا يزال هناك ما يُحتسب عليك. |

## dashboard.upload

| Key | New Arabic | Old Arabic |
|---|---|---|
| `dashboard.upload.uploadFailed` | لم نتأكد من وصول ملفك. حدّث الصفحة لترى إن كان قد وصل، وإن لم يصل فارفعه مرة أخرى. | لم نتمكن من التأكد من رفع ملفك. حدّث الصفحة لترى إن كان قد وصل، وارفعه مجددًا إن لم يصل. |
| `dashboard.upload.dropHere` | اسحب ملفاتك إلى هنا أو اضغط لرفعها | أسقط الملفات هنا أو انقر للرفع |
| `dashboard.upload.supported` | الملفات المقبولة: PDF, DOCX, PPTX, XLSX, TXT, MD (حتى {limit} للملف الواحد) | المدعوم: PDF, DOCX, PPTX, XLSX, TXT, MD (حتى {limit} للملف الواحد) |
| `dashboard.upload.uploading` | نرفع ملفك… | جارٍ الرفع… |
| `dashboard.upload.processing` | لحظة من فضلك… | جارٍ المعالجة… |
| `dashboard.upload.leaveNote` | الملفات الكبيرة قد تأخذ دقيقة أو دقيقتين. يمكنك مغادرة الصفحة، وسيظهر الملف هنا بعد تحديثها. | قد تستغرق الملفات الكبيرة دقيقة أو دقيقتين. يمكنك مغادرة الصفحة؛ سيظهر الملف بعد تحديثها حين يكتمل. |
| `dashboard.upload.tryAnother` | اختر ملفًا آخر وجرّب مرة أخرى. | اختر ملفًا آخر للمحاولة مجددًا. |
| `dashboard.upload.error` | لم ينجح | خطأ |
