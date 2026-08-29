import os
import zipfile
import datetime
import shutil

def package():
    canonical_zip = "RAILOPT_X_SIH_PS_25022.zip"
    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    timestamped_zip = f"RAILOPT_X_SIH_PS_25022({timestamp}).zip"
    
    if os.path.exists(canonical_zip):
        os.remove(canonical_zip)
        
    include_dirs = ["src", "public", "backend", "docs", "tests", "scripts"]
    include_root_files = [
        "package.json", "package-lock.json", "index.html",
        "vite.config.ts", "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json",
        "README.md", "start_app.bat", "start_app.ps1",
        "pyproject.toml", "pytest.ini",
        "Dockerfile.backend", "Dockerfile.frontend", "docker-compose.yml"
    ]
    
    packaged_files_count = 0
    with zipfile.ZipFile(canonical_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for f in include_root_files:
            if os.path.exists(f):
                posix_name = f.replace("\\", "/")
                z.write(f, posix_name)
                packaged_files_count += 1
                
        for folder in include_dirs:
            if not os.path.exists(folder):
                continue
            for root, dirs, files in os.walk(folder):
                dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "__pycache__", ".pytest_cache", "dist", ".agents", ".venv", "venv")]
                for f in files:
                    if f.endswith(".pyc") or f.endswith(".zip") or f.endswith(".log"):
                        continue
                    full = os.path.join(root, f)
                    posix_name = full.replace("\\", "/")
                    z.write(full, posix_name)
                    packaged_files_count += 1
    desktop_canonical = r"C:\Users\madha\Desktop\RAILOPT_X_SIH_PS_25022.zip"
    sih_folder_canonical = r"C:\Users\madha\Desktop\SIH_PS_25022\RAILOPT_X_SIH_PS_25022.zip"
    
    try:
        shutil.copyfile(canonical_zip, desktop_canonical)
    except Exception as e:
        print(f"[WARN] Could not copy to Desktop: {e}")
        
    if os.path.exists(os.path.dirname(sih_folder_canonical)):
        try:
            shutil.copyfile(canonical_zip, sih_folder_canonical)
        except Exception as e:
            print(f"[WARN] Could not copy to SIH_PS_25022 folder: {e}")
    
    size_mb = os.path.getsize(canonical_zip) / (1024 * 1024)
    print(f"==================================================")
    print(f"  RAILOPT-X ARTIFACT GATE: PACKAGING MANIFEST")
    print(f"==================================================")
    print(f"Total files packaged: {packaged_files_count}")
    print(f"Canonical Package: {canonical_zip} ({size_mb:.2f} MB)")
    print(f"Desktop Destination: {desktop_canonical}")
    print(f"--------------------------------------------------")
    
    # Verification check against Artifact Gate
    with zipfile.ZipFile(canonical_zip, "r") as z:
        namelist = z.namelist()
        has_src = any(n.startswith("src/") for n in namelist)
        has_pkg_json = "package.json" in namelist
        has_vite = "vite.config.ts" in namelist
        has_backend = any(n.startswith("backend/") for n in namelist)
        has_tests = any(n.startswith("tests/") for n in namelist)
        has_docs = any(n.startswith("docs/") for n in namelist)
        has_models = "public/models/manifest.json" in namelist
        has_audio = "public/audio/manifest.json" in namelist
        has_docker_be = "Dockerfile.backend" in namelist
        has_docker_fe = "Dockerfile.frontend" in namelist
        has_docker_compose = "docker-compose.yml" in namelist
        has_pytest_ini = "pytest.ini" in namelist
        
        all_ok = all([has_src, has_pkg_json, has_vite, has_backend, has_tests, has_docs, has_models, has_audio, has_docker_be, has_docker_fe, has_docker_compose, has_pytest_ini])
        
        print(f"[1]  Frontend Source (`src/`):             {'[PASS]' if has_src else '[FAIL]'}")
        print(f"[2]  Frontend Config (`package.json`):      {'[PASS]' if has_pkg_json else '[FAIL]'}")
        print(f"[3]  Frontend Build (`vite.config.ts`):     {'[PASS]' if has_vite else '[FAIL]'}")
        print(f"[4]  Backend Engine (`backend/`):           {'[PASS]' if has_backend else '[FAIL]'}")
        print(f"[5]  Full Test Suite (`tests/`):            {'[PASS]' if has_tests else '[FAIL]'}")
        print(f"[6]  Documentation (`docs/`):               {'[PASS]' if has_docs else '[FAIL]'}")
        print(f"[7]  3D Model Assets (`public/models/`):    {'[PASS]' if has_models else '[FAIL]'}")
        print(f"[8]  Audio Assets (`public/audio/`):        {'[PASS]' if has_audio else '[FAIL]'}")
        print(f"[9]  Backend Docker (`Dockerfile.backend`):   {'[PASS]' if has_docker_be else '[FAIL]'}")
        print(f"[10] Frontend Docker (`Dockerfile.frontend`): {'[PASS]' if has_docker_fe else '[FAIL]'}")
        print(f"[11] Orchestration (`docker-compose.yml`):   {'[PASS]' if has_docker_compose else '[FAIL]'}")
        print(f"[12] Test Configuration (`pytest.ini`):     {'[PASS]' if has_pytest_ini else '[FAIL]'}")
        print(f"--------------------------------------------------")
        print(f"Artifact Gate Result: {'ALL 12 GATES PASSED (PRODUCTION GRADE ARTIFACT)' if all_ok else 'FAILED'}")
        print(f"==================================================")

if __name__ == "__main__":
    package()
