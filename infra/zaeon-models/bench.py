# Mede tok/s direto no Ollama (eval_count/eval_duration). Uso: bench.py <modelo> <num_thread> [prompt]
import json, sys, time, urllib.request as u
m, nt = sys.argv[1], int(sys.argv[2])
p = sys.argv[3] if len(sys.argv) > 3 else "Explique recursão em 3 frases."
t = time.time()
r = u.Request("http://ollama:11434/api/generate", json.dumps({"model": m, "prompt": p, "stream": False,
    "options": {"num_thread": nt, "num_predict": 200}}).encode(), {"Content-Type": "application/json"})
d = json.loads(u.urlopen(r, timeout=900).read())
ev = d["eval_count"] / (d["eval_duration"] / 1e9)
pe = d.get("prompt_eval_count", 0) / max(d.get("prompt_eval_duration", 1) / 1e9, 1e-9)
print(f"{m} threads={nt} eval={ev:.1f} tok/s prompt={pe:.1f} tok/s tokens={d['eval_count']} load={d.get('load_duration', 0) / 1e9:.1f}s wall={time.time() - t:.0f}s")
