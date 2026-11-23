"""Item 4i, PR 2: the in-app steps of the App Store capture for iOS 1.1 (the
six light design C screens), for ONE screenshot account, written as the JSON
the iOS shell's smoke harness runs (MainViewController.swift,
KF_SMOKE_STEPS). Generated from docs/store/screenshot-content/plan.json so
the steps, the subject they open and the language check all come from one
place. Step Store-Shots-1 built the first version (the 1.0.1 set).

The six shots, in upload order (captions-1.1.json):
  01-subjects  the subjects list, top of the page;
  02-material  the subject of plan.json (Biology, its Arabic twin), its
               materials and study actions, top of the page;
  03-camera    the camera sheet, opened by its real control (the upload tile,
               then the sheet's camera tile), holding THREE pages: the JPEGs
               in docs/store/screenshot-content/pages/<l>/ (make_pages.py)
               put into the sheet's real <input type=file> (DataTransfer and
               a change event), so the real component re-encodes and numbers
               them. The input's own click() is replaced first, so the
               system picker never opens (the simulator has no camera).
               Nothing is sent: the shot is taken before "Read the pages",
               the sheet is then closed, and the step counts every request to
               the page reader and to storage (it must be 0);
  04-summary   the stored summary, at its heading;
  05-ask       Ask, the plan's question asked LIVE (both languages: the
               messages table keeps no citations, so a reopened answer has no
               sources): the question at the top, the answer, its sources in
               view, the composer with the microphone in view;
  06-quiz      the stored quiz of the plan's file, from question 1, nothing
               answered (the route answers `cached: true`, so no AI call).
No Settings, login, paywall or refusal screen is a shot. The set still ends
signed out (Settings is passed through for its sign-out row, not shot).

AI calls per capture: 2 Ask questions (one per account), 0 page reads, 0
summaries, 0 quizzes.

Every shot step returns `<what it did> | R=<readings JSON>`; check_capture.py
holds them: data-theme light, no [data-kf-iap] element, no platform word,
no e-mail text, no open dialog (03: the camera sheet only), no keyboard (the
step blurs the focused field first), no alert, no subject or file name of the
other account. The app's own probe adds the purchase words and the sign-in
state on every step.

Every step that opens a page names `until`, the pattern its URL must match
(scripts/ios/page_steps.py), so a slow load is never photographed as the
page before it.

Usage: python3 scripts/store-seed/capture_steps.py ar|en > steps.json
       python3 scripts/store-seed/capture_steps.py ar|en --bind '{"subject": "...", "quiz": "..."}'
           the same steps, with the subject and the quiz file named by the
           caller (the CI proof binds them to the preview pages' fixtures)
       python3 scripts/store-seed/capture_steps.py --js NAME   one fragment
       python3 scripts/store-seed/capture_steps.py --other ar|en  the other account's names
"""
import base64
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONTENT = os.path.join(ROOT, 'docs', 'store', 'screenshot-content')
PLAN = json.load(open(os.path.join(CONTENT, 'plan.json'), encoding='utf-8'))
SHOTS = ['01-subjects', '02-material', '03-camera', '04-summary', '05-ask', '06-quiz']
# The steps travel to the simulator base64'd in one environment variable;
# the three page JPEGs are most of it. Kept well under macOS's 1 MiB for the
# arguments and environment together.
STEPS_BUDGET = 160_000

# Activation fix 3: a fresh simulator opens on sign-up (the first set), a
# simulator that held a session on login (the second set, after the first
# signed out). The same step as ios-signed-in.yml, byte for byte
# (scripts/verify-ci-guards.mjs (d)): on sign-up it taps the page's own login
# link; on login it marks the URL so the wait sees a change.
TO_LOGIN = r"""(function(){var p=location.pathname;if(/^\/(en|ar)\/login$/.test(p)){history.replaceState(history.state,'',p+location.search+'#kf-at-login');return 'already on login'}if(!/^\/(en|ar)\/signup$/.test(p)){return 'not on sign-up or login: '+p}var a=Array.prototype.slice.call(document.querySelectorAll('a[href]')).filter(function(x){return /^\/(en|ar)\/login$/.test(x.getAttribute('href')||'')})[0];if(!a){return 'no login link on sign-up'}a.click();return 'clicked the login link on sign-up'})()"""
TO_LOGIN_UNTIL = "/(en|ar)/login(#kf-at-login)?$"

# The login step, as in every signed-in run: __KF_EMAIL__ and __KF_PASSWORD__
# are bare tokens the app replaces from its launch environment.
LOGIN = r"""(function(){var set=function(el,v){var s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};var e=document.querySelector('input[name=email]'),p=document.querySelector('input[name=password]');if(!e||!p){return 'no login form'}set(e,__KF_EMAIL__);set(p,__KF_PASSWORD__);var f=e.form;if(!f){return 'no form'}setTimeout(function(){if(f.requestSubmit){f.requestSubmit()}else{f.submit()}},100);return 'submitted'})()"""

# THE READINGS every shot returns (after `| R=`). A focused text field is the
# keyboard on a phone (the Ask set blurs the composer in its own step, a
# second and a half before its shot, so the keyboard is down). A dialog counts
# when it is not inside an aria-hidden wrapper (Sheet keeps closed sheets
# mounted, hidden) and has a box on screen; it is named `camera` or `consent`
# by its marker. Platform words are read from the page text (Latin; the
# store's rule), e-mail text before the app's probe masks it.
READ = r"""function(){var t=document.body.innerText||'';var vis=function(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&getComputedStyle(e).visibility!=='hidden'};var dl=Array.prototype.slice.call(document.querySelectorAll('[role=dialog],[role=alertdialog],dialog')).filter(function(d){if(d.closest('[aria-hidden=true]'))return false;if(d.tagName==='DIALOG'&&!d.open)return false;return vis(d)}).map(function(d){return d.querySelector('[data-kf-camera-sheet]')?'camera':d.querySelector('[data-kf-consent-sheet]')?'consent':d.querySelector('[data-kf-upload-sheet]')?'upload-choice':(d.getAttribute('aria-label')||d.tagName.toLowerCase())});var a=document.activeElement;var kb=!!(a&&(a.tagName==='TEXTAREA'||a.isContentEditable||(a.tagName==='INPUT'&&!/^(button|checkbox|radio|submit|reset|file|hidden|range|color)$/i.test(a.type||''))));var al=Array.prototype.slice.call(document.querySelectorAll('[role=alert]')).filter(function(e){return vis(e)&&(e.textContent||'').trim()}).length;var pw={};(t.match(/\b(apple|iphone|ipad|ios|google|android|play store|app store)\b/gi)||[]).forEach(function(w){pw[w.toLowerCase()]=1});return {theme:document.documentElement.getAttribute('data-theme'),path:location.pathname,iap:document.querySelectorAll('[data-kf-iap]').length,platform:Object.keys(pw),mail:/\S+@\S+\.\S+/.test(t),dialogs:dl,keyboard:kb,alerts:al}}"""


def other_names(locale):
    other = PLAN['en' if locale == 'ar' else 'ar']
    names = [s['name'] for s in other['subjects']]
    for s in other['subjects']:
        names += [f[:-3] if f.endswith('.md') else f for f in s['files']]
    return names


def shot(js, locale):
    """A shot step's script: `js` (what the shot does, returning a string),
    then the readings, with the names of the other language's account found
    in the page."""
    names = json.dumps(other_names(locale), ensure_ascii=False)
    return ("(function(){var r=" + js + ";var R=(" + READ + ")();var t=document.body.innerText||'';var n=" + names +
            ";R.other=n.filter(function(x){return t.indexOf(x)>=0});return r+' | R='+JSON.stringify(R)})()")


TOP = "(function(){window.scrollTo(0,0);return location.pathname})()"

# 02: the subject page at its top; its address is kept for the way back (06).
SUBJECT_TOP = "(function(){window.scrollTo(0,0);try{sessionStorage.setItem('kfShotSubject',location.pathname)}catch(e){}return location.pathname})()"

# 03, step 1: the upload tile at shell 2 (data-kf-upload=add) opens the
# two-tile sheet. Before it, every request the page makes from now on is
# counted when it goes to the page reader or to storage, and the camera
# input's click() is replaced on the element itself, so the sheet's camera
# tile opens the sheet but never the system picker.
CAMERA_OPEN = r"""(function(){window.scrollTo(0,0);var K=window.__kfCam={sent:0,picker:0,urls:[]};if(!window.__kfCamFetch){window.__kfCamFetch=1;var of=window.fetch;window.fetch=function(u){try{var s=typeof u==='string'?u:(u&&u.url)||'';if(/\/api\/page-read|\/storage\/v1\//.test(s)){window.__kfCam.sent++;window.__kfCam.urls.push(s.slice(0,80))}}catch(e){}return of.apply(this,arguments)}}var i=document.querySelector('[data-kf-camera-input]');if(!i){return 'no camera input (shell 2 only)'}i.click=function(){window.__kfCam.picker++};var b=document.querySelector('[data-kf-upload=add]');if(!b){return 'no upload tile'}b.click();return 'opened the upload sheet'})()"""

# 03, step 2: the sheet's own camera tile (data-kf-upload=sheet-camera).
CAMERA_SHEET = r"""(function(){var b=document.querySelector('[data-kf-upload=sheet-camera]');if(!b){return 'no camera tile in the upload sheet'}b.click();var s=document.querySelector('[data-kf-camera-sheet=open]');return 'tapped the camera tile; picker calls blocked '+(window.__kfCam?window.__kfCam.picker:'?')})()"""

# 04: the stored summary (SummarySection's data-kf-summary well) with its
# heading just below any fixed bar (the top fade over the status bar).
SUMMARY = r"""(function(){var w=document.querySelector('[data-kf-summary]');if(!w){return 'no summary on screen'}var h=w.querySelector('h3,h2,h4')||w;var bar=0;Array.prototype.slice.call(document.querySelectorAll('header,nav,div')).forEach(function(x){var s=getComputedStyle(x).position;if(s!=='sticky'&&s!=='fixed'){return}var r=x.getBoundingClientRect();if(r.height>0&&r.top<=1&&r.bottom<window.innerHeight/2&&r.width>=window.innerWidth*0.9){bar=Math.max(bar,r.bottom)}});w.scrollIntoView({block:'start'});window.scrollBy(0,w.getBoundingClientRect().top-bar-16);return 'summary in view; heading top '+Math.round(h.getBoundingClientRect().top)+', bar bottom '+Math.round(bar)})()"""

# 05: the chat scrolls to its newest line by itself (ChatBox), so the list is
# scrolled for the last question bubble to sit 16 px below its top (or as
# near as the list scrolls). The reading says where the question, the first
# source and the whole sources row end inside the list, and where the
# microphone is (Step Store-Fix-1; the mic is new in 1.1).
ASK_TOP = r"""(function(){var u=document.querySelectorAll('.kf-bubble-user');var q=u[u.length-1];if(!q){return 'no question bubble'}var sc=q.parentElement;while(sc&&!/(auto|scroll)/.test(getComputedStyle(sc).overflowY)){sc=sc.parentElement}if(!sc){return 'no scroll list'}sc.scrollTop=sc.scrollTop+q.getBoundingClientRect().top-sc.getBoundingClientRect().top-16;var L=sc.getBoundingClientRect(),Q=q.getBoundingClientRect();var lab=Array.prototype.slice.call(document.querySelectorAll('p')).filter(function(p){return /^(المصادر|Sources)$/.test((p.textContent||'').trim())}).pop();var row=lab?lab.nextElementSibling:null;var one=row&&row.firstElementChild?row.firstElementChild.getBoundingClientRect():null;var all=row?row.getBoundingClientRect():null;var t=document.body.innerText||'';var m=document.querySelector('[data-kf-voice=mic]');var c=document.querySelector('[data-kf-composer]');var mr=m?m.getBoundingClientRect():null;var mic=!m?'none':((c&&c.contains(m)?'in the composer':'outside the composer')+', '+(mr.width>0&&mr.top>=0&&mr.bottom<=innerHeight?'in view':'out of view'));return 'answer shown; sources: '+(/(^|\n)(المصادر|Sources)(\n|$)/.test(t)?'yes':'no')+'; question top '+Math.round(Q.top-L.top)+' of list '+Math.round(L.height)+'; first source bottom '+(one?Math.round(one.bottom-L.top):'none')+'; all sources bottom '+(all?Math.round(all.bottom-L.top):'none')+'; list at end '+(sc.scrollTop+sc.clientHeight>=sc.scrollHeight-1?'yes':'no')+'; mic '+mic})()"""

# 06: the quiz from question 1, nothing picked, not graded.
QUIZ = r"""(function(){var w=document.querySelector('[data-kf-quiz]');if(!w){return 'no quiz on screen'}var q1=Array.prototype.slice.call(w.querySelectorAll('[data-kf-question] [data-kf-generated]')).filter(function(x){return /^1\.\s/.test((x.textContent||'').trim())})[0];if(!q1){return 'no first question'}var card=q1.closest('[data-kf-question]')||q1;var bar=0;Array.prototype.slice.call(document.querySelectorAll('header,nav,div')).forEach(function(x){var s=getComputedStyle(x).position;if(s!=='sticky'&&s!=='fixed'){return}var r=x.getBoundingClientRect();if(r.height>0&&r.top<=1&&r.bottom<window.innerHeight/2&&r.width>=window.innerWidth*0.9){bar=Math.max(bar,r.bottom)}});var head=w.querySelector('h3')||card;head.scrollIntoView({block:'start'});window.scrollBy(0,head.getBoundingClientRect().top-bar-16);var picked=w.querySelectorAll('[data-kf-choice]:not([data-kf-choice=idle]),input[type=radio]:checked').length;var K=window.__kfQuiz||{};return 'quiz in view from question 1; phase '+w.getAttribute('data-kf-quiz')+'; question 1 top '+Math.round(card.getBoundingClientRect().top)+', bar bottom '+Math.round(bar)+'; picked '+picked+'; route '+(K.status||'none')+' cached '+(K.cached===true?'yes':'no')})()"""


def b64(path):
    return base64.b64encode(open(path, 'rb').read()).decode('ascii')


def camera_inject(locale):
    """03, step 3: the three page JPEGs as Files in the sheet's input."""
    pages = [b64(os.path.join(CONTENT, 'pages', locale, f'page-{n}.jpg')) for n in (1, 2, 3)]
    return ("(function(){var i=document.querySelector('[data-kf-camera-input]');if(!i){return 'no camera input'}"
            "if(!document.querySelector('[data-kf-camera-sheet=open]')){return 'the camera sheet is not open'}"
            "var P=" + json.dumps(pages) + ";var dt=new DataTransfer();"
            "P.forEach(function(s,k){var b=atob(s),u=new Uint8Array(b.length);for(var j=0;j<b.length;j++){u[j]=b.charCodeAt(j)}"
            "dt.items.add(new File([u],'page-'+(k+1)+'.jpg',{type:'image/jpeg',lastModified:Date.now()}))});"
            "i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));return 'put '+dt.files.length+' pages in the camera input'})()")


# 03, the shot: the sheet's own markers (pages, the numbers drawn on the
# thumbnails, the read button), and nothing sent.
CAMERA_SHOT = r"""(function(){var s=document.querySelector('[data-kf-camera-sheet=open]');if(!s){return 'no camera sheet'}var n=s.getAttribute('data-kf-camera-pages');var nums=Array.prototype.slice.call(s.querySelectorAll('[data-kf-camera-page]')).map(function(li){var b=li.querySelector('span');return (b&&b.textContent||'').trim()});var rd=s.querySelector('[data-kf-camera=read]');var msg=s.querySelector('[data-kf-camera-message]');var K=window.__kfCam||{};return 'camera sheet; pages '+n+'; numbers '+nums.join(',')+'; read button '+(rd?(rd.disabled?'disabled':'enabled'):'none')+'; message '+(msg?msg.getAttribute('data-kf-camera-message'):'none')+'; picker calls blocked '+(K.picker===undefined?'?':K.picker)+'; sent '+(K.sent===undefined?'?':K.sent)})()"""

CAMERA_CLOSE = r"""(function(){var b=document.querySelector('[data-kf-camera=close]');if(!b){return 'no close button'}b.click();return 'closed the camera sheet; sent '+(window.__kfCam?window.__kfCam.sent:'?')})()"""


def nav_subject(subject):
    return ("(function(){var n=" + json.dumps(subject, ensure_ascii=False) + ";var a=Array.prototype.slice.call(document.querySelectorAll('a[href*=\"/dashboard/knowledge/\"]')).filter(function(a){var c=a.closest('article,li')||a;return !/\\/new$/.test(a.getAttribute('href')||'')&&(c.textContent||'').indexOf(n)>=0})[0];if(!a){return 'no subject '+n}a.click();return 'opened '+n})()")


def quiz_open(stem):
    """The quiz button of the plan's file's own card (never the first on the
    page: run 38464393735 pressed another card's and generated a new quiz).
    The route's answer is kept: `cached: true` means no AI call."""
    return ("(function(){var n=" + json.dumps(stem, ensure_ascii=False) + ";var clean=function(s){return (s||'').replace(/[\\u200e\\u200f\\u2066-\\u2069\\u202a-\\u202e]/g,'')};"
            "var c=Array.prototype.slice.call(document.querySelectorAll('article[data-kf-material]')).filter(function(a){return clean(a.textContent).indexOf(n)>=0&&a.querySelector('[data-kf-study=quiz] button')})[0];if(!c){return 'no card '+n+' with a quiz button'}"
            "var b=c.querySelector('[data-kf-study=quiz] button');"
            "if(!window.__kfQuizFetch){window.__kfQuizFetch=1;var of=window.fetch;window.fetch=function(u){var s=typeof u==='string'?u:(u&&u.url)||'';var p=of.apply(this,arguments);if(s.indexOf('/api/quiz/generate')>=0){window.__kfQuiz={status:'pending'};p.then(function(r){window.__kfQuiz={status:r.status};return r.clone().json().then(function(j){window.__kfQuiz.cached=j&&j.cached===true})}).catch(function(){})}return p}}"
            "c.scrollIntoView({block:'center'});b.click();return 'clicked quiz on '+n})()")


def ask_send(question):
    """The send button: the composer row's button that is not the microphone
    (#340 put the mic first in the row; the 1.0.1 step's first button would
    now press it and raise two system alerts)."""
    return ("(function(){var t=document.querySelector('[data-kf-composer] textarea');if(!t){return 'no composer'}var s=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;s.call(t," +
            json.dumps(question, ensure_ascii=False) + ");t.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(function(){var b=document.querySelector('[data-kf-composer] .kf-composer > button:not([data-kf-voice])');if(b){b.click()}},300);return document.querySelector('[data-kf-composer] .kf-composer > button:not([data-kf-voice])')?'sent':'no send button'})()")


def stem(f):
    return f[:-3] if f.endswith('.md') else f


def steps(locale, bind=None):
    p = PLAN[locale]
    bind = bind or {}
    subject = bind.get('subject', p['summary']['subject'])
    qstem = bind.get('quiz', stem(p['quiz']['file']))
    L = locale
    S = lambda n: f'shot-{L}-{n}'
    subj_re = f"/{L}/dashboard/knowledge/[0-9a-f-]{{36}}$"
    return [
        {"name": "to-login", "until": TO_LOGIN_UNTIL, "wait": 1500, "js": TO_LOGIN},
        {"name": "login", "until": "/(en|ar)/dashboard$", "timeout": 60000, "wait": 3000, "js": LOGIN},
        {"name": f"nav-{L}-subjects", "until": f"/{L}/dashboard/knowledge$", "wait": 4000, "js": "(function(){location.assign('/" + L + "/dashboard/knowledge');return 'assigned'})()"},
        {"name": S('01-subjects'), "wait": 1500, "js": shot(TOP, L)},
        {"name": f"nav-{L}-subject", "until": subj_re, "wait": 10000, "js": nav_subject(subject)},
        {"name": S('02-material'), "wait": 1500, "js": shot(SUBJECT_TOP, L)},
        {"name": f"camera-{L}-open", "wait": 1500, "js": CAMERA_OPEN},
        {"name": f"camera-{L}-sheet", "wait": 1500, "js": CAMERA_SHEET},
        {"name": f"camera-{L}-pages", "wait": 6000, "js": camera_inject(L)},
        {"name": S('03-camera'), "wait": 1500, "js": shot(CAMERA_SHOT, L)},
        {"name": f"camera-{L}-close", "wait": 1500, "js": CAMERA_CLOSE},
        {"name": S('04-summary'), "wait": 1500, "js": shot(SUMMARY, L)},
        {"name": f"nav-{L}-ask", "until": f"/{L}/dashboard/agent[?]kb=", "wait": 9000, "js": "(function(){var a=document.querySelector('a[href*=\"/dashboard/agent?kb=\"]');if(!a){return 'no ask link'}a.click();return 'opened Ask on the subject'})()"},
        {"name": f"ask-{L}-send", "wait": 35000, "js": ask_send(p['ask']['question'])},
        {"name": f"ask-{L}-blur", "wait": 1500, "js": "(function(){var a=document.activeElement;if(a&&a!==document.body&&a.blur){a.blur();return 'blurred '+a.tagName.toLowerCase()}return 'nothing focused'})()"},
        {"name": S('05-ask'), "wait": 1500, "js": shot(ASK_TOP, L)},
        {"name": f"nav-{L}-back", "until": subj_re, "wait": 8000, "js": "(function(){var s=null;try{s=sessionStorage.getItem('kfShotSubject')}catch(e){}if(!s){return 'no subject address kept'}location.assign(s);return 'back to '+s})()"},
        {"name": f"quiz-{L}-open", "wait": 12000, "js": quiz_open(qstem)},
        {"name": S('06-quiz'), "wait": 1500, "js": shot(QUIZ, L)},
        # Settings is passed through for its sign-out row only: no shot.
        {"name": f"nav-{L}-settings", "until": f"/{L}/dashboard/settings$", "wait": 8000, "js": "(function(){var a=document.querySelector('a[href$=\"/dashboard/settings\"]');if(!a){return 'no Settings'}a.click();return 'clicked Settings'})()"},
        {"name": f"signout-{L}", "until": "/(en|ar)/login$", "wait": 3000, "js": "(function(){var b=document.querySelector('[data-kf-signout=row]');if(!b){return 'no sign-out row'}b.click();return 'signed out'})()"},
    ]


FRAGMENTS = {'READ': READ, 'ASK_TOP': ASK_TOP, 'SUMMARY': SUMMARY, 'QUIZ': QUIZ, 'CAMERA_OPEN': CAMERA_OPEN,
             'CAMERA_SHEET': CAMERA_SHEET, 'CAMERA_SHOT': CAMERA_SHOT, 'CAMERA_CLOSE': CAMERA_CLOSE}

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    a = sys.argv[1:]
    if a[:1] == ['--other'] and len(a) > 1 and a[1] in ('ar', 'en'):
        print(json.dumps(other_names(a[1]), ensure_ascii=False))
        sys.exit(0)
    if a[:1] == ['--js'] and len(a) > 1 and a[1] in FRAGMENTS:
        print(FRAGMENTS[a[1]])
        sys.exit(0)
    if not a or a[0] not in ('ar', 'en'):
        sys.exit('usage: capture_steps.py ar|en [--bind JSON] | --js NAME')
    bind = json.loads(a[a.index('--bind') + 1]) if '--bind' in a else None
    out = json.dumps(steps(a[0], bind), ensure_ascii=False)
    if len(out.encode('utf-8')) > STEPS_BUDGET:
        sys.exit(f'FAIL the {a[0]} steps are {len(out.encode())} bytes, over the budget of {STEPS_BUDGET}')
    print(out)
