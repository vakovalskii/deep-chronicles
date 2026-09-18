"""Restore the existing OCR production containers without rebuilding or touching volumes.

Executed remotely by ocr-box.mjs. Output contains only health and synthetic test data.
"""
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

CONTAINERS = [
    "ocr_service-mongo-1", "ocr_service-minio-1", "ocr_service-vllm-1",
    "ocr_service-traefik-1", "ocr_service-worker-1",
    "ocr_service-api-1", "ocr_service-api-2",
]
BASE = "http://127.0.0.1:8090"


def inspect(name):
    return json.loads(subprocess.check_output(["docker", "inspect", name]))[0]


def request(route, data=None, headers=None, timeout=10):
    req = urllib.request.Request(BASE + route, data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.status, json.load(response)


def status():
    containers = {}
    for name in CONTAINERS + ["trellis2-api"]:
        d = inspect(name)
        containers[name] = {
            "state": d["State"]["Status"],
            "health": d["State"].get("Health", {}).get("Status", "none"),
            "restarts": d["RestartCount"],
        }
    endpoints = {}
    for path in ["/healthz", "/readyz", "/api/v1/profile"]:
        try:
            code, result = request(path, timeout=5)
            endpoints[path] = {"http": code, **{k: result[k] for k in ["status", "ready", "model", "runtime", "model_profile"] if k in result}}
        except urllib.error.HTTPError as error:
            endpoints[path] = {"http": error.code}
        except (OSError, ValueError):
            endpoints[path] = {"http": 0}
    ready = all(containers[name]["state"] == "running" and containers[name]["health"] in ["healthy", "none"] for name in CONTAINERS)
    ready = ready and containers["trellis2-api"]["state"] != "running" and all(v["http"] == 200 for v in endpoints.values())
    report = {"ready": ready, "containers": containers, "endpoints": endpoints}
    print(json.dumps(report), flush=True)
    return ready


def restore():
    # Refuse an unrelated or missing stack before making any changes.
    for name in CONTAINERS:
        labels = inspect(name)["Config"].get("Labels") or {}
        if labels.get("com.docker.compose.project") != "ocr_service":
            raise RuntimeError("Unexpected OCR container ownership")
    generator = inspect("trellis2-api")
    if generator["State"]["Running"]:
        if not any(m["Source"].endswith("/trellis2/work-l2") and m["Destination"] == "/work" for m in generator["Mounts"]):
            raise RuntimeError("Generator does not belong to this game")
        with urllib.request.urlopen("http://127.0.0.1:8765/health", timeout=5) as r:
            health = json.load(r)
        with urllib.request.urlopen("http://127.0.0.1:8765/jobs", timeout=5) as r:
            jobs = json.load(r)
        jobs = jobs.values() if isinstance(jobs, dict) else jobs
        if health.get("queue") != 0 or any(j.get("status") in ["queued", "running"] for j in jobs if isinstance(j, dict)):
            raise RuntimeError("Generation is active; refusing to discard a job")
        subprocess.run(["docker", "stop", "--timeout", "15", "trellis2-api"], check=True, timeout=25)
    for name in CONTAINERS:
        if not inspect(name)["State"]["Running"]:
            subprocess.run(["docker", "start", name], check=True, timeout=30)
    deadline = time.monotonic() + 600
    while time.monotonic() < deadline:
        if status():
            print("OCR_RESTORED", flush=True)
            return
        time.sleep(10)
    raise RuntimeError("OCR readiness timed out; containers and volumes were preserved")


def smoke():
    if not status():
        raise RuntimeError("OCR must be ready before a functional test")
    # Credentials stay in memory on the OCR host, never in logs or command arguments.
    env = dict(x.split("=", 1) for x in inspect("ocr_service-api-1")["Config"]["Env"])
    clients = json.loads(env["OCR_CLIENTS_JSON"])
    client = clients.get("central-prod") or next(iter(clients.values()))
    headers = {"Authorization": "Bearer " + client["api_key"]}
    expected = "OCR PIPELINE RESTORED 73915"
    # Render a synthetic page with the worker's existing image library.
    render = """from PIL import Image,ImageDraw,ImageFont
import sys
image=Image.new('RGB',(360,90),'white')
font=ImageFont.load_default()
ImageDraw.Draw(image).text((15,35),'OCR PIPELINE RESTORED 73915',font=font,fill='black')
image=image.resize((1440,360),Image.Resampling.LANCZOS)
image.save(sys.stdout.buffer,format='PNG')
"""
    png = subprocess.check_output(["docker", "exec", "-i", "ocr_service-worker-1", "python3", "-c", render])
    boundary = "ocr-restore-" + uuid.uuid4().hex
    body = ("--" + boundary + '\r\nContent-Disposition: form-data; name="file"; filename="restore-check.png"\r\nContent-Type: image/png\r\n\r\n').encode() + png + ("\r\n--" + boundary + "--\r\n").encode()
    submit_headers = {**headers, "Content-Type": "multipart/form-data; boundary=" + boundary, "Idempotency-Key": boundary}
    code, job = request("/api/v1/jobs", body, submit_headers, 20)
    if code != 202:
        raise RuntimeError("OCR did not accept the synthetic test")
    job_id = job["job_id"]
    print(json.dumps({"test_job": job_id, "submitted": True, "webhook": False}), flush=True)
    deadline = time.monotonic() + 240
    while time.monotonic() < deadline:
        _, job = request("/api/v1/jobs/" + job_id, headers=headers)
        if job["status"] == "completed":
            _, page = request("/api/v1/jobs/" + job_id + "/pages/1", headers=headers)
            text = page.get("text") or page.get("markdown") or ""
            matched = expected in " ".join(text.split())
            print(json.dumps({"test_job": job_id, "status": job["status"], "expected_text_matched": matched, "text": text, "model": page.get("model"), "duration_ms": job.get("processing_duration_ms")}), flush=True)
            if not matched:
                raise RuntimeError("OCR output did not match the test page")
            print("OCR_SMOKE_OK", flush=True)
            return
        if job["status"] in ["failed", "partial_failed", "canceled"]:
            raise RuntimeError("Synthetic OCR job failed: " + job_id)
        print(json.dumps({"test_job": job_id, "status": job["status"]}), flush=True)
        time.sleep(5)
    raise RuntimeError("Synthetic OCR job timed out: " + job_id)


try:
    mode = sys.argv[1] if len(sys.argv) > 1 else "--status"
    if mode == "--restore":
        restore()
    elif mode == "--smoke":
        smoke()
    elif mode == "--status":
        sys.exit(0 if status() else 1)
    else:
        raise RuntimeError("Unknown operation")
except Exception as error:
    # Do not print raw HTTP bodies or container environment on failure.
    print("OCR_OPERATION_FAILED", type(error).__name__, str(error) if isinstance(error, RuntimeError) else "inspect service health", flush=True)
    sys.exit(1)
