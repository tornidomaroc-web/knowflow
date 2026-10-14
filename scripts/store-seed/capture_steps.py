"""Step Store-Shots-1: the in-app steps of the App Store capture, for ONE
screenshot account, written as the JSON the iOS shell's smoke harness runs
(MainViewController.swift, KF_SMOKE_STEPS). Generated from
docs/store/screenshot-content/plan.json so the steps, the subject they open
and the language check all come from one place.

Each shot-<locale>-NN-<name> step leaves the screen as the store shot shows it
and returns a reading the workflow asserts: that no subject or file name of
the OTHER language's account is anywhere in the page, and per screen what it
must show (the sources under the Arabic answer, the reminder on at 19:00 in
Settings, no e-mail text left). The Arabic Ask shot asks its question live:
the messages table stores no citations, so a conversation reopened from
history would show its answer without sources (one Ask call per capture).
The English quiz opens the quiz the seeding made (a stored quiz costs no
call). The set ends signed out, so the next account starts at the login page.

Every step that opens a page names `until`, the pattern its URL must match:
the harness waits for the URL to leave the page the step started on and match
it before the step's `wait` runs, and check_capture.py fails the capture when
it did not (scripts/ios/page_steps.py), so a slow load is never photographed
as the page before it.

Usage: python3 scripts/store-seed/capture_steps.py ar|en > steps.json
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PLAN = json.load(open(os.path.join(ROOT, 'docs', 'store', 'screenshot-content', 'plan.json'), encoding='utf-8'))

# The login step, as in every signed-in run: __KF_EMAIL__ and __KF_PASSWORD__
# are bare tokens the app replaces from its launch environment.
LOGIN = r"""(function(){var set=function(el,v){var s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};var e=document.querySelector('input[name=email]'),p=document.querySelector('input[name=password]');if(!e||!p){return 'no login form'}set(e,__KF_EMAIL__);set(p,__KF_PASSWORD__);var f=e.form;if(!f){return 'no form'}setTimeout(function(){if(f.requestSubmit){f.requestSubmit()}else{f.submit()}},100);return 'submitted'})()"""

SUMMARY = r"""(function(){var h=Array.prototype.slice.call(document.querySelectorAll('h1,h2,h3,h4,p,span,div')).filter(function(x){return x.children.length===0&&/^(SUMMARY|Summary|الملخّص|الملخص|ملخص)$/.test((x.innerText||'').trim())})[0];if(!h){return 'no summary heading'}var c=h.closest('.rounded-xl')||h;var bar=0;Array.prototype.slice.call(document.querySelectorAll('header,nav,div')).forEach(function(x){var s=getComputedStyle(x).position;if(s!=='sticky'&&s!=='fixed'){return}var r=x.getBoundingClientRect();if(r.top<=1&&r.bottom<window.innerHeight/2&&r.width>=window.innerWidth*0.9){bar=Math.max(bar,r.bottom)}});c.scrollIntoView({block:'start'});window.scrollBy(0,c.getBoundingClientRect().top-bar-16);return 'summary in view; heading top '+Math.round(h.getBoundingClientRect().top)+', bar bottom '+Math.round(bar)})()"""

QUIZ = r"""(function(){var b=Array.prototype.slice.call(document.querySelectorAll('button')).filter(function(x){return /Check my answers|صحّح إجاباتي/.test(x.innerText||'')})[0];if(!b){return 'no quiz on screen'}var q1=Array.prototype.slice.call(document.querySelectorAll('p,h3,h4,div,span,legend')).filter(function(x){return x.children.length<=1&&/^1\.\s/.test((x.innerText||'').trim())})[0];if(!q1){return 'no first question'}q1.scrollIntoView({block:'start'});window.scrollBy(0,-120);return 'quiz in view from question 1'})()"""

# Step Store-Fix-1: the Ask shot starts at the student's question. The chat
# scrolls to its newest line by itself (ChatBox), so ar/04 of capture
# 38579234295 opened in the middle of the answer, its heading cut at the top.
# The messages list is scrolled so the last question bubble sits 16 px below
# its top; the reading says where the question, the first source and the
# whole sources row end inside the list, and check_capture.py holds them.
# The render script (scripts/redesign-built/render-fix.mjs) runs this same
# string, read with `capture_steps.py --js ASK_TOP`.
ASK_TOP = r"""(function(){var u=document.querySelectorAll('.kf-bubble-user');var q=u[u.length-1];if(!q){return 'no question bubble'}var sc=q.parentElement;while(sc&&!/(auto|scroll)/.test(getComputedStyle(sc).overflowY)){sc=sc.parentElement}if(!sc){return 'no scroll list'}sc.scrollTop=sc.scrollTop+q.getBoundingClientRect().top-sc.getBoundingClientRect().top-16;var L=sc.getBoundingClientRect(),Q=q.getBoundingClientRect();var lab=Array.prototype.slice.call(document.querySelectorAll('p')).filter(function(p){return /^(المصادر|Sources)$/.test((p.textContent||'').trim())}).pop();var row=lab?lab.nextElementSibling:null;var one=row&&row.firstElementChild?row.firstElementChild.getBoundingClientRect():null;var all=row?row.getBoundingClientRect():null;var t=document.body.innerText||'';return 'answer shown; sources: '+(/(^|\n)(المصادر|Sources)(\n|$)/.test(t)?'yes':'no')+'; question top '+Math.round(Q.top-L.top)+' of list '+Math.round(L.height)+'; first source bottom '+(one?Math.round(one.bottom-L.top):'none')+'; all sources bottom '+(all?Math.round(all.bottom-L.top):'none')})()"""

SETTINGS = r"""(function(){var h=Array.prototype.slice.call(document.querySelectorAll('h2')).filter(function(x){return /preferences|التفضيلات/i.test(x.innerText||'')})[0];if(!h){return 'no preferences card'}var c=h.closest('.rounded-xl')||h;var bar=0;Array.prototype.slice.call(document.querySelectorAll('header,nav,div')).forEach(function(x){var st=getComputedStyle(x).position;if(st!=='sticky'&&st!=='fixed'){return}var r=x.getBoundingClientRect();if(r.top<=1&&r.bottom<window.innerHeight/2&&r.width>=window.innerWidth*0.9){bar=Math.max(bar,r.bottom)}});c.scrollIntoView({block:'start'});window.scrollBy(0,-bar-16);var mail=/\S+@\S+\.\S+/.test(document.body.innerText||'');var r=document.querySelector('[data-kf-reminder-state]');return 'preferences in view; e-mail text left in page: '+mail+'; reminder '+(r?r.getAttribute('data-kf-reminder-state')+' '+r.getAttribute('data-kf-reminder-time'):'no card')})()"""


def stem(f):
    return f[:-3] if f.endswith('.md') else f


def other_names(locale):
    other = PLAN['en' if locale == 'ar' else 'ar']
    names = [s['name'] for s in other['subjects']]
    for s in other['subjects']:
        names += [f[:-3] if f.endswith('.md') else f for f in s['files']]
    return names


def with_purity(js, locale):
    """Wrap a step so its reading also says whether any of the other account's
    subject or file names is anywhere in the page text."""
    names = json.dumps(other_names(locale), ensure_ascii=False)
    return ("(function(){var r=" + js + ";var t=document.body.innerText||'';var n=" + names +
            ";var h=n.filter(function(x){return t.indexOf(x)>=0});return r+' | other language: '+(h.length?h.join(','):'none')})()")


def steps(locale):
    p = PLAN[locale]
    subject = p['summary']['subject']
    L = locale
    out = [
        {"name": "login", "until": "/(en|ar)/dashboard$", "timeout": 60000, "wait": 3000, "js": LOGIN},
        {"name": f"nav-{L}-subjects", "until": f"/{L}/dashboard/knowledge$", "wait": 4000, "js": "(function(){location.assign('/" + L + "/dashboard/knowledge');return 'assigned'})()"},
        {"name": f"shot-{L}-01-subjects", "wait": 1500, "js": with_purity("(function(){window.scrollTo(0,0);return location.pathname})()", L)},
        {"name": f"nav-{L}-subject", "until": f"/{L}/dashboard/knowledge/[0-9a-f-]{{36}}$", "wait": 10000, "js": "(function(){var n=" + json.dumps(subject, ensure_ascii=False) + ";var a=Array.prototype.slice.call(document.querySelectorAll('a[href*=\"/dashboard/knowledge/\"]')).filter(function(a){var c=a.closest('article,li')||a;return !/\\/new$/.test(a.getAttribute('href')||'')&&(c.textContent||'').indexOf(n)>=0})[0];if(!a){return 'no subject '+n}a.click();return 'opened '+n})()"},
        {"name": f"shot-{L}-02-material", "wait": 1500, "js": with_purity("(function(){window.scrollTo(0,0);return location.pathname})()", L)},
        {"name": f"shot-{L}-03-summary", "wait": 1500, "js": with_purity(SUMMARY, L)},
    ]
    if L == 'ar':
        q = json.dumps(p['ask']['question'], ensure_ascii=False)
        out += [
            {"name": "nav-ar-ask", "until": "/ar/dashboard/agent[?]kb=", "wait": 9000, "js": "(function(){var a=document.querySelector('a[href*=\"/dashboard/agent?kb=\"]');if(!a){return 'no ask link'}a.click();return 'opened Ask on the subject'})()"},
            {"name": "ask-send", "wait": 35000, "js": "(function(){var t=document.querySelector('[data-kf-composer] textarea');if(!t){return 'no composer'}var s=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;s.call(t," + q + ");t.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(function(){var b=document.querySelector('[data-kf-composer] button');if(b){b.click()}},300);return 'sent'})()"},
            {"name": "shot-ar-04-ask", "wait": 1500, "js": with_purity(ASK_TOP, L)},
        ]
    else:
        out += [
            # The button inside the card of the seeded file, whose quiz is
            # stored (no call); never the first one on the page (run
            # 38464393735 pressed another card's and generated a new quiz).
            {"name": "quiz-open", "wait": 12000, "js": "(function(){var n=" + json.dumps(stem(p['quiz']['file']), ensure_ascii=False) + ";var c=Array.prototype.slice.call(document.querySelectorAll('article')).filter(function(a){return (a.textContent||'').indexOf(n)>=0})[0];if(!c){return 'no card '+n}var b=Array.prototype.slice.call(c.querySelectorAll('button')).filter(function(x){return /Quiz me on this material/.test(x.innerText||'')})[0];if(!b){return 'no quiz button on '+n}b.click();return 'clicked quiz on '+n})()"},
            {"name": "shot-en-04-quiz", "wait": 1500, "js": with_purity(QUIZ, L)},
        ]
    out += [
        {"name": f"nav-{L}-settings", "until": f"/{L}/dashboard/settings$", "wait": 8000, "js": "(function(){var a=document.querySelector('a[href$=\"/dashboard/settings\"]');if(!a){return 'no Settings'}a.click();return 'clicked Settings'})()"},
        {"name": f"reminder-{L}-on", "wait": 3000, "js": "(function(){var c=document.querySelector('[data-kf-reminder-state]');if(!c){return 'no reminder card'}if(c.getAttribute('data-kf-reminder-state')==='on'){return 'already on'}var b=c.querySelector('[data-kf-reminder=toggle]');if(!b){return 'no toggle'}b.click();return 'clicked on'})()"},
        {"name": f"shot-{L}-05-settings", "wait": 1500, "js": with_purity(SETTINGS, L)},
        {"name": f"signout-{L}", "until": "/(en|ar)/login$", "wait": 3000, "js": "(function(){var b=document.querySelector('[data-kf-signout=row]');if(!b){return 'no sign-out row'}b.click();return 'signed out'})()"},
    ]
    return out


if __name__ == '__main__':
    loc = sys.argv[1] if len(sys.argv) > 1 else ''
    if loc == '--js' and len(sys.argv) > 2 and sys.argv[2] in ('ASK_TOP', 'SUMMARY'):
        sys.stdout.reconfigure(encoding='utf-8')
        print(globals()[sys.argv[2]])
        sys.exit(0)
    if loc not in ('ar', 'en'):
        sys.exit('usage: capture_steps.py ar|en')
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(steps(loc), ensure_ascii=False))
