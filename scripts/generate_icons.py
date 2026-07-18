"""One-off generator for the AI老友記 PWA manifest icons (192x192, 512x512 PNG),
replacing the unmodified Vite-scaffold defaults. Not part of any build step --
run manually whenever the icon design needs to change; the PNG output is what
gets committed to app/public/.

Uses the app's existing palette: #2f6f4f (primary green) background,
#faf8f4 (cream) foreground -- same colors used everywhere else in the app
(see app/src/styles/global.css).
"""

from PIL import Image, ImageDraw, ImageFont

GREEN = "#2f6f4f"
CREAM = "#faf8f4"
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def make_icon(size):
    img = Image.new("RGB", (size, size), GREEN)
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_PATH, int(size * 0.42))
    text = "AI"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - text_w) / 2 - bbox[0]
    y = (size - text_h) / 2 - bbox[1]
    draw.text((x, y), text, fill=CREAM, font=font)
    return img


if __name__ == "__main__":
    make_icon(192).save("app/public/icon-192.png")
    make_icon(512).save("app/public/icon-512.png")
    print("Wrote app/public/icon-192.png and app/public/icon-512.png")
