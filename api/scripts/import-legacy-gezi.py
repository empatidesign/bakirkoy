#!/usr/bin/env python3
"""Eski sistem (sultanga_genclik) gezi modülünü Nexora Travel modülüne aktarır.

gezi -> TravelRoutes, gezisefer -> Travels (tarih bazlı), gezibasvuru -> TravelApplications
(+ TravelApplicationPassengers), geziotobus -> TravelBuses, geziseferotobus -> TravelBusAssignments.
Katılımcılar Participants tablosundan TC ile eşleştirilir (yeni katılımcı oluşturulmaz).
"Geçmiş Geziler" (gezi 9) ve gezisi olmayan (gezi 0) başvurular gerçek gezi tarihine göre seferlere ayrılır.

Girdi: TSV dosyaları (scratch MySQL'den çıkarılmış), argv[1] = TSV klasörü.
Önceki (eksik) aktarımın tüm Travel verisini siler ve baştan yazar. Tek transaction.
"""
import csv, html, json, sys, uuid, collections, datetime as dt
import psycopg2
from psycopg2.extras import execute_values

D = sys.argv[1]
ACTOR = "Eski sistem aktarımı"
GENCLIK = "https://genclik.sultangazi.bel.tr"
ARCHIVE_GEZI = 9
PLACEHOLDER_DATE = "2011-12-31"  # eski sistemin tarihsiz toplu aktarım değeri


def tsv(name):
    with open(f"{D}/{name}", encoding="utf-8") as f:
        return [r for r in csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE)]


def ts(s):
    if not s or s.startswith("0000"):
        return None
    try:
        v = dt.datetime.fromisoformat(s)
    except ValueError:
        return None
    return v if v.year >= 2000 else None


def clean(s):
    return html.unescape((s or "").replace("\\n", "\n")).strip()


def img_url(u):
    u = (u or "").strip()
    if not u:
        return ""
    if u.startswith("/"):
        return GENCLIK + u
    return u.replace("http://www.sultangazi.bel.tr", "https://sultangazi.bel.tr")


def images_json(url):
    if not url:
        return "{}"
    spec = lambda w, h, kb: {"url": url, "width": w, "height": h, "maxSizeKb": kb}
    return json.dumps({
        "web": {"cover": spec(1920, 720, 800), "card": spec(600, 400, 200), "thumb": spec(240, 240, 80)},
        "mobile": {"cover": spec(1080, 1350, 600), "card": spec(750, 750, 250), "thumb": spec(320, 320, 100)},
        "photos": [],
    }, ensure_ascii=False)


def age_range(yas):
    nums = sorted({int(x) for x in yas.split(",") if x.strip().isdigit() and 0 < int(x) < 120})
    if not nums:
        return 0, 0
    return nums[0], (0 if nums[-1] >= 99 else nums[-1])


GENDER = {"1": "male", "2": "female"}

conn = psycopg2.connect(host="localhost", port=34100, user="nexora_admin", password="Nexora2026!", dbname="nexora")
conn.autocommit = False
cur = conn.cursor()

# ---- lookups ----
cur.execute('select "Name","Id" from "TravelCategories" where not "IsDeleted"')
cat_by_name = dict(cur.fetchall())
CAT = {1: "Şehir ve Kültür Gezileri", 2: "Tarihi Geziler", 3: "Aktivite Gezileri",
       4: "Piknik/Kamp Eğlence Gezisi", 5: "Cenaze/Taziye", 6: "Boğaz Turu Gezisi"}
cat_id = {k: cat_by_name[v] for k, v in CAT.items()}

cur.execute('select "Tckn","Id","Gender","FullName" from "Participants" where not "IsDeleted"')
part = {r[0]: (r[1], {1: "male", 2: "female"}.get(r[2], "mixed")) for r in cur.fetchall()}

gezi = {int(r[0]): r for r in tsv("gezi.tsv")}
sefer_rows = tsv("sefer.tsv")
apps = tsv("basvuru.tsv")
otobus = tsv("otobus.tsv")
sefer_bus = tsv("seferotobus.tsv")

# ---- wipe previous partial import ----
cur.execute('delete from "TravelAttendances"')
cur.execute('delete from "TravelReviews"')
cur.execute('delete from "TravelApplicationPassengers"')
cur.execute('delete from "TravelApplications"')
cur.execute('delete from "TravelBusAssignments"')
cur.execute('delete from "Travels"')
cur.execute('delete from "TravelRoutes"')
cur.execute('delete from "TravelBuses"')
cur.execute('''delete from "ParticipantActivityRecords" where "Module"='travels' ''')
cur.execute('''update "ParticipantActivitySyncCursors" set "LastSyncedUpTo"='-infinity', "LastRunUpserts"=0 where "Module"='travels' ''')
cur.execute("select setval('travel_code_seq', 1, false)")
cur.execute("select setval('travel_application_code_seq', 1, false)")

now = dt.datetime.utcnow()

# ---- buses ----
bus_id, bus_cap = {}, {}
bus_rows = []
for oid, marka, plaka, koltuk, vapur, aktif in otobus:
    bid = str(uuid.uuid4())
    bus_id[int(oid)] = bid
    bus_cap[int(oid)] = int(koltuk)
    name = f"{plaka.strip() or '-'} ({marka.strip()})" if vapur == "0" else "Vapur"
    # numarasız/kontenjanlı araç: eski koltuk numaraları (1..47) Nexora koltuk şablonlarına birebir oturmuyor
    bus_rows.append((bid, name[:150], plaka.strip()[:20], "", int(koltuk), "{}", 0, aktif == "1", ACTOR, now, False, "capacity"))
execute_values(cur, '''insert into "TravelBuses" ("Id","Name","PlateNumber","TemplateId","Capacity","SeatStatesJson","OccupiedCount","IsActive","CreatedBy","CreatedAt","IsDeleted","VehicleType") values %s''', bus_rows)

# ---- apps grouped ----
by_sefer = collections.defaultdict(list)
for a in apps:
    by_sefer[int(a[2])].append(a)

sefer_by_id = {int(r[0]): r for r in sefer_rows}
buses_of = collections.defaultdict(list)
crew_of = {}
for sid, oid, ilgili, ilgilitel, sofor, soforcep in sefer_bus:
    sid, oid = int(sid), int(oid)
    if oid in bus_id and oid not in buses_of[sid]:
        buses_of[sid].append(oid)
    crew_of.setdefault(sid, (ilgili.strip(), ilgilitel.strip(), sofor.strip(), soforcep.strip()))

# ---- routes ----
route_id = {}
route_meta = {}
for gid, r in gezi.items():
    _, adi, resim, kisa, uzun, aktif = r
    my_sefers = [s for s in sefer_rows if s[1] == str(gid)]
    turs = collections.Counter(int(s[7]) for s in my_sefers)
    tur = turs.most_common(1)[0][0] if turs else (6 if "BOĞAZ" in adi else 1)
    deps = collections.Counter(s[4].strip() for s in my_sefers if s[4].strip())
    dep = deps.most_common(1)[0][0] if deps else "Sultangazi Belediyesi Önü"
    desc = clean(uzun) or clean(kisa)
    rid = str(uuid.uuid4())
    route_id[gid] = rid
    route_meta[gid] = dict(name=adi.strip(), cat=cat_id.get(tur, cat_id[1]), desc=desc, dep=dep,
                           images=images_json(img_url(resim)), active=aktif == "1")
    cur.execute('''insert into "TravelRoutes" ("Id","Name","CategoryId","Destination","Description","Conditions","InternalNote",
        "Gender","MinAge","MaxAge","RestrictionsJson","ImagesJson","PricingJson","PointsJson","SultangaziResidentOnly","IsActive",
        "CreatedBy","CreatedAt","IsDeleted","DeparturePoint") values (%s,%s,%s,%s,%s,'',%s,'mixed',0,0,'{}',%s,'{}','{}',true,%s,%s,%s,false,%s)''',
                (rid, adi.strip(), route_meta[gid]["cat"], adi.strip(), desc,
                 f"Eski sistemden aktarıldı (gezi.id={gid}).", route_meta[gid]["images"], route_meta[gid]["active"], ACTOR, now, dep))

# ---- build travel (sefer) list ----
# key -> dict ; each legacy application is mapped to a key
travels = {}
app_key = {}


def add_travel(key, gid, start_tr, end_tr, **kw):
    travels[key] = dict(gid=gid, start=start_tr, end=end_tr, **kw)


skipped_sefers = []
for s in sefer_rows:
    sid, gid = int(s[0]), int(s[1])
    if gid in (0, ARCHIVE_GEZI) or gid not in gezi:
        if by_sefer.get(sid) and gid not in (0, ARCHIVE_GEZI):
            skipped_sefers.append(sid)
        continue
    sapps = [a for a in by_sefer.get(sid, []) if int(a[1]) == gid]
    start = ts(s[2]) or ts(s[11]) or ts(s[3])
    if start is None and sapps:
        first = min(ts(a[6]) for a in sapps if ts(a[6]))
        start = (first + dt.timedelta(hours=3)).replace(hour=7, minute=0, second=0)
    if start is None:
        skipped_sefers.append(sid)
        continue
    end = ts(s[3])
    if end is None or end < start or (end - start).days > 20:
        end = start + dt.timedelta(hours=15)
    mn, mx = age_range(s[8])
    note = []
    if s[10].strip():
        note.append(f"Kurum: {s[10].strip()}")
        if s[12].strip():
            note.append(f"Kurum yetkilisi: {s[12].strip()} {s[13].strip()}".strip())
    note.append(f"Eski sistem sefer.id={sid}")
    add_travel(("s", sid), gid, start, end, dep=s[4].strip(), dest=s[5].strip(), tur=int(s[7]),
               gender=GENDER.get(s[9], "mixed"), minage=mn, maxage=mx, note="\n".join(note),
               buses=buses_of.get(sid, []), crew=crew_of.get(sid))
    for a in sapps:
        app_key[a[0]] = ("s", sid)

# applications whose sefer is missing / belongs to archive / mismatched gezi
for a in apps:
    if a[0] in app_key:
        continue
    gid, sid, tarih = int(a[1]), int(a[2]), a[5]
    if gid in gezi and gid not in (0, ARCHIVE_GEZI):
        key = ("orphan", gid, sid)
        if key not in travels:
            d = ts(tarih + " 07:00:00") if tarih else None
            if d is None:
                d = (ts(a[6]) + dt.timedelta(hours=3)).replace(hour=7, minute=0, second=0)
            add_travel(key, gid, d, d + dt.timedelta(hours=15), dep="", dest="", tur=1, gender="mixed",
                       minage=0, maxage=0, note=f"Eski sistem sefer.id={sid} (sefer kaydı silinmiş, başvuru tarihinden oluşturuldu)",
                       buses=[], crew=None)
        app_key[a[0]] = key
    else:
        # Geçmiş Geziler arşivi: gerçek gezi tarihine göre sefer
        if tarih and tarih != PLACEHOLDER_DATE and ts(tarih + " 07:00:00"):
            key = ("arch", tarih)
            if key not in travels:
                d = ts(tarih + " 07:00:00")
                add_travel(key, ARCHIVE_GEZI, d, d + dt.timedelta(hours=15), dep="", dest="", tur=1, gender="mixed",
                           minage=0, maxage=0, note=f"Geçmiş Geziler arşivi ({tarih})", buses=[], crew=None)
        else:
            key = ("arch", "nodate")
            if key not in travels:
                d = dt.datetime(2011, 12, 31, 7, 0)
                add_travel(key, ARCHIVE_GEZI, d, d + dt.timedelta(hours=15), dep="", dest="", tur=1, gender="mixed",
                           minage=0, maxage=0,
                           note="Geçmiş Geziler arşivi: eski sistemde gezi tarihi kaydedilmemiş başvurular (toplu aktarım 2011-12-31).",
                           buses=[], crew=None)
        app_key[a[0]] = key

# ---- applications per travel ----
apps_of = collections.defaultdict(list)
for a in apps:
    apps_of[app_key[a[0]]].append(a)

unmatched = collections.Counter()
travel_id = {}
travel_rows, assign_rows = [], []
app_rows, pax_rows = [], []
dup_merged = 0

ordered = sorted(travels.items(), key=lambda kv: kv[1]["start"])
for key, t in ordered:
    tid = str(uuid.uuid4())
    travel_id[key] = tid
    m = route_meta[t["gid"]]
    tapps = sorted(apps_of.get(key, []), key=lambda a: (a[6] or "", int(a[0])))
    # TC bazında birleştir: aynı TC aynı sefere birden çok koltuk aldıysa tek başvuru
    groups = collections.OrderedDict()
    for a in tapps:
        tc = a[7]
        if tc not in part:
            unmatched[tc] += 1
            continue
        groups.setdefault(tc, []).append(a)
    approved = 0
    for tc, lst in groups.items():
        active = [a for a in lst if a[8] == "0"]
        cancelled = [a for a in lst if a[8] != "0"]
        pid, pg = part[tc]
        emit = []
        if active:
            emit.append(("approved", active))
            dup_merged += len(active) - 1
        elif cancelled:
            emit.append(("cancelled", cancelled[:1]))
        for status, rows in emit:
            first = rows[0]
            seats = [r[4] for r in rows if r[4] not in ("0", "")]
            oid = int(first[3])
            bid = bus_id.get(oid) if status == "approved" and oid in bus_id else None
            if bid and oid not in t["buses"]:
                t["buses"].append(oid)
            seat = seats[0] if (seats and status == "approved") else None
            created = ts(first[6]) or (t["start"] - dt.timedelta(days=3))
            notes = [f"Eski sistem başvuru no: {', '.join(r[0] for r in rows)}"]
            if len(seats) > 1:
                notes.append(f"Ek koltuklar (aynı TC ile alınmış): {', '.join(seats[1:])}")
            aid = str(uuid.uuid4())
            app_rows.append((aid, tid, pid, created, status, "complete" if status == "approved" else "pending",
                             "pending", bid, seat, "\n".join(notes), ACTOR, created))
            pax_rows.append((str(uuid.uuid4()), aid, pid, pg, bid, seat, True,
                             "active" if status == "approved" else "cancelled", created))
            if status == "approved":
                approved += 1
    cap = sum(bus_cap[o] for o in t["buses"]) or 45
    cap = max(cap, approved)
    reg_start = min((ts(a[6]) for a in tapps if ts(a[6])), default=None)
    start_utc_sql = t["start"]
    crew = "{}"
    if t["crew"] and (t["crew"][0] or t["crew"][2]):
        ilgili, ilgilitel, sofor, soforcep = t["crew"]
        crew = json.dumps({"driver": {"id": "", "name": sofor if sofor != "ADI SOYADI" else "", "phone": soforcep},
                           "guide": {"id": "", "name": "", "phone": ""},
                           "responsible": {"id": "", "name": ilgili, "role": "", "roleKey": "", "phone": ilgilitel}},
                          ensure_ascii=False)
    travel_rows.append(dict(id=tid, start=t["start"], end=t["end"], reg_start=reg_start, name=m["name"], cat=cat_id.get(t["tur"], m["cat"]),
                            dest=t["dest"] or m["name"], desc=m["desc"], note=t["note"], gender=t["gender"],
                            minage=t["minage"], maxage=t["maxage"], cap=cap, approved=approved, buscount=len(t["buses"]),
                            images=m["images"], crew=crew, route=route_id[t["gid"]], dep=t["dep"] or m["dep"]))
    for o in t["buses"]:
        assign_rows.append((tid, bus_id[o]))

# Travel tarihleri Türkiye duvar saati -> UTC (Europe/Istanbul, 2016 öncesi yaz/kış saati dahil)
for tr in travel_rows:
    cur.execute('''insert into "Travels" ("Id","Code","Name","CategoryId","Destination","Description","Conditions","InternalNote",
        "StartDate","EndDate","RegistrationStartDate","RegistrationEndDate","Gender","MinAge","MaxAge","Capacity","ReserveCapacity",
        "ParticipationPeriod","ParticipationLimit","RestrictionsJson","ImagesJson","PricingJson","PointsJson","IsActive",
        "RegisteredCount","ReserveCount","BusCount","CreatedBy","CreatedAt","IsDeleted","CrewJson","CancellationDeadlineHours",
        "SultangaziResidentOnly","RouteId","ExemptFromParticipationLimit","DeparturePoint","AttendanceTakenAt")
        values (%(id)s, 'GEZ-'||lpad(nextval('travel_code_seq')::text,6,'0'), %(name)s, %(cat)s, %(dest)s, %(desc)s, '', %(note)s,
        (%(start)s::timestamp at time zone 'Europe/Istanbul') at time zone 'UTC',
        (%(end)s::timestamp at time zone 'Europe/Istanbul') at time zone 'UTC',
        coalesce(%(reg_start)s::timestamp, (%(start)s::timestamp at time zone 'Europe/Istanbul') at time zone 'UTC' - interval '7 days'),
        (%(start)s::timestamp at time zone 'Europe/Istanbul') at time zone 'UTC',
        %(gender)s, %(minage)s, %(maxage)s, %(cap)s, 0, 'none', 0, '{}', %(images)s, '{}', '{}', false,
        %(approved)s, 0, %(buscount)s, 'Eski sistem aktarımı',
        (%(start)s::timestamp at time zone 'Europe/Istanbul') at time zone 'UTC' - interval '7 days',
        false, %(crew)s, 72, true, %(route)s, false, %(dep)s, null)''', tr)

execute_values(cur, 'insert into "TravelBusAssignments" ("TravelId","BusId") values %s on conflict do nothing', assign_rows)

app_rows.sort(key=lambda r: r[3])
execute_values(cur, '''insert into "TravelApplications" ("Id","Code","TravelId","ParticipantId","ApplicationDate","Status","DocumentStatus",
    "PaymentStatus","BusId","SeatNumber","Notes","AppliedBy","CreatedAt","IsDeleted","IsGuest")
    select v.id::uuid, 'GZB-'||lpad(nextval('travel_application_code_seq')::text,6,'0'), v.tid::uuid, v.pid::uuid, v.created::timestamp, v.status,
      v.doc, v.pay, v.bid::uuid, v.seat, v.notes, v.actor, v.cat::timestamp, false, false
    from (values %s) v(id,tid,pid,created,status,doc,pay,bid,seat,notes,actor,cat)''', app_rows, page_size=2000)
execute_values(cur, '''insert into "TravelApplicationPassengers" ("Id","ApplicationId","ParticipantId","Gender","BusId","SeatNumber","IsPrimary","Status","CreatedAt","IsDeleted")
    select v.id::uuid, v.aid::uuid, v.pid::uuid, v.g, v.bid::uuid, v.seat, v.p, v.st, v.c::timestamp, false
    from (values %s) v(id,aid,pid,g,bid,seat,p,st,c)''', pax_rows, page_size=2000)

conn.commit()
print(json.dumps({
    "routes": len(route_id), "travels": len(travel_rows), "buses": len(bus_rows), "busAssignments": len(assign_rows),
    "applications": len(app_rows), "approved": sum(1 for r in app_rows if r[4] == "approved"),
    "cancelled": sum(1 for r in app_rows if r[4] == "cancelled"),
    "sameTcExtraSeatsMerged": dup_merged, "unmatchedTcRows": sum(unmatched.values()), "unmatchedTcDistinct": len(unmatched),
    "skippedSefersWithoutDateOrApps": len(skipped_sefers),
}, ensure_ascii=False, indent=1))
with open(f"{D}/unmatched_tc.txt", "w") as f:
    f.write("\n".join(sorted(unmatched)))
