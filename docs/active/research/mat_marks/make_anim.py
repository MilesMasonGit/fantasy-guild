# Assembles the chroma frames for the mat marks page (called by capture_mat_marks.mjs):
#   python make_anim.py <frames dir> <out animated png> <out strip png> <ms per frame>
# The animated PNG loops every frame; the strip shows four of them (every quarter of the cycle)
# side by side with a gap.
import sys
from pathlib import Path
from PIL import Image

frames_dir, out_anim, out_strip, ms = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])
frames = [Image.open(p).convert('RGBA') for p in sorted(Path(frames_dir).glob('*.png'))]
frames[0].save(out_anim, save_all=True, append_images=frames[1:], duration=int(ms), loop=0, disposal=1)

pick = [frames[i * len(frames) // 4] for i in range(4)]
gap = 12
w, h = pick[0].size
strip = Image.new('RGBA', (w * 4 + gap * 3, h), (0, 0, 0, 0))
for i, f in enumerate(pick):
    strip.paste(f, (i * (w + gap), 0))
strip.save(out_strip)
