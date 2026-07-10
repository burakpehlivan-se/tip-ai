#!/usr/bin/env python3
"""
Synthea sample CSV → lab-pool.json

Kaynak:
  data/raw/synthea/patients.csv
  data/raw/synthea/observations.csv
  (indir: https://synthetichealth.github.io/synthea-sample-data/downloads/latest/synthea_sample_data_csv_latest.zip)

Politika:
  - Değerler SADECE dataset satırlarından gelir.
  - Referans aralıkları yalnızca normal/abnormal etiketlemek (filtre) için kullanılır;
    aralıktan rastgele değer ÜRETİLMEZ.

Kullanım:
  python3 scripts/extract-lab-pool.py
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SYN = ROOT / "data" / "raw" / "synthea"
OUT_FULL = ROOT / "data" / "lab" / "lab-pool.json"
OUT_SLIM = ROOT / "src" / "lib" / "data" / "lab-pool.json"

LOINC_MAP = {
    "2339-0": "GLUKOZ",
    "2345-7": "GLUKOZ",
    "4548-4": "HBA1C",
    "38483-4": "KREATININ",
    "2160-0": "KREATININ",
    "6299-2": "URE",
    "3094-0": "URE",
    "2947-0": "NA",
    "2951-2": "NA",
    "6298-4": "K",
    "2823-3": "K",
    "2069-3": "CL",
    "2075-0": "CL",
    "1920-8": "AST",
    "1742-6": "ALT",
    "2093-3": "KOLESTEROL_TOTAL",
    "18262-6": "LDL",
    "2085-9": "HDL",
    "2571-8": "TRIG",
    "718-7": "HB",
    "6690-2": "WBC",
    "777-3": "PLT",
    "4544-3": "HCT",
    "787-2": "MCV",
    "1988-5": "CRP",
    "89579-7": "TROPONIN",
    "33762-6": "BNP",
    "71425-3": "BNP",
    "2276-4": "FERITIN",
    "2498-4": "DEMIR_SERUM",
    "2500-7": "TDBK",
    "2502-3": "TRANSFERRIN_SAT",
    "5902-2": "PT",
    "6301-6": "INR",
    "3173-2": "PTT",
    "48065-7": "D_DIMER",
    "2744-1": "ABG_PH",
    "2019-8": "ABG_PCO2",
    "2703-7": "ABG_PO2",
    "1960-4": "ABG_HCO3",
    "2708-6": "ABG_SAT",
    "5803-2": "IDRAR_PH",
    "5811-5": "IDRAR_SG",
    "20454-5": "IDRAR_PROTEIN",
    "25428-4": "IDRAR_GLUKOZ",
    "5799-2": "IDRAR_LEU",
    "5802-4": "IDRAR_NIT",
    "5794-3": "IDRAR_KAN",
}

REF = {
    "GLUKOZ": (70, 99),
    "HBA1C": (4.0, 5.6),
    "KREATININ": {"M": (0.7, 1.3), "F": (0.6, 1.1)},
    "URE": (7, 20),
    "NA": (135, 145),
    "K": (3.5, 5.1),
    "CL": (98, 107),
    "AST": {"M": (10, 40), "F": (10, 35)},
    "ALT": {"M": (10, 41), "F": (7, 35)},
    "KOLESTEROL_TOTAL": (0, 200),
    "LDL": (0, 130),
    "HDL": {"M": (40, 100), "F": (50, 100)},
    "TRIG": (0, 150),
    "HB": {"M": (13.5, 17.5), "F": (12.0, 15.5)},
    "WBC": (4.0, 11.0),
    "PLT": (150, 400),
    "HCT": {"M": (40, 50), "F": (36, 46)},
    "MCV": (80, 100),
    "CRP": (0, 5),
    "TROPONIN": (0, 0.04),
    "BNP": (0, 125),
    "FERITIN": {"M": (30, 300), "F": (15, 150)},
    "DEMIR_SERUM": {"M": (65, 175), "F": (50, 170)},
    "TDBK": (250, 400),
    "TRANSFERRIN_SAT": (20, 50),
    "PT": (11, 13.5),
    "INR": (0.8, 1.2),
    "PTT": (25, 35),
    "D_DIMER": (0, 500),
    "ABG_PH": (7.35, 7.45),
    "ABG_PCO2": (35, 45),
    "ABG_PO2": (80, 100),
    "ABG_HCO3": (22, 26),
    "ABG_SAT": (95, 100),
    "IDRAR_PH": (5.0, 8.0),
    "IDRAR_SG": (1.005, 1.030),
}

COMPOSITES = {
    "CBC": ["HB", "WBC", "PLT", "HCT", "MCV"],
    "ELEKTROLIT": ["NA", "K", "CL"],
    "KOLESTEROL": ["KOLESTEROL_TOTAL", "LDL", "HDL", "TRIG"],
    "DEMIR": ["DEMIR_SERUM", "TDBK", "TRANSFERRIN_SAT"],
    "ABG": ["ABG_PH", "ABG_PCO2", "ABG_PO2", "ABG_HCO3"],
    "IDRAR": ["IDRAR_PH", "IDRAR_SG", "IDRAR_PROTEIN", "IDRAR_GLUKOZ", "IDRAR_LEU", "IDRAR_NIT", "IDRAR_KAN"],
    "PT_PANEL": ["PT", "INR"],
}

MAX_FULL = 80
MAX_SLIM = 40


def parse_date(s: str | None):
    if not s:
        return None
    s = s.replace("T", " ").split(".")[0].split("+")[0].strip()
    for fmt, n in (("%Y-%m-%d %H:%M:%S", 19), ("%Y-%m-%d", 10)):
        try:
            return datetime.strptime(s[:n], fmt)
        except Exception:
            pass
    return None


def age_at(birth, when):
    if not birth or not when:
        return None
    return when.year - birth.year - ((when.month, when.day) < (birth.month, birth.day))


def get_ref(code, sex):
    r = REF.get(code)
    if r is None:
        return None
    if isinstance(r, dict):
        return r.get(sex) or r.get("M")
    return r


def is_normal(code, value, unit, sex):
    if code == "TROPONIN":
        u = (unit or "").lower()
        if "ng/l" in u:
            return 0 <= value <= 40
        return 0 <= value <= 0.04
    ref = get_ref(code, sex)
    if not ref:
        return None
    lo, hi = ref
    return lo <= value <= hi


def diversify(arr, n):
    if len(arr) <= n:
        return arr
    arr = sorted(
        arr,
        key=lambda x: (
            x.get("age", 0),
            x.get("value", 0) if isinstance(x.get("value"), (int, float)) else 0,
        ),
    )
    step = max(1, len(arr) // n)
    return arr[::step][:n]


def cap_list(items, max_n):
    normals = [x for x in items if x.get("flag") == "normal"]
    others = [x for x in items if x.get("flag") != "normal"]
    out = diversify(normals, max_n)
    if len(out) < max_n // 4:
        out = out + diversify(others, max_n - len(out))
    return out[:max_n]


def main():
    if not (SYN / "patients.csv").exists():
        raise SystemExit(
            f"Synthea CSV bulunamadı: {SYN}\n"
            "İndir: curl -L -o data/raw/synthea_sample_data_csv_latest.zip \\\n"
            "  https://synthetichealth.github.io/synthea-sample-data/downloads/latest/synthea_sample_data_csv_latest.zip\n"
            "unzip -d data/raw/synthea data/raw/synthea_sample_data_csv_latest.zip"
        )

    patients = {}
    with open(SYN / "patients.csv") as f:
        for row in csv.DictReader(f):
            patients[row["Id"]] = {
                "birth": parse_date(row["BIRTHDATE"]),
                "sex": "F" if row.get("GENDER") == "F" else "M",
            }

    pool = defaultdict(list)
    encounter_labs = defaultdict(dict)

    with open(SYN / "observations.csv") as f:
        for row in csv.DictReader(f):
            loinc = row["CODE"]
            if loinc not in LOINC_MAP:
                continue
            code = LOINC_MAP[loinc]
            if row.get("CATEGORY") not in ("laboratory", "vital-signs"):
                if code != "ABG_SAT":
                    continue
            if row.get("TYPE") != "numeric":
                if code not in ("IDRAR_PROTEIN", "IDRAR_GLUKOZ", "IDRAR_LEU", "IDRAR_NIT", "IDRAR_KAN"):
                    continue
            p = patients.get(row["PATIENT"])
            if not p:
                continue
            when = parse_date(row["DATE"])
            age = age_at(p["birth"], when) if when and p["birth"] else None
            if age is None or age < 0 or age > 110:
                continue

            entry = {
                "patientId": row["PATIENT"],
                "encounterId": row.get("ENCOUNTER") or "",
                "age": age,
                "sex": p["sex"],
                "loinc": loinc,
                "description": row["DESCRIPTION"],
                "unit": row.get("UNITS") or "",
                "date": row["DATE"][:10] if row["DATE"] else "",
                "source": "synthea-sample-csv",
            }
            if row.get("TYPE") == "numeric":
                try:
                    value = float(row["VALUE"])
                except Exception:
                    continue
                entry["value"] = value
                flag = is_normal(code, value, entry["unit"], p["sex"])
                entry["flag"] = "normal" if flag is True else "abnormal" if flag is False else "unknown"
            else:
                entry["valueText"] = row["VALUE"]
                low = (row["VALUE"] or "").lower()
                if any(x in low for x in ["not detected", "negative", "no ", "absent"]):
                    entry["flag"] = "normal"
                elif any(x in low for x in ["detected", "positive", "++", "+++"]):
                    entry["flag"] = "abnormal"
                else:
                    entry["flag"] = "unknown"

            pool[code].append(entry)
            if entry["encounterId"]:
                encounter_labs[(row["PATIENT"], entry["encounterId"])][code] = entry

    capped = {k: cap_list(v, MAX_FULL) for k, v in pool.items()}

    composite_pool = defaultdict(list)
    for (pid, enc), comps in encounter_labs.items():
        p = patients[pid]
        for panel, keys in COMPOSITES.items():
            present = [k for k in keys if k in comps]
            if len(present) < max(2, len(keys) // 2):
                continue
            first = comps[present[0]]
            flags = [comps[k].get("flag") for k in present]
            if any(f == "abnormal" for f in flags):
                panel_flag = "abnormal"
            elif all(f == "normal" for f in flags):
                panel_flag = "normal"
            else:
                panel_flag = "mixed"
            composite_pool[panel].append(
                {
                    "patientId": pid,
                    "encounterId": enc,
                    "age": first["age"],
                    "sex": p["sex"],
                    "flag": panel_flag,
                    "date": first["date"],
                    "source": "synthea-sample-csv",
                    "components": {
                        k: {
                            "value": comps[k].get("value"),
                            "valueText": comps[k].get("valueText"),
                            "unit": comps[k].get("unit"),
                            "loinc": comps[k].get("loinc"),
                            "description": comps[k].get("description"),
                            "flag": comps[k].get("flag"),
                        }
                        for k in present
                    },
                }
            )

    panels = {k: cap_list(v, MAX_FULL) for k, v in composite_pool.items()}

    meta = {
        "primarySource": {
            "name": "Synthea Sample CSV (synthetic EHR)",
            "url": "https://synthetichealth.github.io/synthea-sample-data/downloads/latest/synthea_sample_data_csv_latest.zip",
            "tables": ["patients.csv", "observations.csv"],
            "patientCount": len(patients),
            "note": "MIMIC-IV labevents requires PhysioNet credentialed access. GoMask full export requires signup. Synthea openly records ordered labs including normal values.",
        },
        "secondarySource": {
            "name": "GoMask Lab Test Results",
            "url": "https://gomask.ai/marketplace/datasets/lab-test-results",
            "note": "Schema-compatible; full download needs account. Not bulk-imported here.",
        },
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "policy": "Values ONLY from imported rows. Ref ranges used only for normal/abnormal labeling.",
    }

    full = {"meta": meta, "analytes": capped, "panels": panels}
    OUT_FULL.parent.mkdir(parents=True, exist_ok=True)
    OUT_FULL.write_text(json.dumps(full, ensure_ascii=False, separators=(",", ":")))

    slim_a = {}
    for k, rows in capped.items():
        normals = [r for r in rows if r.get("flag") == "normal"]
        others = [r for r in rows if r.get("flag") != "normal"]
        picked = normals[:MAX_SLIM]
        if len(picked) < 8:
            picked = picked + others[: MAX_SLIM - len(picked)]
        for r in picked:
            if r.get("description") and len(r["description"]) > 60:
                r["description"] = r["description"][:60]
        slim_a[k] = picked

    slim_p = {}
    for k, rows in panels.items():
        normals = [r for r in rows if r.get("flag") == "normal"]
        others = [r for r in rows if r.get("flag") != "normal"]
        picked = normals[:MAX_SLIM]
        if len(picked) < 8:
            picked = picked + others[: MAX_SLIM - len(picked)]
        slim_p[k] = picked

    OUT_SLIM.parent.mkdir(parents=True, exist_ok=True)
    OUT_SLIM.write_text(
        json.dumps({"meta": meta, "analytes": slim_a, "panels": slim_p}, ensure_ascii=False, separators=(",", ":"))
    )
    print("Wrote", OUT_FULL, OUT_FULL.stat().st_size)
    print("Wrote", OUT_SLIM, OUT_SLIM.stat().st_size)


if __name__ == "__main__":
    main()
