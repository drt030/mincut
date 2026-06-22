from __future__ import annotations

from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont


OUT = Path(__file__).parent
W, H = 430, 900
H_AC = 1320

INK = "#162033"
MUTED = "#667085"
LINE = "#D8DDD5"
PAPER = "#FBFCF9"
BG = "#EEF1F3"
WHITE = "#FFFFFF"
ROSE = "#FFF1F2"
ROSE_LINE = "#F0B6BB"
AMBER = "#FFFAF0"
AMBER_LINE = "#D8C6A8"
BLUE = "#EEF5FF"
BLUE_LINE = "#C8D9F2"
SOFT = "#F6F8F5"


def font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/Users/wth/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/lib/python3.11/site-packages/matplotlib/mpl-data/fonts/ttf/DejaVuSans.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size, index=0)
            except OSError:
                pass
    return ImageFont.load_default()


F = {
    "eyebrow": font(12),
    "h1": font(24),
    "body": font(13),
    "small": font(11),
    "label": font(12),
    "strong": font(15),
    "row": font(13),
}


def draw_text(draw: ImageDraw.ImageDraw, xy, text: str, fill: str, fnt, max_width: int, line_gap: int = 4) -> int:
    x, y = xy
    lines = []
    current = ""
    # Simple CJK-aware wrapping by measured width.
    for ch in text:
        trial = current + ch
        if draw.textbbox((0, 0), trial, font=fnt)[2] <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = ch
    if current:
        lines.append(current)
    for line in lines:
        draw.text((x, y), line, fill=fill, font=fnt)
        y += draw.textbbox((0, 0), line, font=fnt)[3] + line_gap
    return y


def rounded(draw, box, fill, outline=LINE, radius=8, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def divider(draw, y):
    draw.line((24, y, W - 24, y), fill=LINE, width=1)


def tile(draw, box, label, main, note="", fill=WHITE, outline=LINE):
    rounded(draw, box, fill, outline)
    x0, y0, x1, _ = box
    y = y0 + 11
    draw.text((x0 + 12, y), label, fill=MUTED, font=F["label"])
    y += 23
    y = draw_text(draw, (x0 + 12, y), main, INK, F["strong"], x1 - x0 - 24, 3)
    if note:
        draw_text(draw, (x0 + 12, y + 3), note, MUTED, F["small"], x1 - x0 - 24, 3)


def header(draw, eyebrow, title, summary):
    y = 26
    draw.text((24, y), eyebrow, fill=MUTED, font=F["eyebrow"])
    y += 24
    draw.text((24, y), title, fill=INK, font=F["h1"])
    y += 42
    draw.rectangle((24, y, 27, y + 63), fill="#28364F")
    y = draw_text(draw, (37, y - 2), summary, "#243044", F["body"], W - 61, 5)
    return y + 16


def section_title(draw, y, title, meta):
    divider(draw, y)
    y += 19
    draw.text((24, y), title, fill=INK, font=F["row"])
    tw = draw.textbbox((0, 0), meta, font=F["small"])[2]
    draw.text((W - 24 - tw, y + 2), meta, fill=MUTED, font=F["small"])
    return y + 32


def core_readout(draw, y, mode: str):
    if mode == "a":
        data = [
            ("卡点判断", "卡点集中在 HBM、先进封装、先进制程产能", "", ROSE, ROSE_LINE),
            ("主导原因", "组件可得性 · 产能/规模化", "", WHITE, LINE),
            ("商业规模", "估算成本：est. RMB 80M", "模型/汇总值；仍需报价验证", AMBER, AMBER_LINE),
            ("缓解周期", "估算 24 个月", "来自直接子节点最长周期", BLUE, BLUE_LINE),
        ]
    elif mode == "b":
        data = [
            ("卡点判断", "供给链卡点图，不是单点性能图", "", ROSE, ROSE_LINE),
            ("主导原因", "产能排队、良率爬坡、关键材料/设备周期", "", WHITE, LINE),
            ("商业规模", "est. RMB 80M 级别", "系统级物料和封装汇总估算", AMBER, AMBER_LINE),
            ("缓解周期", "18–24 个月", "扩产/认证/设备交付为主", BLUE, BLUE_LINE),
        ]
    else:
        data = [
            ("卡点判断", "强卡点", "HBM / 封装 / 先进制程共同决定放量", ROSE, ROSE_LINE),
            ("主导原因", "产能和可得性", "不是成本本身，也不是成熟度标签", WHITE, LINE),
            ("商业规模", "est. RMB 80M", "系统级模型值", AMBER, AMBER_LINE),
            ("缓解周期", "约 24 个月", "取直接约束中的最长周期", BLUE, BLUE_LINE),
        ]
    x1, x2 = 24, 219
    boxes = [(x1, y, x1 + 187, y + 118), (x2, y, x2 + 187, y + 118), (x1, y + 126, x1 + 187, y + 244), (x2, y + 126, x2 + 187, y + 244)]
    for b, d in zip(boxes, data):
        tile(draw, b, *d)
    return y + 264


def row(draw, y, title, body):
    draw.line((24, y, W - 24, y), fill="#E5E8E1", width=1)
    y += 11
    draw.text((24, y), title, fill=INK, font=F["row"])
    y += 22
    y = draw_text(draw, (24, y), body, "#344054", F["body"], W - 48, 4)
    return y + 10


def priority(draw, y, title, body):
    rounded(draw, (24, y, W - 24, y + 92), WHITE, "#EDF0EC")
    draw.text((38, y + 13), title, fill=INK, font=F["row"])
    draw_text(draw, (38, y + 37), body, "#344054", F["body"], W - 76, 4)
    return y + 112


def option_a():
    img = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    y = header(draw, "完整系统 · AI 芯片/GPU计算模组", "系统概览", "先回答这张图的核心问题：扩张卡在哪里、为什么卡、商业规模多大、缓解周期多长。")
    y = section_title(draw, y, "系统核心读数", "Overview")
    y = core_readout(draw, y, "a")
    y = section_title(draw, y, "关键评点", "Why this matters")
    y = row(draw, y, "HBM 是最先应该看的分支", "存储容量、堆叠良率、测试能力和供应集中度共同限制放量。")
    y = row(draw, y, "先进封装决定模组能不能合成", "CoWoS/2.5D 封装、硅中介层、基板和检测设备共同影响交付节奏。")
    y = row(draw, y, "先进制程产能是上游硬约束", "EUV、光掩膜、光刻胶、计量和 TSMC 产能共同影响逻辑 die 供应。")
    y = section_title(draw, y, "建议优先查看", "Next")
    priority(draw, y, "高带宽存储器 (HBM)", "从这里下钻到堆叠供应、测试产能、组装良率和供应商暴露。")
    img.save(OUT / "option-a-brief-first.png")


def option_b():
    img = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    y = header(draw, "完整系统 · AI 芯片/GPU计算模组", "系统概览", "把右侧 rail 当成读图目录：先读系统判断，再沿主线链路进入具体节点。")
    y = section_title(draw, y, "系统核心读数", "2 × 2")
    y = core_readout(draw, y, "b")
    y = section_title(draw, y, "主线链路", "Read order")
    steps = [
        ("1", "逻辑 die 制造", "先进制程产能、EUV、光掩膜和计量能力。"),
        ("2", "先进封装", "CoWoS/2.5D、硅中介层、基板和贴装检测。"),
        ("3", "HBM 堆叠与测试", "供应集中度、良率、测试设备和交付节奏。"),
    ]
    for n, title, body in steps:
        rounded(draw, (24, y, 48, y + 24), INK, INK, 12)
        draw.text((32, y + 4), n, fill=WHITE, font=F["small"])
        draw.text((58, y), title, fill=INK, font=F["row"])
        y = draw_text(draw, (58, y + 24), body, "#344054", F["body"], W - 82, 4) + 14
    y = section_title(draw, y, "关键评点", "Evidence-aware")
    x, yy = 24, y
    for label in ["产能约束", "供应集中", "设备长周期", "证据待补强"]:
        tw = draw.textbbox((0, 0), label, font=F["label"])[2] + 22
        rounded(draw, (x, yy, x + tw, yy + 28), "#EEF2EE", "#EEF2EE", 14)
        draw.text((x + 11, yy + 7), label, fill="#344054", font=F["label"])
        x += tw + 8
        if x > W - 120:
            x, yy = 24, yy + 36
    img.save(OUT / "option-b-route-reading.png")


def option_c():
    img = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    y = header(draw, "完整系统 · AI 芯片/GPU计算模组", "系统概览", "更像研究员的 brief：少一点引导语，多一点可扫描的系统判断和下一步。")
    y = section_title(draw, y, "核心读数", "System brief")
    y = core_readout(draw, y, "c")
    y = section_title(draw, y, "系统判断", "One screen")
    table = [
        ("最该先看", "HBM：容量、堆叠良率、测试产能、供应集中"),
        ("第二层", "先进封装：CoWoS、硅中介层、基板、检测设备"),
        ("上游硬约束", "先进制程代工产能与 EUV 生态"),
        ("数据状态", "成本/供应商仍需要报价和证据补强"),
    ]
    rounded(draw, (24, y, W - 24, y + 184), WHITE, "#EDF0EC")
    yy = y
    for left, right in table:
        if yy > y:
            draw.line((24, yy, W - 24, yy), fill="#EDF0EC", width=1)
        draw.rectangle((25, yy + 1, 136, yy + 45), fill=SOFT)
        draw.text((36, yy + 15), left, fill=MUTED, font=F["label"])
        draw_text(draw, (146, yy + 11), right, INK, F["body"], W - 170, 3)
        yy += 46
    y += 204
    y = section_title(draw, y, "下钻入口", "No duplicate detail CTA")
    y = row(draw, y, "高带宽存储器 (HBM)", "进入节点详情，检查堆叠供应、测试设备、良率和公司暴露。")
    y = row(draw, y, "先进制程代工产能", "进入节点详情，检查 EUV、光掩膜、光刻胶和产能分配。")
    row(draw, y, "先进封装", "进入节点详情，检查 CoWoS/2.5D、基板和检测设备。")
    img.save(OUT / "option-c-dense-brief.png")


def option_ac():
    img = Image.new("RGB", (W, H_AC), PAPER)
    draw = ImageDraw.Draw(img)
    y = header(draw, "完整系统 · AI 芯片/GPU计算模组", "系统概览", "AI 计算模组的主要矛盾不是需求不足，而是多环节供给能力能否同步扩张并稳定交付。")
    y = section_title(draw, y, "系统核心读数", "Overview")
    data = [
        ("卡点判断", "系统级强卡点", "约束来自多环节供给能力的同步扩张", ROSE, ROSE_LINE),
        ("主导原因", "产能和可得性", "不是单项性能，也不是单一公司问题", WHITE, LINE),
        ("商业含义", "需求强，交付受限", "商业价值取决于扩产节奏和供应稳定性", AMBER, AMBER_LINE),
        ("证据状态", "结论可支撑", "由多环节供给和交付信号共同指向", BLUE, BLUE_LINE),
    ]
    x1, x2 = 24, 219
    boxes = [(x1, y, x1 + 187, y + 118), (x2, y, x2 + 187, y + 118), (x1, y + 126, x1 + 187, y + 244), (x2, y + 126, x2 + 187, y + 244)]
    for b, d in zip(boxes, data):
        tile(draw, b, *d)
    y += 264
    y = section_title(draw, y, "系统读法", "TOC lens")
    table = [
        ("系统目标", "把 GPU 计算芯片、高带宽内存、先进封装和测试产能组合成可稳定交付的数据中心算力模组。"),
        ("生产路径", "先制造 GPU 计算芯片和 HBM 内存，再把芯片与内存放到基板/中介层上做先进封装，最后经过测试成为可出货模组。"),
        ("约束机制", "GPU 芯片制造完成后，还要和 HBM 一起封装并通过测试；封装窗口、内存配给或终测良率不足都会让成品出货受限。"),
        ("提升路径", "当前最需要改善的是芯片到完整模组的后段转换能力：HBM 配套、先进封装产能、基板/中介层供给和终测良率要一起提升。"),
        ("产业链影响", "资源会向 HBM 供应、先进封装、ABF/高阶基板、测试检测设备和封装设备集中；这些位置更容易获得订单、涨价和扩产预算。"),
        ("主要风险", "只扩晶圆产能但后段配套不扩，会造成芯片在封装、内存或测试环节排队；需求预期回落则会反向压缩扩产节奏。"),
        ("证据支持", "现有证据支持 HBM 供给、CoWoS/先进封装、基板/中介层和后段测试是关键约束来源；公司暴露在节点详情中展开。"),
    ]
    row_h = 98
    rounded(draw, (24, y, W - 24, y + row_h * len(table)), WHITE, "#EDF0EC")
    yy = y
    for left, right in table:
        if yy > y:
            draw.line((24, yy, W - 24, yy), fill="#EDF0EC", width=1)
        draw.rectangle((25, yy + 1, 136, yy + row_h - 1), fill=SOFT)
        draw.text((36, yy + 15), left, fill=MUTED, font=F["label"])
        draw_text(draw, (146, yy + 11), right, INK, F["body"], W - 170, 3)
        yy += row_h
    img.save(OUT / "option-ac-merged.png")


if __name__ == "__main__":
    option_a()
    option_b()
    option_c()
    option_ac()
