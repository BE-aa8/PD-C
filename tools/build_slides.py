"""Render the presentation deck into the website's slide viewer images.

Usage: python3 tools/build_slides.py DECK.pptx DECK.pdf
  DECK.pdf is the deck exported to PDF (PowerPoint: File > Export > PDF, or LibreOffice --convert-to pdf).
Writes site/slides/slide-NN.webp (1600 px wide) and copies both files into site/slides/ for download.
If the number of slides changes, update site/js/slides.js to match. Needs pdftoppm (poppler) and Pillow.
"""
import glob, os, shutil, subprocess, sys, tempfile
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'site', 'slides')

def main(pptx, pdf):
    os.makedirs(OUT, exist_ok=True)
    for old in glob.glob(os.path.join(OUT, 'slide-*.webp')):
        os.remove(old)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['pdftoppm', '-r', '160', '-png', pdf, os.path.join(tmp, 's')], check=True)
        pages = sorted(glob.glob(os.path.join(tmp, 's-*.png')))
        for i, f in enumerate(pages, 1):
            im = Image.open(f).convert('RGB')
            im = im.resize((1600, round(im.size[1] * 1600 / im.size[0])), Image.LANCZOS)
            im.save(os.path.join(OUT, 'slide-%02d.webp' % i), 'WEBP', quality=80, method=6)
    shutil.copyfile(pdf, os.path.join(OUT, 'closing-the-loop-slides.pdf'))
    shutil.copyfile(pptx, os.path.join(OUT, 'closing-the-loop-slides.pptx'))
    print(f'{len(pages)} slides written to site/slides/')

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
