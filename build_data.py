#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Transformar las tablas de menciones de Nobel a JSON para GitHub Pages.

Uso:
    python build_data.py --main "/ruta/tesis_udesa_economia"
    python build_data.py --main "/ruta/tesis_udesa_economia" --out "/ruta/mi-web/data"

No modifica CSV originales y no necesita acceder a internet.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import unicodedata
import pandas as pd


# Cambiá MAIN si preferís ejecutar el script desde Spyder sin argumentos.
# Esta es una ruta de ejemplo relativa a la carpeta de la página web.
MAIN = Path("/Users/tomaspacheco/Desktop/tesis_nobel/")

COLECCIONES = {
    "doctorado_economia": "Doctorado en Economía",
    "maestria_economia": "Maestría en Economía",
    "licenciatura_economia": "Licenciatura en Economía",
    "licenciatura_economia_abogacia": "Economía y Abogacía",
    "licenciatura_economia_administracion": "Economía y Administración",
    "licenciatura_economia_contador": "Economía y Contador Público",
    "licenciatura_economia_relaciones_internacionales": "Economía y Relaciones Internacionales",
}


def read_csv(path):
    if not path.exists():
        raise FileNotFoundError(f"No se encuentra {path}. Ejecutá primero el contador de Nobel.")
    return pd.read_csv(path, dtype=str, keep_default_na=False, encoding="utf-8-sig", low_memory=False)


def clean(value):
    if value is None:
        return ""
    return str(value).strip()


def first(row, options):
    for key in options:
        if key in row and clean(row[key]):
            return clean(row[key])
    return ""


def year_from_metadata(row):
    """Fecha de publicación (issued). NO usar accessioned como sustituto."""
    preferred = ["dc.date.issued", "dc.date.issued[es]", "anio", "año", "year", "publication_year", "fecha_publicacion", "dc.date.created"]
    for key in preferred:
        raw = clean(row.get(key, ""))
        if not raw:
            continue
        match = re.search(r"(?<!\d)(1[89]\d{2}|20\d{2}|2100)(?!\d)", raw)
        if match:
            return int(match.group(1))
    return None


def slug(text):
    s = unicodedata.normalize("NFKD", clean(text).casefold())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def id_nobel(row):
    return first(row, ["columna"]) or f"nobel_{slug(row['apellido'])}_{row['anio_premio']}"


def parse_int(x, default=0):
    try:
        return int(float(x))
    except (ValueError, TypeError):
        return default


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    staging = path.with_suffix(".json.part")
    with staging.open("w", encoding="utf-8") as file:
        json.dump(obj, file, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    staging.replace(path)


def export(main, out):
    attrs = read_csv(main / "attributes_nobeles.csv")
    catalogo = read_csv(main / "catalogo_nobeles.csv")
    menciones_csv = read_csv(main / "menciones_nobeles.csv")

    need_attrs = {"uuid", "coleccion"}
    need_cat = {"anio_premio", "nombre", "apellido"}
    need_mentions = {"uuid", "coleccion", "anio_premio", "nombre", "menciones"}
    for df, needed, name in [(attrs, need_attrs, "attributes_nobeles.csv"),
                             (catalogo, need_cat, "catalogo_nobeles.csv"),
                             (menciones_csv, need_mentions, "menciones_nobeles.csv")]:
        missing = needed - set(df.columns)
        if missing:
            raise ValueError(f"Faltan columnas {sorted(missing)} en {name}")
    if attrs.empty or catalogo.empty:
        raise ValueError("Los datos de tesis o el catálogo de Nobel están vacíos")

    catalog_records = []
    award_lookup = {}
    for r in catalogo.to_dict("records"):
        ident = id_nobel(r)
        if ident in {n["id"] for n in catalog_records}:
            raise ValueError(f"ID de Nobel duplicado: {ident}")
        item = {
            "id": ident,
            "name": clean(r["nombre"]),
            "surname": clean(r["apellido"]),
            "awardYear": parse_int(r["anio_premio"]),
        }
        catalog_records.append(item)
        lookup_key = (item["awardYear"], item["name"].casefold())
        award_lookup[lookup_key] = item["id"]

    laureate_ids = {n["id"] for n in catalog_records}
    thesis_records = []
    found_keys = set()
    for r in attrs.to_dict("records"):
        uuid, collection = clean(r["uuid"]).lower(), clean(r["coleccion"])
        if not uuid or not collection:
            raise ValueError("Hay una tesis con uuid o coleccion vacío")
        key = f"{collection}::{uuid}"
        if key in found_keys:
            raise ValueError(f"Tesis duplicada: {key}")
        found_keys.add(key)
        state = first(r, ["estado_texto"])
        if state:
            has_txt = state == "procesado"
        else:
            has_txt = clean(r.get("n_menciones_nobel", "")) != ""
        raw_url = first(r, ["url"])
        url = raw_url if raw_url.startswith("https://repositorio.udesa.edu.ar/") else f"https://repositorio.udesa.edu.ar/items/{uuid}"
        title = first(r, ["titulo", "dc.title", "name"]) or "Sin título"
        author = first(r, ["dc.creator.Autor", "dc.contributor.author", "dc.creator", "autor", "author"])
        advisor = first(r, ["dc.contributor.Mentor", "dc.contributor.advisor", "director"])
        total_unique_surnames = parse_int(r.get("n_apellidos_nobel", ""), 0) if has_txt else None
        total_mentions = parse_int(r.get("n_menciones_nobel", ""), 0) if has_txt else None
        thesis_records.append({
            "id": key,
            "uuid": uuid,
            "collection": collection,
            "collectionLabel": COLECCIONES.get(collection, collection.replace("_", " ").title()),
            "title": title,
            "author": author,
            "advisor": advisor,
            "year": year_from_metadata(r),
            "url": url,
            "hasText": has_txt,
            "mentionsAny": bool(total_mentions and total_mentions > 0) if has_txt else None,
            "totalSurnameMentions": total_mentions,
            "distinctSurnames": total_unique_surnames,
        })

    mention_records = []
    seen_pairs = set()
    bad_rows = 0
    for r in menciones_csv.to_dict("records"):
        number = parse_int(r.get("menciones"), 0)
        if number <= 0:
            continue
        key = f"{clean(r['coleccion'])}::{clean(r['uuid']).lower()}"
        nobel = award_lookup.get((parse_int(r["anio_premio"]), clean(r["nombre"]).casefold()))
        if not nobel or key not in found_keys or nobel not in laureate_ids:
            bad_rows += 1
            continue
        pair = (key, nobel)
        if pair in seen_pairs:
            raise ValueError(f"Mención repetida para {pair}")
        seen_pairs.add(pair)
        mention_records.append({"thesisId": key, "nobelId": nobel, "count": number})

    if bad_rows:
        raise ValueError(f"Hay {bad_rows} filas de menciones sin tesis o sin Nobel correspondiente. Revisá tus CSV antes de publicar.")

    # Asegurarse de no exhibir datos contradictorios tras una actualización parcial.
    with_text = {t["id"] for t in thesis_records if t["hasText"]}
    bad_text_rows = sum(1 for r in mention_records if r["thesisId"] not in with_text)
    if bad_text_rows:
        raise ValueError(f"{bad_text_rows} menciones corresponden a tesis sin TXT procesado")

    catalog_records.sort(key=lambda r: (r["awardYear"], r["name"]))
    thesis_records.sort(key=lambda r: (r["year"] is None, -(r["year"] or 0), r["title"].casefold()))
    mention_records.sort(key=lambda r: (r["nobelId"], r["thesisId"]))
    metadata = {
        "ready": True,
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "theses": len(thesis_records),
        "withText": sum(t["hasText"] for t in thesis_records),
        "missingPublicationYear": sum(t["year"] is None for t in thesis_records),
        "laureates": len(catalog_records),
        "nonzeroPairs": len(mention_records),
        "method": "Coincidencias de apellidos como palabras completas; no identifican inequívocamente a la persona.",
    }

    for file, obj in (("tesis.json", thesis_records), ("nobeles.json", catalog_records),
                      ("menciones.json", mention_records), ("metadata.json", metadata)):
        write_json(out / file, obj)

    print("\nDatos de la web generados correctamente:")
    for key, value in metadata.items():
        print(f"  {key}: {value}")
    print(f"\nCarpeta de salida: {out.resolve()}")
    print("Ahora subí los nuevos archivos data/*.json a tu repositorio de GitHub.")
    if metadata["missingPublicationYear"]:
        print("AVISO: algunas tesis no tienen año de publicación identificable; aparecen en la búsqueda, no en el gráfico anual.")


def main_cli():
    parser = argparse.ArgumentParser(description="Generar datos para la web UdeSA Nobel")
    parser.add_argument("--main", type=Path, default=MAIN, help="Carpeta raíz de los CSV de tesis")
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parent / "data", help="Carpeta de salida de JSON")
    args = parser.parse_args()
    export(args.main.expanduser(), args.out.expanduser())


if __name__ == "__main__":
    main_cli()
