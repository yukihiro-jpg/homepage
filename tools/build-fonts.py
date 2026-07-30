#!/usr/bin/env python3
"""
Webフォントを「このサイトで実際に使う文字」だけに絞り込んで作り直すスクリプト。

■ なぜ必要か
  日本語フォントは約7,000文字あり、1ウェイトで1.9MBになる。そのため配布元
  （fontsource）は文字コード範囲ごとに121分割している。ところが日本語の文章は
  使う漢字が広い範囲に散らばるため、1ページ表示するのに85〜119本ものファイルを
  取得してしまい、表示が遅くなる（実測値）。
  このサイトは静的で内容が確定しているので、使う文字だけを詰めた1ウェイト1本の
  フォントに作り直したほうが、ファイル数も転送量も小さくなる。

■ 実行方法
      python3 tools/build-fonts.py
  fonts/src/ にある分割済みフォント（配布元のもの）を読み、
  fonts/kskac-*.woff2 と fonts/fonts.css を作り直す。

■ 重要：記事を追加・修正したら必ず実行すること
  収録していない文字が本文に現れると、その文字だけ別の書体で表示されてしまう。
  このスクリプトは最後に全ページの文字を照合し、漏れがあればエラーで止まる。
  （お問い合わせフォームに来訪者が入力した文字は対象外。入力欄だけは
    端末の書体になることがあるが、表示は崩れない）
"""
import glob
import os
import re
import shutil
import sys
import tempfile

from fontTools.merge import Merger
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "fonts", "src")
OUT = os.path.join(ROOT, "fonts")

JP_WEIGHTS = [400, 500, 700, 900]
EN_WEIGHTS = [300, 400, 500, 600, 700, 800]

# 常に収録する文字（本文に無くても入れておく）
BASIC = (
    set(chr(c) for c in range(0x20, 0x7F))       # ASCII
    | set(chr(c) for c in range(0x3041, 0x3097))  # ひらがな
    | set(chr(c) for c in range(0x30A0, 0x30FF))  # カタカナ
    | set(chr(c) for c in range(0xFF01, 0xFF5F))  # 全角英数記号
    | set("　、。，．・：；？！ー―‐〜…‥“”（）「」『』【】〔〕［］｛｝〈〉《》")
    | set("＋－±×÷＝≠＜＞≦≧％＃＆＊＠°′″℃￥＄§☆★○●◎◇◆□■△▲▽▼※〒→←↑↓")
    | set("①②③④⑤⑥⑦⑧⑨⑩ⅠⅡⅢⅣⅤ㎡№℡々〆〇")
)

ATTRS = r"(?:alt|aria-label|placeholder|title|data-en|data-label|content)"


def collect_chars():
    """サイト内で画面に表示される文字をすべて集める。"""
    chars = set()
    for f in sorted(glob.glob(os.path.join(ROOT, "*.html"))):
        h = open(f, encoding="utf-8").read()
        body = re.sub(r"<script[^>]*>.*?</script>", " ", h, flags=re.S)
        body = re.sub(r"<style[^>]*>.*?</style>", " ", body, flags=re.S)
        for a in re.findall(ATTRS + r'="([^"]*)"', body):
            chars.update(a)
        chars.update(re.sub(r"<[^>]+>", " ", body))
    for f in sorted(glob.glob(os.path.join(ROOT, "css", "*.css"))
                    + glob.glob(os.path.join(ROOT, "js", "*.js"))):
        s = open(f, encoding="utf-8").read()
        for m in re.findall(r'content:\s*"([^"]*)"', s):
            chars.update(m)
        for m in re.findall(r'"([^"\\\n]*)"', s):
            chars.update(m)
        for m in re.findall(r"'([^'\\\n]*)'", s):
            chars.update(m)
    return {c for c in chars if c.isprintable() and not c.isspace()}


def build_weight(sources, chars, dest):
    """分割済みフォントから必要な文字だけを取り出し、1本にまとめる。"""
    need = []
    for f in sources:
        cover = {chr(c) for c in TTFont(f, lazy=True).getBestCmap()}
        if cover & chars:
            need.append((f, cover))
    if not need:
        return None, 0
    tmp = tempfile.mkdtemp()
    try:
        parts = []
        for i, (f, cover) in enumerate(need):
            ft = TTFont(f)
            opt = Options()
            opt.layout_features = ["*"]
            opt.name_IDs = ["*"]
            opt.notdef_outline = True
            sub = Subsetter(options=opt)
            sub.populate(text="".join(sorted(cover & chars)))
            sub.subset(ft)
            p = os.path.join(tmp, f"{i:04d}.ttf")
            ft.flavor = None
            ft.save(p)
            parts.append(p)
        merged = os.path.join(tmp, "merged.ttf")
        if len(parts) == 1:
            shutil.copy(parts[0], merged)
        else:
            Merger().merge(parts).save(merged)
        ft = TTFont(merged)
        ft.flavor = "woff2"
        ft.save(dest)
    finally:
        shutil.rmtree(tmp)
    got = {chr(c) for c in TTFont(dest, lazy=True).getBestCmap()}
    return got, os.path.getsize(dest)


CSS_HEAD = """/* ============================================================
   自前ホスティングのWebフォント
   tools/build-fonts.py が自動生成します。直接編集しないでください。
   収録文字数: {n}（このサイトで使う文字＋かな・英数・記号）
   ============================================================ */
"""

FACE = """@font-face {{
  font-family: '{family}';
  font-style: normal;
  font-weight: {weight};
  font-display: swap;
  src: url('{path}') format('woff2');
}}
"""


def main():
    if not os.path.isdir(SRC):
        sys.exit(f"元のフォントが見つかりません: {SRC}")

    site = collect_chars()
    chars = site | BASIC
    print(f"収録対象: {len(chars)} 文字（サイト内で使用 {len(site)}）")

    css = [CSS_HEAD.format(n=len(chars))]
    covered = set()
    total = 0

    print("\n=== 日本語（Zen Kaku Gothic New）===")
    for w in JP_WEIGHTS:
        src = sorted(glob.glob(os.path.join(SRC, "zen-kaku-gothic-new", "**", f"*-{w}-normal.woff2"), recursive=True))
        dest = os.path.join(OUT, f"kskac-jp-{w}.woff2")
        got, size = build_weight(src, chars, dest)
        if got is None:
            sys.exit(f"元のフォントが見つかりません: {os.path.join(SRC, 'zen-kaku-gothic-new')} の weight {w}")
        covered |= got
        total += size
        print(f"  kskac-jp-{w}.woff2  {size/1024:6.0f} KB  {len(got & chars)} 文字")
        css.append(FACE.format(family="Zen Kaku Gothic New", weight=w,
                               path=f"kskac-jp-{w}.woff2"))

    print("=== 英字（Outfit）===")
    for w in EN_WEIGHTS:
        src = sorted(glob.glob(os.path.join(SRC, "outfit", "**", f"*-{w}-normal.woff2"), recursive=True))
        dest = os.path.join(OUT, f"kskac-en-{w}.woff2")
        got, size = build_weight(src, chars, dest)
        if got is None:
            sys.exit(f"元のフォントが見つかりません: {os.path.join(SRC, 'outfit')} の weight {w}")
        total += size
        print(f"  kskac-en-{w}.woff2  {size/1024:6.0f} KB  {len(got & chars)} 文字")
        css.append(FACE.format(family="Outfit", weight=w,
                               path=f"kskac-en-{w}.woff2"))

    with open(os.path.join(OUT, "fonts.css"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(css))

    n_files = len(JP_WEIGHTS) + len(EN_WEIGHTS)
    print(f"\n生成: {n_files} 本 / 合計 {total/1024:.0f} KB")

    # ---- 照合 ----
    # 元フォント（fonts/src）が持っている文字を集計する
    src_cover = set()
    for f in glob.glob(os.path.join(SRC, "**", "*.woff2"), recursive=True):
        src_cover |= {chr(c) for c in TTFont(f, lazy=True).getBestCmap()}

    # ① 元フォントにあるのに収録できなかった文字 → 不具合なので中断
    lost = sorted((site & src_cover) - covered - BASIC)
    lost = [c for c in lost if ord(c) > 0x7F]
    if lost:
        print("\n★ 収録漏れ（元フォントにはある文字）:", "".join(lost))
        sys.exit(1)

    # ② 元フォント自体に無い文字 → 端末の書体で表示される。お知らせのみ
    absent = sorted(c for c in site - src_cover if ord(c) > 0x7F)
    if absent:
        print("\n△ 元フォントに存在しないため端末の書体で表示される文字:",
              "".join(absent))
        print("  （置き換えられる文字があれば本文を修正してください）")
    print("\n照合: 収録漏れなし ✔")


if __name__ == "__main__":
    main()
