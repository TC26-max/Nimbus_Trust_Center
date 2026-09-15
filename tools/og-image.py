#!/usr/bin/env python3
"""Generate backend/og-image.png (1200 x 630) from site.json. No city, no person name, no stock imagery."""
import json, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
site = json.load(open(os.path.join(ROOT, "backend", "site.json")))
W, H = 1200, 630
img = Image.new("RGB", (W, H), "#0b1220")
d = ImageDraw.Draw(img)

def font(size, bold=False):
    cands = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
             "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
             "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf"]
    for c in cands:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()

# subtle panel band
d.rounded_rectangle((60, 60, W - 60, H - 60), radius=28, fill="#111a2e", outline="#24344f", width=2)
# mark
cx, cy, r = 130, 150, 34
d.ellipse((cx - r, cy - r, cx + r, cy + r), outline="#93a4bc", width=6)
d.line((cx - 15, cy + 2, cx - 3, cy + 14), fill="#4fd1c5", width=9)
d.line((cx - 3, cy + 14, cx + 20, cy - 12), fill="#4fd1c5", width=9)
d.text((190, 118), site["name"], font=font(58, True), fill="#e7edf7")
d.text((192, 190), "Continuous assurance for a simulated company", font=font(30), fill="#93a4bc")
lines = ["Real controls, live evidence, governed AI.",
         "54 controls crosswalked to NIST CSF 2.0, CIS v8.1, SOC 2 and NIST AI RMF.",
         "AI systems with runtime permissions and a kill switch. A daily evidence job.",
         "One quantified loss scenario and a two-page board brief."]
y = 268
for i, t in enumerate(lines):
    d.text((130, y), t, font=font(30 if i == 0 else 25, i == 0), fill="#e7edf7" if i == 0 else "#b6c2d4")
    y += 52 if i == 0 else 40
# badges
bx = 130
for label, color in [("Real", "#4fd1c5"), ("Simulated", "#f6b13d"), ("Plain or Technical reader mode", "#93a4bc")]:
    f = font(22, True)
    tw = d.textlength(label, font=f)
    d.rounded_rectangle((bx, 480, bx + tw + 36, 524), radius=22, outline=color, width=3)
    d.text((bx + 18, 488), label, font=f, fill=color)
    bx += tw + 56
d.text((130, 556), "Privately built for demonstration and portfolio purposes only. Nimbus is fictional.", font=font(20), fill="#5b6b82")
out = os.path.join(ROOT, "backend", "og-image.png")
img.save(out, optimize=True)
print("wrote", out, os.path.getsize(out), "bytes")
