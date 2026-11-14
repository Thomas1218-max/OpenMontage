"""Beat grid + per-bar energy for a music track, and a beat-snapped timeline for promo.json.

usage:
  python -I analyze_music.py <track.mp3>                       # tempo + energy per bar (find dips -> drops)
  python -I analyze_music.py <track.mp3> --start 35.94 \
      --beats 5,4,7,4,6 --photos 5 --photo-beats 2 --cta-beats 7 --outro-beats 2
      # prints {"S1":..,"END":..,"PHOTO":..} to paste into promo.json "timeline"
Shot beats are S1..S5 lengths; S6 = photos x photo-beats; S7 = cta-beats.
Pick --start so a quiet bar -> loud bar change lands on S6 (portfolio) = the "drop".
"""
import argparse, json
import librosa, numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("track")
ap.add_argument("--start", type=float)
ap.add_argument("--beats")
ap.add_argument("--photos", type=int, default=5)
ap.add_argument("--photo-beats", type=int, default=2)
ap.add_argument("--cta-beats", type=int, default=7)
ap.add_argument("--outro-beats", type=int, default=2)
a = ap.parse_args()

y, sr = librosa.load(a.track, sr=22050)
tempo, bt = librosa.beat.beat_track(y=y, sr=sr, units="time")
ibi = float(np.median(np.diff(bt)))
print(f"duration {len(y)/sr:.1f}s  tempo {float(np.atleast_1d(tempo)[0]):.1f} BPM  beat {ibi:.3f}s = {ibi*30:.1f} frames")
if a.start is None:
    rms = librosa.feature.rms(y=y)[0]; t = librosa.times_like(rms, sr=sr)
    print("bar start  energy   (look for a dip followed by a jump = drop)")
    for i in range(0, len(bt) - 4, 4):
        e = float(np.mean(rms[(t >= bt[i]) & (t < bt[i + 4])]))
        print(f"{bt[i]:7.2f}  {e:.3f}  " + "#" * int(e * 200))
else:
    i0 = int(np.argmin(abs(bt - a.start))); t0 = bt[i0]
    v = bt[i0:] - t0
    counts = [int(x) for x in a.beats.split(",")] + [a.photos * a.photo_beats, a.cta_beats]
    idx = np.cumsum([0] + counts)
    names = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "END"]
    tl = {n: int(round(v[k] * 30)) for n, k in zip(names, idx)}
    tl["OUTRO"] = int(round(v[idx[-1] - a.outro_beats] * 30))
    tl["PHOTO"] = int(round((tl["S7"] - tl["S6"]) / a.photos))
    print(f"snapped start = {t0:.3f}s (use as music.start)")
    print(json.dumps(tl))
    print(f"total {tl['END']/30:.2f}s")
