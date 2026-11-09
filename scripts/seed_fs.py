#!/usr/bin/env python3
"""Seed fs_suppliers + fs_meta. Existing rows are left unchanged (ignore-duplicates).
Env: SUPABASE_URL (default job-portal project), SUPABASE_SERVICE_ROLE_KEY (never commit).
Usage: python3 scripts/seed_fs.py [path/to/suppliers.csv]"""
import csv, json, os, sys, datetime, urllib.request
URL = os.environ.get("SUPABASE_URL", "https://vixnrugeiclzukzickmq.supabase.co").rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
CSV = sys.argv[1] if len(sys.argv) > 1 else "/workspace/job-hunt/hytorc_supplier_study/suppliers.csv"
INTS = "url_check cap cert scale usexp cost lead geo".split()
def post(table, rows):
    req = urllib.request.Request(f"{URL}/rest/v1/{table}", data=json.dumps(rows).encode(), method="POST",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                 "Prefer": "resolution=ignore-duplicates,return=minimal"})
    with urllib.request.urlopen(req) as r: print(table, len(rows), r.status)
rows = []
for r in csv.DictReader(open(CSV, encoding="utf-8")):
    for k in INTS: r[k] = int(r[k]) if (r.get(k) or "").strip().lstrip("-").isdigit() else None
    r["updated_at"] = datetime.datetime.utcnow().isoformat() + "Z"; rows.append(r)
post("fs_suppliers", rows)
RC = os.environ.get("FS_RECHECK_JSON", "/workspace/fs_homepage_recheck.json")
meta_extra = [{"key": "homepage_recheck", "value": open(RC).read()}] if os.path.exists(RC) else []
post("fs_meta", meta_extra + [{"key": "data_as_of", "value": "2026-11-02"}, {"key": "loaded_at", "value": datetime.date.today().isoformat()}, {"key": "version", "value": "v1.6.4"}])
