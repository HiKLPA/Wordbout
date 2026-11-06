"""思源黑体（Noto Sans SC）子集化脚本。

为什么子集化：完整 Noto Sans SC 每个字重约 10.5MB，多档合计 30MB+，
不适合打进移动端包。子集到「GB2312 全部汉字 + 全角标点 + 仓库出现过的字符 + ASCII」
后每档约 1MB，App 显示的汉字 100% 命中所选字体，生僻字自动回退系统字体。

字重口径（2026-10-10 起）：全 App 只用 **500（Medium）/ 600（SemiBold）/ 700（Bold）** 三档
—— 最低 500、最高 700。原来的 400 / 800 / 900 已不再产出。

用法：
    python scripts/fonts-subset.py
输入：
    node_modules/@expo-google-fonts/noto-sans-sc/<weight>/NotoSansSC_*.ttf
输出：
    assets/fonts/NotoSansSC-<weight>.ttf
"""

import io
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PKG = os.path.join(ROOT, "node_modules", "@expo-google-fonts", "noto-sans-sc")
OUT_DIR = os.path.join(ROOT, "assets", "fonts")
CHARSET_FILE = os.path.join(ROOT, ".tmp", "font-charset.txt")

WEIGHTS = [
    ("500Medium", "NotoSansSC_500Medium.ttf", "NotoSansSC-500Medium.ttf"),
    ("600SemiBold", "NotoSansSC_600SemiBold.ttf", "NotoSansSC-600SemiBold.ttf"),
    ("700Bold", "NotoSansSC_700Bold.ttf", "NotoSansSC-700Bold.ttf"),
]

SKIP_DIRS = {"node_modules", ".git", ".expo", ".tmp", "assets", "fig_design", "icon_file"}


def gb2312_chars() -> set:
    """GB2312 全表 6763 个汉字（含符号区），覆盖日常中文写作的绝大多数用字"""
    chars = set()
    for hi in range(0xB0, 0xF8):
        for lo in range(0xA1, 0xFF):
            try:
                chars.add(bytes([hi, lo]).decode("gb2312"))
            except UnicodeDecodeError:
                pass
    return chars


def repo_chars() -> set:
    """仓库源码里出现过的所有非 ASCII 字符（界面文案、词库、文章、繁体表）"""
    chars = set()
    for base, dirs, names in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in names:
            if not name.endswith((".ts", ".tsx", ".mjs", ".js", ".json")):
                continue
            try:
                with io.open(os.path.join(base, name), encoding="utf-8") as fh:
                    chars |= {c for c in fh.read() if ord(c) > 0x7F}
            except (UnicodeDecodeError, OSError):
                continue
    return chars


def build_charset() -> list:
    chars = gb2312_chars() | repo_chars()
    ascii_chars = {chr(c) for c in range(0x20, 0x7F)}
    return sorted(chars | ascii_chars)


def subset(src: str, dst: str, text_file: str) -> None:
    cmd = [
        sys.executable,
        "-m",
        "fontTools.subset",
        src,
        f"--output-file={dst}",
        f"--text-file={text_file}",
        # 只保留 kern，其余排版特性（vert/palt 等）在本 App 用不到；
        # 实测这一组参数与 --layout-features=* 体积相同（字形数据占绝对多数）。
        "--layout-features=kern",
        "--name-IDs=*",
        "--name-legacy",
        "--name-languages=*",
        "--notdef-glyph",
        "--notdef-outline",
        "--recommended-glyphs",
    ]
    subprocess.run(cmd, check=True)


def to_woff2(ttf: str, dst: str) -> None:
    """同一份子集再压成 woff2（web 端只拉这个，传输量约为 ttf 的 1/3）"""
    from fontTools.ttLib import TTFont

    font = TTFont(ttf)
    font.flavor = "woff2"
    font.save(dst)
    font.close()


def verify(dst: str, chars: list) -> None:
    """自检：确认字符集里的每个字符都真的落在产物 cmap 里（缺字会被系统字体接管，肉眼看不出来）"""
    from fontTools.ttLib import TTFont

    cmap = TTFont(dst, lazy=True).getBestCmap()
    missing = [c for c in chars if ord(c) not in cmap]
    if missing:
        print(f"  缺字 {len(missing)} 个（源字体本身没有，将回退系统字体）：{''.join(missing[:20])}")
    else:
        print("  缺字 0，字符集全覆盖")


def main() -> int:
    if not os.path.isdir(SRC_PKG):
        print(f"缺少源字体包：{SRC_PKG}\n请先 npm i -D @expo-google-fonts/noto-sans-sc", file=sys.stderr)
        return 1

    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(CHARSET_FILE), exist_ok=True)

    chars = build_charset()
    with io.open(CHARSET_FILE, "w", encoding="utf-8", newline="") as fh:
        fh.write("".join(chars))
    print(f"字符集：{len(chars)} 个")

    for weight_dir, src_name, dst_name in WEIGHTS:
        src = os.path.join(SRC_PKG, weight_dir, src_name)
        dst = os.path.join(OUT_DIR, dst_name)
        if not os.path.isfile(src):
            print(f"跳过（缺文件）：{src}", file=sys.stderr)
            continue
        subset(src, dst, CHARSET_FILE)
        print(f"{weight_dir}: {os.path.getsize(src) / 1048576:.1f}MB → {os.path.getsize(dst) / 1048576:.2f}MB  {dst_name}")
        verify(dst, chars)
        woff2 = os.path.splitext(dst)[0] + ".woff2"
        to_woff2(dst, woff2)
        print(f"  web: {os.path.getsize(woff2) / 1048576:.2f}MB  {os.path.basename(woff2)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
