import json
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


PARAMS = {
    "EquipParamGoods.param": ("Consumíveis", "GoodsName.fmg", "GoodsInfo.fmg"),
    "EquipParamWeapon.param": ("Armas", "WeaponName.fmg", "WeaponInfo.fmg"),
    "EquipParamProtector.param": ("Armaduras", "ProtectorName.fmg", "ProtectorInfo.fmg"),
    "EquipParamAccessory.param": ("Talismãs", "AccessoryName.fmg", "AccessoryInfo.fmg"),
    "EquipParamGem.param": ("Cinzas de guerra", "GemName.fmg", "GemInfo.fmg"),
}


def witchy(executable: Path, file_path: Path) -> None:
    result = subprocess.run([str(executable), "-s", str(file_path)], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or f"WitchyBND falhou em {file_path.name}")


def fmg_entries(path: Path) -> dict[int, str]:
    if not path.exists():
        return {}
    root = ET.parse(path).getroot()
    entries = {}
    for text in root.findall("./entries/text"):
        try:
            value = (text.text or "").strip()
            if value and value not in {"%null%", "[ERROR]"}:
                entries[int(text.attrib["id"])] = value
        except (KeyError, ValueError):
            continue
    return entries


def parse_param(path: Path) -> list[dict[str, str]]:
    root = ET.parse(path).getroot()
    return [row.attrib for row in root.findall("./rows/row")]


def main() -> int:
    if len(sys.argv) != 4:
        print("uso: parse_witchy_catalog.py GAME_DIR OUTPUT_DIR WITCHY_EXE", file=sys.stderr)
        return 2
    game_dir, output_dir, witchy_path = map(Path, sys.argv[1:])
    game_dir = game_dir.resolve()
    output_dir = output_dir.resolve()
    witchy_exe = witchy_path.resolve()
    work = output_dir / "witchy-work"
    work.mkdir(parents=True, exist_ok=True)

    regulation = work / "regulation.bin"
    item_archive = work / "item.msgbnd.dcx"
    shutil.copy2(game_dir / "regulation.bin", regulation)
    shutil.copy2(game_dir / "msg" / "engus" / "item.msgbnd.dcx", item_archive)
    witchy(witchy_exe, regulation)
    witchy(witchy_exe, item_archive)

    param_dir = work / "regulation-bin"
    names_dir = work / "item-msgbnd-dcx"
    for param_name in PARAMS:
        param = param_dir / param_name
        if param.exists():
            witchy(witchy_exe, param)
    for _, (_, name_file, info_file) in PARAMS.items():
        for fmg_name in (name_file, info_file):
            fmg = names_dir / fmg_name
            if fmg.exists():
                witchy(witchy_exe, fmg)

    items = []
    for param_name, (category, name_file, info_file) in PARAMS.items():
        param_xml = param_dir / f"{param_name}.xml"
        name_xml = names_dir / f"{name_file}.xml"
        info_xml = names_dir / f"{info_file}.xml"
        if not param_xml.exists():
            continue
        names = fmg_entries(name_xml)
        infos = fmg_entries(info_xml)
        for row in parse_param(param_xml):
            try:
                item_id = int(row.get("id", "-1"))
            except ValueError:
                continue
            name = names.get(item_id) or row.get("paramdexName", "")
            if not name or name.startswith("Invalid") or item_id < 0:
                continue
            items.append({
                "name": name,
                "category": category,
                "icon": row.get("iconId", ""),
                "description": infos.get(item_id, "Descrição disponível nos dados locais do jogo."),
                "location": "Não informado pelo jogo",
                "acquisition": "Consulte os detalhes da fonte local",
                "vendor": "Não informado pelo jogo",
                "sellable": "Sim" if row.get("sellValue", "-1") not in {"-1", "0"} else "Não informado",
            })
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "items.json").write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    print(f"Catalogo local gerado: {len(items)} itens")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
