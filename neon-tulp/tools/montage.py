"""Build edited montages with ffmpeg: Ken Burns stills, trimmed clips, xfade transitions,
colour grade, optional kinetic titles, optional seamless loop."""
import subprocess, sys, os, json, tempfile

FPS = 25

def build(spec, out, W, H, T=0.8, grade="", titles=(), loop=False, crf=27, fontdir=""):
    inputs, chains = [], []
    for i, shot in enumerate(spec):
        d = shot["dur"]
        if shot["kind"] == "img":
            frames = int(round(d * FPS))
            z0, z1 = shot.get("zoom", (1.0, 1.12))
            px, py = shot.get("pan", (0.5, 0.5))      # focal point 0..1
            dx, dy = shot.get("drift", (0.0, 0.0))    # drift of focal point over the shot
            inputs += ["-i", shot["src"]]
            BW, BH = W * 3, H * 3
            zexpr = f"{z0}+({z1}-{z0})*on/{frames}"
            xexpr = f"max(0,min(iw-iw/zoom,(iw*({px}+{dx}*on/{frames}))-iw/zoom/2))"
            yexpr = f"max(0,min(ih-ih/zoom,(ih*({py}+{dy}*on/{frames}))-ih/zoom/2))"
            chains.append(
                f"[{i}:v]scale={BW}:{BH}:force_original_aspect_ratio=increase,crop={BW}:{BH},"
                f"zoompan=z='{zexpr}':x='{xexpr}':y='{yexpr}':d={frames}:s={W}x{H}:fps={FPS},"
                f"{shot.get('fx','null')},setsar=1,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[s{i}]")
        else:
            inputs += ["-ss", str(shot.get("start", 0)), "-t", str(d), "-i", shot["src"]]
            speed = shot.get("speed", 1.0)
            chains.append(
                f"[{i}:v]fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                f"setpts={1/speed}*(PTS-STARTPTS),{shot.get('fx','null')},trim=duration={d},"
                f"setsar=1,format=yuv420p,settb=AVTB,setpts=PTS-STARTPTS[s{i}]")
    # xfade chain
    prev, acc = "s0", spec[0]["dur"]
    for i in range(1, len(spec)):
        tr = spec[i].get("tr", "fade")
        off = acc - T
        lab = f"x{i}"
        chains.append(f"[{prev}][s{i}]xfade=transition={tr}:duration={T}:offset={off:.3f}[{lab}]")
        prev, acc = lab, acc + spec[i]["dur"] - T
    total = acc
    last = prev
    if grade:
        chains.append(f"[{last}]{grade}[g]"); last = "g"
    # titles (drawtext, timed on absolute montage time)
    for k, ttl in enumerate(titles):
        t0, t1 = ttl["t"]
        fi = 0.45
        tf = tempfile.NamedTemporaryFile("w", delete=False, suffix=".txt", dir=tempfile.gettempdir() if not os.environ.get("TXTDIR") else os.environ["TXTDIR"])
        tf.write(ttl["text"]); tf.close()
        alpha = (f"if(lt(t,{t0}),0,if(lt(t,{t0+fi}),(t-{t0})/{fi},"
                 f"if(lt(t,{t1-fi}),1,if(lt(t,{t1}),({t1}-t)/{fi},0))))")
        rise = ttl.get("rise", 40)
        ease = f"pow(max(0,1-min(1,(t-{t0})/0.9)),3)"
        y = ttl["y"].replace("RISE", f"({rise}*{ease})")
        x = ttl["x"].replace("SLIDE", f"({ttl.get('slide',0)}*{ease})")
        op = ttl.get("opacity", 1)
        chains.append(
            f"[{last}]drawtext=fontfile={os.path.join(fontdir, ttl['font'])}:textfile={tf.name}:"
            f"shadowcolor=black@0.5:shadowx=0:shadowy=4:fontsize={ttl['size']}:fontcolor={ttl.get('color','white')}:"
            f"alpha='{op}*{alpha}':x='{x}':y='{y}':enable='between(t,{t0},{t1})'"
            + (f":line_spacing={ttl['ls']}" if 'ls' in ttl else "")
            + f"[t{k}]")
        last = f"t{k}"
    if loop:
        F = loop
        chains.append(f"[{last}]split[la][lb]")
        chains.append(f"[la]trim=start={F},setpts=PTS-STARTPTS[la2]")
        chains.append(f"[lb]trim=duration={F},setpts=PTS-STARTPTS[lb2]")
        chains.append(f"[la2][lb2]xfade=transition=fade:duration={F}:offset={total-2*F:.3f}[lp]")
        last = "lp"; total -= F
    cmd = ["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(chains),
           "-map", f"[{last}]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", str(crf),
           "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart",
           "-t", f"{total:.3f}", out]
    print(f"-> {out}  ({total:.1f}s)")
    subprocess.run(cmd, check=True)

if __name__ == "__main__":
    cfg = json.load(open(sys.argv[1]))
    for job in cfg["jobs"]:
        build(job["spec"], job["out"], job["W"], job["H"], job.get("T", 0.8), job.get("grade", ""),
              job.get("titles", ()), job.get("loop", False), job.get("crf", 27), cfg.get("fontdir", ""))
