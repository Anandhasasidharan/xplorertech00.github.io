#!/usr/bin/env python3
"""LIFE_OS local server — stdlib only, no dependencies.

Serves the app files + a tiny JSON API so your data lives in a real
file (state.json) instead of only inside the browser:

  GET  /api/state  -> current state (tasks, todos, fired, updatedAt)
  POST /api/state  -> replace state (body must contain a "tasks" list)
  POST /api/gcal-sync -> import Google Calendar ICS feed into tasks.
       body: {"icsUrl": "https://calendar.google.com/calendar/ical/.../basic.ics"}
       Get the URL from Google Calendar web: gear > Settings > your calendar >
       "Secret address in iCal format" (or public address). The URL never
       leaves your machine except to fetch Google's servers directly.

Imported events become local tasks (source:"gcal", gcalUid set) so re-sync
updates them instead of duplicating. Timed events also get remindTime, so
reminders.ps1 fires for them with the tab closed.
"""
import json
import os
import re
import time
import urllib.request
from datetime import datetime, timedelta
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(HERE, "state.json")
DIST_DIR = os.path.join(HERE, "dist")
# Serve the Vite build when present, else fall back to legacy root files.
STATIC_DIR = DIST_DIR if os.path.exists(os.path.join(DIST_DIR, "index.html")) else HERE
PORT = 8765

# UTC ("Z") event times are shifted by this to wall-clock time.
# 5.5 = IST (Asia/Kolkata). Change to your zone if needed.
GCAL_UTC_OFFSET_HOURS = 5.5
GCAL_MAX_EVENTS = 500


def read_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return f.read()
    return '{"tasks":[],"todos":[],"fired":{},"updatedAt":0}'


def write_state(obj):
    obj["updatedAt"] = int(time.time() * 1000)
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f)
    os.replace(tmp, STATE_FILE)


# ---------- Google Calendar ICS import ----------
def unfold_ics(text):
    # RFC 5545: lines starting with space/tab continue the previous line
    out = []
    for line in text.splitlines():
        if line[:1] in (" ", "\t") and out:
            out[-1] += line[1:]
        else:
            out.append(line)
    return out


def parse_ics_datetime(value):
    """'20260925' -> ('2026-09-25', None); '20260925T093000Z' -> ('2026-09-25', 'HH:MM')."""
    m = re.match(r"(\d{8})(?:T(\d{2})(\d{2})\d{0,2}(Z)?)?", value or "")
    if not m:
        return None, None
    date = f"{m.group(1)[:4]}-{m.group(1)[4:6]}-{m.group(1)[6:8]}"
    hhmm = None
    if m.group(2):
        h, mi = int(m.group(2)), int(m.group(3))
        if m.group(4):  # UTC -> shift to wall clock
            dt = datetime(2000, 1, 1, h, mi) + timedelta(hours=GCAL_UTC_OFFSET_HOURS)
            h, mi = dt.hour, dt.minute
        hhmm = f"{h:02d}:{mi:02d}"
    return date, hhmm


def parse_ics(text):
    events = []
    cur = None
    for line in unfold_ics(text):
        if line == "BEGIN:VEVENT":
            cur = {}
        elif line == "END:VEVENT":
            if cur and "start_raw" in cur:
                events.append(cur)
            cur = None
        elif cur is not None:
            if ":" not in line:
                continue
            name, value = line.split(":", 1)
            prop = name.split(";")[0]
            if prop == "DTSTART":
                cur["start_raw"] = value
            elif prop == "DTEND":
                cur["end_raw"] = value
            elif prop in ("UID", "SUMMARY", "STATUS"):
                cur[prop.lower()] = value
    return events


def gcal_event_to_task(ev):
    if ev.get("status") == "CANCELLED":
        return None
    date, hhmm = parse_ics_datetime(ev.get("start_raw", ""))
    if not date:
        return None
    end_date, _ = parse_ics_datetime(ev.get("end_raw", ""))
    title = (ev.get("summary") or "(no title)").strip()
    uid = (ev.get("uid") or "") + "|" + ev.get("start_raw", "")
    task = {"title": title, "color": "peacock", "completions": {},
            "source": "gcal", "gcalUid": uid}
    allday = re.fullmatch(r"\d{8}", ev.get("start_raw", "") or "") is not None
    if allday and end_date and end_date > date:
        # all-day DTEND is EXCLUSIVE: subtract a day for the inclusive end
        y, m, d = map(int, end_date.split("-"))
        inc = datetime(y, m, d) - timedelta(days=1)
        end_date = inc.strftime("%Y-%m-%d")
    if end_date and end_date > date:
        task.update(type="range", startDate=date, endDate=end_date)
    else:
        task.update(type="once", date=date)
    if hhmm:
        task["remindTime"] = hhmm
    return task


def sync_gcal(ics_url):
    req = urllib.request.Request(
        ics_url, headers={"User-Agent": "LIFE_OS-local-sync/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    events = parse_ics(raw)[:GCAL_MAX_EVENTS]
    try:
        state = json.loads(read_state())
    except ValueError:
        state = {}
    if not isinstance(state.get("tasks"), list):
        state["tasks"] = []
    if not isinstance(state.get("todos"), list):
        state["todos"] = []
    if not isinstance(state.get("fired"), dict):
        state["fired"] = {}
    by_uid = {t.get("gcalUid"): t for t in state["tasks"] if t.get("gcalUid")}
    added = updated = skipped = 0
    n = 0
    for ev in events:
        task = gcal_event_to_task(ev)
        if not task:
            skipped += 1
            continue
        n += 1
        old = by_uid.get(task["gcalUid"])
        if old:
            for k in ("title", "type", "date", "startDate", "endDate", "remindTime"):
                if k in task:
                    old[k] = task[k]
                elif k in old and k not in ("title", "type"):
                    old.pop(k, None)
            updated += 1
        else:
            task["id"] = "g" + os.urandom(6).hex()
            state["tasks"].append(task)
            by_uid[task["gcalUid"]] = task
            added += 1
    write_state(state)
    return {"ok": True, "events": len(events), "added": added,
            "updated": updated, "skipped": skipped}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def _json(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urlparse(self.path).path == "/api/state":
            raw = read_state()
            body = raw.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def do_POST(self):
        if urlparse(self.path).path == "/api/state":
            try:
                length = int(self.headers.get("Content-Length", 0))
            except ValueError:
                length = 0
            try:
                obj = json.loads(self.rfile.read(length) or b"{}")
            except (ValueError, OSError):
                return self._json(400, {"ok": False, "error": "bad json"})
            if not isinstance(obj.get("tasks"), list):
                return self._json(400, {"ok": False, "error": "missing tasks[]"})
            try:
                write_state(obj)
            except OSError as e:
                return self._json(500, {"ok": False, "error": str(e)})
            return self._json(200, {"ok": True})
        if urlparse(self.path).path == "/api/gcal-sync":
            try:
                length = int(self.headers.get("Content-Length", 0))
            except ValueError:
                length = 0
            try:
                obj = json.loads(self.rfile.read(length) or b"{}")
            except (ValueError, OSError):
                return self._json(400, {"ok": False, "error": "bad json"})
            url = (obj.get("icsUrl") or "").strip()
            if not (url.startswith("https://") and "calendar.google.com" in url):
                return self._json(400, {"ok": False,
                    "error": "need your Google Calendar ICS URL (Settings > your calendar > Secret address in iCal format)"})
            try:
                return self._json(200, sync_gcal(url))
            except Exception as e:  # network / parse failure -> explain, don't crash
                return self._json(502, {"ok": False, "error": f"fetch failed: {e}"})
        return self.send_error(404)

    def log_message(self, *args):
        pass  # quiet


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"LIFE_OS serving at http://127.0.0.1:{PORT}  (static: {STATIC_DIR}, state: state.json)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
