#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
アイコン（Font Awesome）を、このサイトで実際に使うものだけに絞り込む。

    python3 tools/build-icons.py

やっていること
  1. 全HTMLから <i class="fa-solid fa-〇〇"> を集める
  2. 元のFont Awesomeから、その文字（グリフ）だけを抜き出したwoff2を作る
  3. 必要なCSSだけを書いた icons/icons.css を生成する

元ファイルは icons/src/ に置いてある。無い場合は下記で取得する。
    pip download fontawesomefree -d /tmp/fa --no-deps && cd /tmp/fa && unzip -o *.whl
    （fontawesomefree/static/fontawesomefree/ の webfonts と css をコピー）

ライセンス：Font Awesome Free（アイコン CC BY 4.0／フォント SIL OFL 1.1）
  https://fontawesome.com/license/free
"""
import os
import re
import sys
import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "icons", "src")
OUT = os.path.join(ROOT, "icons")

try:
    from fontTools.subset import Subsetter
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit("fontTools が必要です:  pip install fonttools brotli")


def used_icons():
    """全HTMLから、使われているアイコン名を集める"""
    names = set()
    for f in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
        html = open(f, encoding="utf-8").read()
        for cls in re.findall(r'class="([^"]*fa-solid[^"]*)"', html):
            for n in re.findall(r"\bfa-(?!solid\b|regular\b|brands\b|fw\b|[0-9]?x\b)([a-z0-9-]+)", cls):
                names.add(n)
    return names


def css_icons():
    """style.css が content で直接指定しているアイコンを、ウェイト別に集める
       （900＝Solid／400＝Regular。両者は別のフォントファイル）"""
    css = open(os.path.join(ROOT, "css", "style.css"), encoding="utf-8").read()
    by_weight = {400: set(), 900: set()}
    for block in re.findall(r"\{[^{}]*\}", css):
        if "Font Awesome 6 Free" not in block:
            continue
        m = re.search(r'content:\s*"\\(f[0-9a-f]{3,4})"', block)
        if not m:
            continue
        w = re.search(r"font-weight:\s*(\d+)", block)
        by_weight[400 if (w and w.group(1) == "400") else 900].add(int(m.group(1), 16))
    return by_weight


def icon_codepoints():
    """元のCSSから「アイコン名 → 文字コード」の対応表を作る"""
    path = os.path.join(SRC, "css", "all.css")
    css = open(path, encoding="utf-8").read()
    table = {}
    # .fa-house::before { content: "\f015"; }  … 複数セレクタの共有にも対応
    for sel, code in re.findall(r"((?:\.fa-[a-z0-9-]+::before\s*,?\s*)+)\{\s*content:\s*\"\\([0-9a-f]+)\"", css):
        for name in re.findall(r"\.fa-([a-z0-9-]+)::before", sel):
            table[name] = int(code, 16)
    return table


def subset(src_name, cps, out_name):
    """元フォントから、指定した文字だけを抜き出したwoff2を作る"""
    src_font = os.path.join(SRC, "webfonts", src_name)
    font = TTFont(src_font)
    lost = cps - set(font.getBestCmap().keys())
    if lost:
        sys.exit(f"{src_name} に無い文字コード: {[hex(c) for c in sorted(lost)]}")
    sub = Subsetter()
    sub.populate(unicodes=sorted(cps))
    sub.subset(font)
    font.flavor = "woff2"
    os.makedirs(OUT, exist_ok=True)
    dst = os.path.join(OUT, out_name)
    font.save(dst)
    font.close()
    before, after = os.path.getsize(src_font), os.path.getsize(dst)
    print(f"  {out_name:24s} {after/1024:5.1f} KB  {len(cps):2d}文字"
          f"（元 {before/1024:.0f} KB → {after/before*100:.1f}%）")
    return after


def main():
    names = used_icons()
    table = icon_codepoints()
    from_css = css_icons()

    missing = sorted(n for n in names if n not in table)
    if missing:
        sys.exit(f"元のFont Awesomeに無いアイコン名があります: {missing}")

    solid = {table[n] for n in names} | from_css[900]
    regular = from_css[400]
    print(f"使用アイコン: HTML {len(names)} 種類 ＋ CSS内の指定 "
          f"{len(from_css[900]) + len(regular)} 件")

    total = subset("fa-solid-900.woff2", solid, "kskac-icons.woff2")
    if regular:
        total += subset("fa-regular-400.woff2", regular, "kskac-icons-r.woff2")
    print(f"  合計 {total/1024:.1f} KB")

    face = (
        "@font-face {{\n"
        '  font-family: "Font Awesome 6 Free";\n'
        "  font-style: normal;\n"
        "  font-weight: {w};\n"
        "  font-display: block;\n"
        '  src: url("{f}") format("woff2");\n'
        "}}"
    )
    lines = [
        "/* このサイトで使うアイコンだけを収録したもの。",
        "   追加・変更したら  python3 tools/build-icons.py  を実行して作り直すこと。",
        "",
        "   Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com",
        "   アイコン: CC BY 4.0 / フォント: SIL OFL 1.1  https://fontawesome.com/license/free */",
        face.format(w=900, f="kskac-icons.woff2"),
    ]
    if regular:
        lines.append(face.format(w=400, f="kskac-icons-r.woff2"))
    lines += [
        ".fa-solid, .fas {",
        '  font-family: "Font Awesome 6 Free";',
        "  font-weight: 900;",
        "  -moz-osx-font-smoothing: grayscale;",
        "  -webkit-font-smoothing: antialiased;",
        "  display: var(--fa-display, inline-block);",
        "  font-style: normal;",
        "  font-variant: normal;",
        "  line-height: 1;",
        "  text-rendering: auto;",
        "}",
        ".fa-solid::before, .fas::before { content: var(--fa); }",
    ]
    for n in sorted(names):
        lines.append(f'.fa-{n} {{ --fa: "\\{table[n]:x}"; }}')
    open(os.path.join(OUT, "icons.css"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print(f"  icons.css                {len(names)} 個のアイコンを定義")


if __name__ == "__main__":
    main()
