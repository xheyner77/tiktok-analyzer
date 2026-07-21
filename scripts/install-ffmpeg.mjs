import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  open,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { get as httpsGet } from 'node:https';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FFMPEG_RELEASE,
  getFfmpegAsset,
  getFfmpegReleaseUrl,
  getFfmpegVendorRelativePath,
} from './ffmpeg-release.mjs';

const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_EXECUTABLE_BYTES = 384 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 45_000;
const MAX_REDIRECTS = 5;
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'release-assets.githubusercontent.com',
]);

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, '..');
const verifyPlatformArgument = process.argv.find((argument) => argument.startsWith('--verify-platform='));
const requestedPlatformKey = verifyPlatformArgument?.slice('--verify-platform='.length);
const requestedPlatform = requestedPlatformKey === 'linux-x64' ? 'linux' : requestedPlatformKey === 'win32-x64' ? 'win32' : process.platform;
const requestedArch = requestedPlatformKey ? 'x64' : process.arch;
if (requestedPlatformKey && !['linux-x64', 'win32-x64'].includes(requestedPlatformKey)) {
  throw new Error('Expected --verify-platform=linux-x64 or --verify-platform=win32-x64.');
}
const asset = getFfmpegAsset(requestedPlatform, requestedArch);
const targetPath = resolve(projectRoot, getFfmpegVendorRelativePath(requestedPlatform, requestedArch));
const crossPlatformVerification = asset.key !== `${process.platform}-${process.arch}`;
const expectedVersionPrefix = `ffmpeg version ${FFMPEG_RELEASE.revision}`;

async function moveExecutable(sourcePath, destinationPath) {
  try {
    await rename(sourcePath, destinationPath);
    return;
  } catch (error) {
    if (error?.code !== 'EXDEV') throw error;
  }

  // Vercel stores temporary files and the checkout on different filesystems.
  // Copy to a sibling first, then rename on the destination filesystem so the
  // final executable still appears atomically.
  const stagedPath = `${destinationPath}.install-${process.pid}`;
  try {
    await rm(stagedPath, { force: true });
    await copyFile(sourcePath, stagedPath);
    await chmod(stagedPath, 0o755);
    await rename(stagedPath, destinationPath);
  } finally {
    await rm(stagedPath, { force: true });
  }
}

function minimalEnvironment() {
  const environment = {
    NODE_ENV: process.env.NODE_ENV ?? 'production',
    LANG: 'C',
    LC_ALL: 'C',
    PATH: process.platform === 'win32'
      ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')
      : '/usr/bin:/bin',
    TEMP: tmpdir(),
    TMP: tmpdir(),
    TMPDIR: tmpdir(),
  };
  if (process.platform === 'win32') {
    environment.SystemRoot = process.env.SystemRoot ?? 'C:\\Windows';
    environment.WINDIR = process.env.WINDIR ?? environment.SystemRoot;
  }
  return environment;
}

function run(command, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxOutputBytes = options.maxOutputBytes ?? 1024 * 1024;
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? projectRoot,
      env: minimalEnvironment(),
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error(`${basename(command)} timed out.`));
    }, timeoutMs);
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) rejectPromise(error);
      else resolvePromise(value);
    };
    const collect = (target, chunk) => {
      if (settled) return;
      outputBytes += chunk.byteLength;
      if (outputBytes > maxOutputBytes) {
        child.kill('SIGKILL');
        finish(new Error(`${basename(command)} exceeded its output limit.`));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on('data', (chunk) => collect(stdout, chunk));
    child.stderr.on('data', (chunk) => collect(stderr, chunk));
    child.once('error', finish);
    child.once('close', (code) => {
      const result = {
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      };
      if (code === 0) finish(undefined, result);
      else finish(new Error(`${basename(command)} exited with code ${code}: ${result.stderr.toString('utf8').slice(-500)}`));
    });
  });
}

async function installedVersionIsValid(executablePath) {
  try {
    const file = await stat(executablePath);
    if (!file.isFile() || file.size <= 0 || file.size > MAX_EXECUTABLE_BYTES) return false;
    if (await sha256(executablePath) !== asset.executableSha256) return false;
    const result = await run(executablePath, ['-version'], { timeoutMs: 10_000 });
    return result.stdout.toString('utf8').split(/\r?\n/, 1)[0]?.startsWith(expectedVersionPrefix) === true;
  } catch {
    return false;
  }
}

async function download(url, destination, redirectCount = 0) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:' || !ALLOWED_DOWNLOAD_HOSTS.has(parsedUrl.hostname)) {
    throw new Error(`Refused FFmpeg download host: ${parsedUrl.hostname}`);
  }
  if (redirectCount > MAX_REDIRECTS) throw new Error('Too many FFmpeg download redirects.');

  await new Promise((resolvePromise, rejectPromise) => {
    const request = httpsGet(parsedUrl, {
      headers: {
        Accept: 'application/octet-stream',
        'User-Agent': 'Viralynz-verified-FFmpeg-installer/1.0',
      },
    }, (response) => {
      const statusCode = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        response.resume();
        const location = response.headers.location;
        if (!location) {
          rejectPromise(new Error('FFmpeg download redirect has no Location header.'));
          return;
        }
        download(new URL(location, parsedUrl).toString(), destination, redirectCount + 1)
          .then(resolvePromise, rejectPromise);
        return;
      }
      if (statusCode !== 200) {
        response.resume();
        rejectPromise(new Error(`FFmpeg download failed with HTTP ${statusCode}.`));
        return;
      }
      const declaredLength = Number(response.headers['content-length']);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_ARCHIVE_BYTES) {
        response.destroy();
        rejectPromise(new Error('FFmpeg archive exceeds the declared size limit.'));
        return;
      }

      const output = createWriteStream(destination, { flags: 'wx', mode: 0o600 });
      let receivedBytes = 0;
      response.on('data', (chunk) => {
        receivedBytes += chunk.byteLength;
        if (receivedBytes > MAX_ARCHIVE_BYTES) {
          response.destroy(new Error('FFmpeg archive exceeds the download size limit.'));
        }
      });
      response.pipe(output);
      response.once('error', rejectPromise);
      output.once('error', rejectPromise);
      output.once('finish', () => output.close((error) => (error ? rejectPromise(error) : resolvePromise())));
    });
    request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => request.destroy(new Error('FFmpeg download stalled.')));
    request.once('error', rejectPromise);
  });
}

async function sha256(filePath) {
  const handle = await open(filePath, 'r');
  const hash = createHash('sha256');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let position = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (bytesRead === 0) break;
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    return hash.digest('hex');
  } finally {
    await handle.close();
  }
}

function archiveMemberPath() {
  const archiveRoot = asset.archiveName.replace(/\.(?:tar\.xz|zip)$/i, '');
  return `${archiveRoot}/bin/${asset.executableName}`;
}

async function extractOnlyExecutable(archivePath, destination) {
  const member = archiveMemberPath();
  const tarExecutable = process.platform === 'win32'
    ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
    : '/usr/bin/tar';
  const result = await run(tarExecutable, ['-xOf', archivePath, member], {
    timeoutMs: 120_000,
    maxOutputBytes: MAX_EXECUTABLE_BYTES,
  });
  if (result.stdout.length === 0) throw new Error(`FFmpeg archive member is empty: ${member}`);
  await mkdir(dirname(destination), { recursive: true });
  const handle = await open(destination, 'wx', 0o755);
  try {
    await handle.writeFile(result.stdout);
  } finally {
    await handle.close();
  }
  await chmod(destination, 0o755);
}

async function install() {
  if (!crossPlatformVerification && await installedVersionIsValid(targetPath)) {
    process.stdout.write(`[ffmpeg] ${FFMPEG_RELEASE.revision} already verified for ${asset.key}.\n`);
    return;
  }

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'viralynz-ffmpeg-install-'));
  const archivePath = join(temporaryDirectory, asset.archiveName);
  const candidatePath = join(temporaryDirectory, asset.executableName);
  try {
    process.stdout.write(`[ffmpeg] Downloading immutable ${FFMPEG_RELEASE.tag}/${asset.archiveName}.\n`);
    await download(getFfmpegReleaseUrl(requestedPlatform, requestedArch), archivePath);
    const actualSha256 = await sha256(archivePath);
    if (actualSha256 !== asset.sha256) {
      throw new Error(`FFmpeg archive checksum mismatch: expected ${asset.sha256}, received ${actualSha256}.`);
    }
    process.stdout.write(`[ffmpeg] Archive SHA-256 verified (${actualSha256}).\n`);

    await extractOnlyExecutable(archivePath, candidatePath);
    if (crossPlatformVerification) {
      const executableSha256 = await sha256(candidatePath);
      if (executableSha256 !== asset.executableSha256) {
        throw new Error(`FFmpeg executable checksum mismatch: expected ${asset.executableSha256}, received ${executableSha256}.`);
      }
      const file = await stat(candidatePath);
      const handle = await open(candidatePath, 'r');
      const header = Buffer.alloc(20);
      try {
        await handle.read(header, 0, header.length, 0);
      } finally {
        await handle.close();
      }
      if (requestedPlatform === 'linux') {
        const isElf64X64 = header.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
          && header[4] === 2
          && header.readUInt16LE(18) === 0x3e;
        if (!isElf64X64) throw new Error('Extracted FFmpeg is not a Linux x86-64 ELF executable.');
      }
      process.stdout.write(`[ffmpeg] Cross-platform asset verified (${file.size} bytes, executable SHA-256 ${executableSha256}).\n`);
      return;
    }
    if (!await installedVersionIsValid(candidatePath)) {
      const versionOutput = await run(candidatePath, ['-version'], { timeoutMs: 10_000 });
      const firstLine = versionOutput.stdout.toString('utf8').split(/\r?\n/, 1)[0] ?? 'unavailable';
      throw new Error(`Unexpected FFmpeg executable version: ${firstLine}`);
    }

    await mkdir(dirname(targetPath), { recursive: true });
    await rm(targetPath, { force: true });
    await moveExecutable(candidatePath, targetPath);
    const installedSha256 = await sha256(targetPath);
    const installedBytes = (await stat(targetPath)).size;
    process.stdout.write(`[ffmpeg] Installed ${FFMPEG_RELEASE.revision} (${installedBytes} bytes, executable SHA-256 ${installedSha256}).\n`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

await install();
