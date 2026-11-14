"""Builds the static TTF fonts of the app from the web's @fontsource variable files.

iOS and Android do not load WOFF2 and handle variable axes unevenly, so each weight the UI uses
becomes its own static TTF registered with expo-font (see src/ui/fonts.ts). Only the `latin`
subset is kept, as on the web (src/app/styles/base.css). Requires fontTools with brotli:

    python3 -m pip install 'fonttools[woff]'
    python3 apps/mobile/scripts/build-fonts.py   # from the repository root
"""

from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parents[1] / "assets" / "fonts"

# (source package, output family, {style name: weight})
FAMILIES = [
    ("manrope", "Manrope", {"Regular": 400, "Medium": 500, "SemiBold": 600, "Bold": 700}),
    ("fraunces", "Fraunces", {"Medium": 500}),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for package, family, styles in FAMILIES:
        source = ROOT / "node_modules" / "@fontsource-variable" / package / "files"
        source = source / f"{package}-latin-wght-normal.woff2"
        for style, weight in styles.items():
            font = TTFont(source)
            font.flavor = None
            static = instantiateVariableFont(font, {"wght": weight}, updateFontNames=False)
            name = static["name"]
            full = f"{family}-{style}"
            for record_id, value in ((1, full), (2, "Regular"), (4, full), (6, full)):
                name.setName(value, record_id, 3, 1, 0x409)
                name.setName(value, record_id, 1, 0, 0)
            static["OS/2"].usWeightClass = weight
            static.save(OUT / f"{full}.ttf")
            print(f"{full}.ttf")


if __name__ == "__main__":
    main()
