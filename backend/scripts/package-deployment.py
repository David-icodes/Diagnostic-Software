"""Build and package an explicitly selected source tree; never copies environment files."""
import argparse, hashlib, io, json, pathlib, subprocess, tarfile, datetime
p=argparse.ArgumentParser(); p.add_argument('--output',required=True); args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
out=pathlib.Path(args.output).resolve()
if out.exists(): raise SystemExit('Refusing to overwrite existing archive')
for command in [['npm.cmd' if __import__('os').name=='nt' else 'npm','run','build'],['node','scripts/deployment-preflight.cjs']]:
 subprocess.run(command,cwd=root,check=True)
files=[root/'package.json',root/'package-lock.json',root/'scripts/deployment-preflight.cjs']
files += [f for f in (root/'dist').rglob('*') if f.is_file() and f.suffix in ('.js','.json','.png') and not f.name.endswith('.test.js') and 'scripts' not in f.relative_to(root/'dist').parts]
manifest={f.relative_to(root).as_posix():hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
out.parent.mkdir(parents=True,exist_ok=True)
with tarfile.open(out,'x:gz',format=tarfile.PAX_FORMAT) as tar:
 dirs=sorted({parent.as_posix() for f in files for parent in f.relative_to(root).parents if str(parent)!='.'})
 for name in dirs:
  entry=tarfile.TarInfo(name); entry.type=tarfile.DIRTYPE; entry.mode=0o755; tar.addfile(entry)
 for f in files:
  data=f.read_bytes(); entry=tarfile.TarInfo(f.relative_to(root).as_posix()); entry.size=len(data); entry.mode=0o644; tar.addfile(entry,io.BytesIO(data))
 data=json.dumps(manifest,indent=2).encode(); entry=tarfile.TarInfo('deployment-manifest.json'); entry.size=len(data); entry.mode=0o644; tar.addfile(entry,io.BytesIO(data))
with tarfile.open(out) as tar:
 for item in tar.getmembers():
  assert '\\' not in item.name and not item.name.startswith('/') and '..' not in pathlib.PurePosixPath(item.name).parts
  assert item.mode==(0o755 if item.isdir() else 0o644)
  if item.name in manifest: assert hashlib.sha256(tar.extractfile(item).read()).hexdigest()==manifest[item.name]
 assert 'dist/modules/whatsapp/whatsapp.routes.js' in tar.getnames()
print('Verified archive:',out.name,'runtime files:',len(files),'SHA256:',hashlib.sha256(out.read_bytes()).hexdigest())
