/**
 * runnerManager.js
 *
 * Interactive code-execution sessions using child_process.spawn().
 * Works cross-platform (Windows, Linux, macOS) — no node-pty needed.
 *
 * Behaviour:
 *   - Process starts immediately — no stdin pre-fetch
 *   - stdout + stderr stream live to the WebSocket client
 *   - write(data) pipes input into the running process's stdin
 *   - Compiled languages (Rust, Java, C, C++) compile first, then run
 */

import { spawn, spawnSync } from 'child_process';
import { EventEmitter } from 'events';
import os from 'os';
import fs from 'fs';
import path from 'path';

// ── Detect python executable once at startup ─────────────────────────────────
function detectPython() {
  for (const cmd of ['python', 'python3']) {
    try {
      const r = spawnSync(cmd, ['--version'], {
        timeout: 3000, encoding: 'utf8', windowsHide: true,
      });
      if (r.status === 0) return cmd;
    } catch { /* try next */ }
  }
  return 'python'; // fallback — will error at runtime if not installed
}
const PYTHON_CMD = detectPython();
console.log(`[runnerManager] Python command: ${PYTHON_CMD}`);

// ── Detect TypeScript executor ────────────────────────────────────────────────
function detectTsCmd() {
  for (const cmd of ['tsx', 'ts-node']) {
    try {
      const r = spawnSync(cmd, ['--version'], {
        timeout: 3000, windowsHide: true,
      });
      if (r.status === 0) return cmd;
    } catch { /* try next */ }
  }
  return null; // fall back to node --experimental-strip-types
}
const TS_CMD = detectTsCmd();

// ── Language → { cmd, args } resolver ────────────────────────────────────────
function getLangCmd(lang, srcPath) {
  switch (lang) {
    case 'python':
      return { cmd: PYTHON_CMD, args: ['-u', srcPath] }; // -u = unbuffered stdout
    case 'javascript':
      return { cmd: 'node', args: [srcPath] };
    case 'typescript':
      if (TS_CMD) return { cmd: TS_CMD, args: [srcPath] };
      return { cmd: 'node', args: ['--experimental-strip-types', srcPath] };
    case 'go':
      return { cmd: 'go', args: ['run', srcPath] };
    default:
      return null;
  }
}

const EXT_MAP = {
  python: 'py', javascript: 'js', typescript: 'ts', go: 'go',
  rust: 'rs', java: 'java', c: 'c', 'c++': 'cpp',
};

// ── RunnerSession ─────────────────────────────────────────────────────────────
class RunnerSession extends EventEmitter {
  constructor(sessionId) {
    super();
    this.setMaxListeners(20);
    this.sessionId = sessionId;
    this.child = null;
    this.tmpFiles = [];
    this._dead = false;
  }

  async start(language, sourceCode) {
    const lang = (language || 'python').toLowerCase().replace(/\s+/g, '');
    const ext = EXT_MAP[lang] || 'txt';
    const tmpDir = os.tmpdir();
    const fileId = `cc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const srcPath = path.join(tmpDir, `${fileId}.${ext}`);
    this.tmpFiles.push(srcPath);

    try {
      fs.writeFileSync(srcPath, sourceCode, 'utf8');
    } catch (err) {
      this.emit('error', `Cannot write temp file: ${err.message}`);
      this.emit('exit', -1);
      return;
    }

    // Compiled languages need a build step first
    const compiled = ['rust', 'c', 'c++', 'java'];
    if (compiled.includes(lang)) {
      await this._runCompiled(lang, srcPath, tmpDir, fileId, sourceCode);
      return;
    }

    // Interpreted languages run directly
    const cfg = getLangCmd(lang, srcPath);
    if (!cfg) {
      this.emit('error', `Unsupported language: ${language}`);
      this.emit('exit', -1);
      this._cleanup();
      return;
    }

    this._spawnProcess(cfg.cmd, cfg.args, tmpDir);
  }

  _spawnProcess(cmd, args, cwd) {
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PYTHONIOENCODING: 'utf-8',
          NODE_NO_WARNINGS: '1',
        },
        windowsHide: true,
      });
    } catch (err) {
      this.emit('error', `Failed to spawn '${cmd}': ${err.message}`);
      this.emit('exit', -1);
      this._cleanup();
      return;
    }

    this.child = child;

    child.stdout.on('data', (data) => {
      if (!this._dead) this.emit('data', data.toString('utf8'));
    });

    child.stderr.on('data', (data) => {
      if (!this._dead) this.emit('data', data.toString('utf8'));
    });

    child.on('error', (err) => {
      this.emit('error', `Process error: ${err.message}`);
    });

    child.on('close', (code, signal) => {
      this._dead = true;
      this._cleanup();
      this.emit('exit', code ?? (signal ? 1 : 0));
    });
  }

  async _runCompiled(lang, srcPath, tmpDir, fileId, sourceCode) {
    let buildCmd, buildArgs, runCmd, runArgs;

    if (lang === 'rust') {
      const outPath = path.join(tmpDir, fileId + (os.platform() === 'win32' ? '.exe' : ''));
      this.tmpFiles.push(outPath);
      buildCmd = 'rustc'; buildArgs = [srcPath, '-o', outPath];
      runCmd = outPath; runArgs = [];
    } else if (lang === 'c') {
      const outPath = path.join(tmpDir, fileId + (os.platform() === 'win32' ? '.exe' : ''));
      this.tmpFiles.push(outPath);
      buildCmd = 'gcc'; buildArgs = [srcPath, '-o', outPath];
      runCmd = outPath; runArgs = [];
    } else if (lang === 'c++') {
      const outPath = path.join(tmpDir, fileId + (os.platform() === 'win32' ? '.exe' : ''));
      this.tmpFiles.push(outPath);
      buildCmd = 'g++'; buildArgs = [srcPath, '-o', outPath];
      runCmd = outPath; runArgs = [];
    } else if (lang === 'java') {
      const classMatch = sourceCode.match(/public\s+class\s+(\w+)/);
      const className = classMatch ? classMatch[1] : 'Main';
      const javaFile = path.join(tmpDir, `${className}.java`);
      fs.writeFileSync(javaFile, sourceCode, 'utf8');
      this.tmpFiles.push(javaFile);
      buildCmd = 'javac'; buildArgs = [javaFile];
      runCmd = 'java'; runArgs = ['-cp', tmpDir, className];
    }

    // Compile step
    const ok = await new Promise((resolve) => {
      let compileProc;
      try {
        compileProc = spawn(buildCmd, buildArgs, {
          cwd: tmpDir,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch (err) {
        this.emit('error', `Compiler not found: ${err.message}`);
        resolve(false);
        return;
      }

      let out = '';
      compileProc.stdout?.on('data', d => { out += d.toString(); });
      compileProc.stderr?.on('data', d => { out += d.toString(); });
      compileProc.on('close', code => {
        if (code !== 0) {
          this.emit('data', out);
          this.emit('exit', code);
          resolve(false);
        } else {
          resolve(true);
        }
      });
      compileProc.on('error', err => {
        this.emit('error', `Compiler error: ${err.message}`);
        resolve(false);
      });
    });

    if (ok) {
      this._spawnProcess(runCmd, runArgs, tmpDir);
    } else {
      this._cleanup();
    }
  }

  /** Send input to the running process's stdin (e.g. when input() is called). */
  write(data) {
    if (this.child && !this._dead) {
      try {
        if (this.child.stdin && this.child.stdin.writable) {
          // Guarantee the input has a newline so Python's input() unblocks
          const payload = data.endsWith('\n') ? data : data + '\n';
          console.log(`[runnerManager] stdin.write: ${JSON.stringify(payload)}`);
          this.child.stdin.write(payload, 'utf8', (err) => {
            if (err) {
              console.error('[runnerManager] stdin.write error:', err.message);
            } else {
              console.log('[runnerManager] stdin.write flushed OK');
            }
          });
        } else {
          console.warn('[runnerManager] write() called but stdin not writable (dead:', this._dead, ')');
        }
      } catch (err) {
        console.error('[runnerManager] write() exception:', err.message);
      }
    } else {
      console.warn('[runnerManager] write() called but session is dead or child is null');
    }
  }

  /** Kill the running process. */
  kill() {
    this._dead = true;
    if (this.child) {
      try { this.child.kill(); } catch { }
      this.child = null;
    }
    this._cleanup();
  }

  _cleanup() {
    for (const f of this.tmpFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { }
    }
    this.tmpFiles = [];
  }
}

// ── Manager (singleton) ───────────────────────────────────────────────────────
class RunnerManager {
  constructor() {
    this.sessions = new Map();
  }

  create(sessionId) {
    this.kill(sessionId); // terminate any prior session for this user
    const session = new RunnerSession(sessionId);
    this.sessions.set(sessionId, session);
    session.once('exit', (code) => {
      console.log(`[runnerManager] Session ${sessionId} exited with code ${code}`);
      // Keep the session in map for 5 seconds after exit so late input messages
      // don't cause "session not found" errors during the cleanup window.
      setTimeout(() => {
        if (this.sessions.get(sessionId) === session) {
          this.sessions.delete(sessionId);
        }
      }, 5000);
    });
    return session;
  }

  get(sessionId) {
    return this.sessions.get(sessionId);
  }

  kill(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s) {
      s.kill();
      this.sessions.delete(sessionId);
    }
  }
}

export const runnerManager = new RunnerManager();
