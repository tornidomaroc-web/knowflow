"""
IN-APP RATING (iOS 1.1, big item 4h, PR 2): the assertions ios-smoke.yml
(proof 14) and ios-signed-in.yml (two readings) make about the KnowFlowReview
plugin, in one place, so a forced case can prove each of them fails.

THE TRAP THEY GUARD. Both CI simulator builds are Debug, and in a development
build StoreKit shows the review sheet on EVERY request. A CI run that called
`request` would put a sheet no one can answer over the next screens. So CI
calls `available` only, and both workflows count the plugin's one log line,
"[KFReview] request" (ios/App/App/KnowFlowReview.swift), and fail on any.

  smoke_checks(by, logs, built)   proof 14: the plugin answers
      {available: true, version} and nothing else, the version is the built
      CFBundleShortVersionString, the app stays active (appState 0) around
      the call, and the request line appears 0 times in every launch's log.
  signed_in_checks(by, log)       Settings at shell 2 shows exactly one rate
      row, the write-review link with no target; the device record's first
      day is today, so the review gate reads too-new; the request line
      appears 0 times in the run's log.

Each returns [(ok, message, id)]. `--self-test` builds good readings (all
pass) and plants one wrong reading per case; each must fail its own check.

Usage: python3 scripts/ios/review_proof.py --self-test
"""
import datetime
import json
import sys

REQUEST_LINE = "[KFReview] request"
WRITE_REVIEW_URL = "https://apps.apple.com/app/id6820418649?action=write-review"
MIN_DAYS = 3  # src/lib/review/rules.ts THRESHOLDS.minDays: too-new below it


def _json(s):
    try:
        return json.loads(s)
    except Exception:
        return None


def request_count(logs):
    return sum(str(t).count(REQUEST_LINE) for t in logs)


def smoke_checks(by, logs, built):
    out = []
    launch = by.get("launch", {}).get("probe", {})
    out.append((launch.get("review") is True, f"14. the KnowFlowReview plugin is registered in the shell: review={launch.get('review')}", "registered"))
    poll = by.get("review-read", {}).get("poll") or {}
    out.append((poll.get("settled") is True, f"14. available() answers within 20 s of the call: settled={poll.get('settled')} after {poll.get('ms')} ms", "settled"))
    raw = str(by.get("review-read", {}).get("result", ""))
    ra = _json(raw)
    keys = sorted(k for k in ra if k != "ms") if isinstance(ra, dict) else None
    out.append((isinstance(ra, dict) and ra.get("available") is True and keys == ["available", "version"], f"14. ...with {{available: true, version}} and nothing else (ms is the page's own timing): {raw[:160]}", "shape"))
    version = ra.get("version") if isinstance(ra, dict) else None
    out.append((isinstance(built, str) and built != "" and version == built, f"14. the version it answers is the built CFBundleShortVersionString: {version!r} vs {built!r}", "version"))
    states = {n: by.get(n, {}).get("appState") for n in ("apple-read", "review-call", "review-read")}
    out.append((all(v == 0 for v in states.values()), f"14. the app stays active around the call, no sheet over it (appState 0): {states}", "active"))
    logged = [t for t in logs if "[KFSmoke]" in str(t)]
    out.append((len(logs) >= 1 and len(logged) == len(logs), f"14. every launch's log was captured ({len(logged)} of {len(logs)} carry [KFSmoke] lines), so the count below is not vacuous", "logs"))
    n = request_count(logs)
    out.append((n == 0, f"14. \"{REQUEST_LINE}\" appears 0 times in the whole smoke log (CI is Debug: a request would show the sheet): {n}", "no-request"))
    return out


def signed_in_checks(by, log):
    out = []
    rr = by.get("rate-row", {})
    rate = _json(str(rr.get("result", "")))
    rate = rate if isinstance(rate, dict) else {}
    out.append(((rr.get("poll") or {}).get("settled") is True and rr.get("probe", {}).get("review") is True, f"Settings at shell 2 draws the rate row once the KnowFlowReview plugin answers: poll={rr.get('poll')} review={rr.get('probe', {}).get('review')}", "rate-shown"))
    out.append((rate.get("n") == 1, f"...exactly one App Store link in Settings: {rate.get('n')}", "rate-one"))
    out.append((rate.get("href") == WRITE_REVIEW_URL, f"...and it is the write-review link: {rate.get('href')}", "rate-href"))
    out.append((rate.get("target") is None, f"...with no target (Capacitor hands the navigation to iOS): target={rate.get('target')!r}", "rate-target"))
    gate = _json(str(by.get("review-gate", {}).get("result", "")))
    gate = gate if isinstance(gate, dict) else {}
    rec = gate.get("record") if isinstance(gate.get("record"), dict) else {}
    today, first = gate.get("today"), rec.get("first")
    try:
        days = (datetime.date.fromisoformat(today) - datetime.date.fromisoformat(first)).days
    except Exception:
        days = None
    reason = "too-new" if days is not None and 0 <= days < MIN_DAYS else f"not too-new (days={days})"
    out.append((bool(first) and first == today, f"the device record (localStorage kf-review) was started today, by the dashboard's first mount: first={first} today={today}", "first-today"))
    out.append((reason == "too-new" and rec.get("askedVersion") is None and rec.get("askedAt") is None, f"...so the review gate reads too-new and nothing was ever asked: {reason}, askedVersion={rec.get('askedVersion')} askedAt={rec.get('askedAt')}", "too-new"))
    out.append(("[KFSmoke]" in str(log), "the run's app log was captured ([KFSmoke] lines), so the count below is not vacuous", "log"))
    n = request_count([log])
    out.append((n == 0, f"\"{REQUEST_LINE}\" appears 0 times in the run's log: {n}", "no-request"))
    return out


def _self_test():
    import copy
    built = "1.1"
    smoke = {
        "launch": {"probe": {"review": True}},
        "apple-read": {"appState": 0},
        "review-call": {"appState": 0, "result": "called available"},
        "review-read": {"appState": 0, "poll": {"settled": True, "ms": 12}, "result": json.dumps({"available": True, "version": built, "ms": 3})},
    }
    logs = ["[KFSmoke] capacitorDidLoad", "[KFSmoke] done", "[KFSmoke] step a", "[KFSmoke] launch"]
    today = "2026-11-21"
    si = {
        "rate-row": {"poll": {"settled": True, "ms": 400}, "probe": {"review": True}, "result": json.dumps({"n": 1, "href": WRITE_REVIEW_URL, "target": None})},
        "review-gate": {"result": json.dumps({"today": today, "record": {"v": 1, "first": today, "wins": 0, "askedVersion": None, "askedAt": None, "setback": None, "lastWin": None}})},
    }
    log = "[KFSmoke] step settings\n[KFSmoke] done\n"
    fails = []
    for ok, msg, _ in smoke_checks(smoke, logs, built) + signed_in_checks(si, log):
        if not ok:
            fails.append("good reading failed: " + msg)

    def s_set(path, value):
        d = copy.deepcopy(smoke)
        a, b = path
        d[a][b] = value
        return d

    def rr(**kw):
        d = copy.deepcopy(si)
        r = json.loads(d["rate-row"]["result"])
        r.update(kw)
        d["rate-row"]["result"] = json.dumps(r)
        return d

    def rec(**kw):
        d = copy.deepcopy(si)
        g = json.loads(d["review-gate"]["result"])
        if kw.get("drop"):
            g.pop("record")
        else:
            g["record"].update(kw)
        d["review-gate"]["result"] = json.dumps(g)
        return d

    S = lambda by=smoke, lg=logs, b=built: smoke_checks(by, lg, b)
    I = lambda by=si, lg=log: signed_in_checks(by, lg)
    cases = [
        ("plugin not registered", S(s_set(("launch", "probe"), {"review": False})), "registered"),
        ("available never answered", S(s_set(("review-read", "poll"), {"settled": False, "ms": 20000})), "settled"),
        ("available: false", S(s_set(("review-read", "result"), json.dumps({"available": False, "version": built}))), "shape"),
        ("an extra key", S(s_set(("review-read", "result"), json.dumps({"available": True, "version": built, "shown": True}))), "shape"),
        ("a rejected call", S(s_set(("review-read", "result"), "rejected after 3 ms: not implemented")), "shape"),
        ("version not the built one", S(s_set(("review-read", "result"), json.dumps({"available": True, "version": "1.0"}))), "version"),
        ("no built version read", S(b=""), "version"),
        ("a sheet over the app (appState 1)", S(s_set(("review-read", "appState"), 1)), "active"),
        ("background during the call (appState 2)", S(s_set(("review-call", "appState"), 2)), "active"),
        ("one launch's log empty", S(lg=logs + [""]), "logs"),
        ("a request line in a log", S(lg=logs[:-1] + ["[KFSmoke] launch\n2026 App [KFReview] request"]), "no-request"),
        ("Settings without the row", I(dict(si, **{"rate-row": {**si["rate-row"], "poll": {"settled": False, "ms": 20000}}})), "rate-shown"),
        ("plugin absent in Settings", I(dict(si, **{"rate-row": {**si["rate-row"], "probe": {"review": False}}})), "rate-shown"),
        ("two rate links", I(rr(n=2)), "rate-one"),
        ("no rate link", I(rr(n=0)), "rate-one"),
        ("the product page, not write-review", I(rr(href="https://apps.apple.com/app/id6820418649")), "rate-href"),
        ("target=_blank", I(rr(target="_blank")), "rate-target"),
        ("no device record", I(rec(drop=True)), "first-today"),
        ("record started yesterday", I(rec(first="2026-11-20")), "first-today"),
        ("record old enough to ask", I(rec(first="2026-11-01")), "too-new"),
        ("already asked this version", I(rec(askedVersion="1.1", askedAt="2026-11-21")), "too-new"),
        ("signed-in log empty", I(lg=""), "log"),
        ("a request line in the signed-in log", I(lg=log + "App: [KFReview] request\n"), "no-request"),
    ]
    for name, results, want in cases:
        hit = [ok for ok, _, i in results if i == want]
        if len(hit) != 1 or hit[0]:
            fails.append(f"forced case not caught: {name} (check {want})")
        else:
            print(f"caught  {name}  -> {want}")
    for f in fails:
        print("FAIL " + f)
    if fails:
        return 1
    print(f"self-test: {len(cases)} forced case(s), all caught; the good readings pass")
    return 0


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-test"]:
        sys.exit(_self_test())
    print(__doc__)
    sys.exit(2)
