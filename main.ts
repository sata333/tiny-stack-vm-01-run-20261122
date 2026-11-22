// Tiny stack VM for make.fun tiny-stack-vm-01 (spec: kit ISA.md).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const [o, c] = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), o);
  writeFileSync(join(O, id, 'exit.txt'), c + '\n');
}
function run(p, q) {
  const s = [], c = [], m = new Int32Array(256), o = [];
  let L = 0, pc = 0, ip = 0, k = 0;
  const n = p.length, T = (x) => [Buffer.concat(o), x];
  for (;;) {
    if (k >= 1e6) return T(10); // step limit
    if (pc < 0 || pc >= n) return T(9); // pc outside the program
    const op = p[pc];
    if (!(op <= 7 || (op >= 16 && op <= 30) || (op >= 32 && op <= 34) ||
      (op >= 48 && op <= 52) || (op >= 64 && op <= 65) || (op >= 80 && op <= 83))) return T(5);
    const nd = op === 1 ? 1 : op === 2 ? 4 : op >= 48 && op <= 51 ? 2 : 0;
    if (pc + 1 + nd > n) return T(9); // immediate cut off by program end
    k++;
    const l = s.length;
    switch (op) {
      case 0: return T(0);
      case 1: // PUSH8, sign-extended
        if (l > 255) return T(3); s.push((p[pc + 1] << 24) >> 24); pc += 2; break;
      case 2: // PUSH32
        if (l > 255) return T(3); s.push(p.readInt32LE(pc + 1)); pc += 5; break;
      case 3:
        if (l < 1) return T(2); s.pop(); pc++; break;
      case 4:
        if (l < 1) return T(2); if (l > 255) return T(3); s.push(s[l - 1]); pc++; break;
      case 5:
        if (l < 2) return T(2); { const t = s[l - 1]; s[l - 1] = s[l - 2]; s[l - 2] = t; } pc++; break;
      case 6:
        if (l < 2) return T(2); if (l > 255) return T(3); s.push(s[l - 2]); pc++; break;
      case 7: // ROT: ( a b c -- b c a )
        if (l < 3) return T(2); { const a = s[l - 3]; s[l - 3] = s[l - 2]; s[l - 2] = s[l - 1]; s[l - 1] = a; } pc++; break;
      case 16:
        if (l < 2) return T(2); s[l - 2] = (s[l - 2] + s[l - 1]) | 0; s.length = l - 1; pc++; break;
      case 17:
        if (l < 2) return T(2); s[l - 2] = (s[l - 2] - s[l - 1]) | 0; s.length = l - 1; pc++; break;
      case 18:
        if (l < 2) return T(2); s[l - 2] = Math.imul(s[l - 2], s[l - 1]); s.length = l - 1; pc++; break;
      case 19: // DIV: truncated toward zero; -2147483648 / -1 is -2147483648
        if (l < 2) return T(2); if (s[l - 1] === 0) return T(4);
        s[l - 2] = Math.trunc(s[l - 2] / s[l - 1]) | 0; s.length = l - 1; pc++; break;
      case 20: // MOD: sign of a; x % -1 is 0
        if (l < 2) return T(2); if (s[l - 1] === 0) return T(4);
        s[l - 2] = (s[l - 2] % s[l - 1]) | 0; s.length = l - 1; pc++; break;
      case 21: // DIVU: unsigned quotient, read back as signed
        if (l < 2) return T(2); if (s[l - 1] === 0) return T(4);
        s[l - 2] = Math.trunc((s[l - 2] >>> 0) / (s[l - 1] >>> 0)) | 0; s.length = l - 1; pc++; break;
      case 22: // MODU: unsigned remainder, read back as signed
        if (l < 2) return T(2); if (s[l - 1] === 0) return T(4);
        s[l - 2] = ((s[l - 2] >>> 0) % (s[l - 1] >>> 0)) | 0; s.length = l - 1; pc++; break;
      case 23: // NEG: -(-2147483648) is -2147483648
        if (l < 1) return T(2); s[l - 1] = (-s[l - 1]) | 0; pc++; break;
      case 24:
        if (l < 2) return T(2); s[l - 2] = s[l - 2] & s[l - 1]; s.length = l - 1; pc++; break;
      case 25:
        if (l < 2) return T(2); s[l - 2] = s[l - 2] | s[l - 1]; s.length = l - 1; pc++; break;
      case 26:
        if (l < 2) return T(2); s[l - 2] = s[l - 2] ^ s[l - 1]; s.length = l - 1; pc++; break;
      case 27:
        if (l < 1) return T(2); s[l - 1] = ~s[l - 1]; pc++; break;
      case 28: // SHL: shift count is b AND 31
        if (l < 2) return T(2); s[l - 2] = s[l - 2] << (s[l - 1] & 31); s.length = l - 1; pc++; break;
      case 29: // SHR: arithmetic
        if (l < 2) return T(2); s[l - 2] = s[l - 2] >> (s[l - 1] & 31); s.length = l - 1; pc++; break;
      case 30: // SHRU: logical, read back as signed
        if (l < 2) return T(2); s[l - 2] = (s[l - 2] >>> (s[l - 1] & 31)) | 0; s.length = l - 1; pc++; break;
      case 32:
        if (l < 2) return T(2); s[l - 2] = s[l - 2] === s[l - 1] ? 1 : 0; s.length = l - 1; pc++; break;
      case 33:
        if (l < 2) return T(2); s[l - 2] = s[l - 2] < s[l - 1] ? 1 : 0; s.length = l - 1; pc++; break;
      case 34: // LTU: unsigned comparison
        if (l < 2) return T(2); s[l - 2] = (s[l - 2] >>> 0) < (s[l - 1] >>> 0) ? 1 : 0; s.length = l - 1; pc++; break;
      case 48:
        pc = pc + 3 + p.readInt16LE(pc + 1); break;
      case 49:
        if (l < 1) return T(2); { const v = s.pop(); pc = v === 0 ? pc + 3 + p.readInt16LE(pc + 1) : pc + 3; } break;
      case 50:
        if (l < 1) return T(2); { const v = s.pop(); pc = v !== 0 ? pc + 3 + p.readInt16LE(pc + 1) : pc + 3; } break;
      case 51: // CALL: push next address, jump to unsigned immediate
        if (c.length >= 64) return T(7); c.push(pc + 3); pc = p.readUInt16LE(pc + 1); break;
      case 52:
        if (c.length === 0) return T(8); pc = c.pop(); break;
      case 64:
        if (l < 1) return T(2); { const a = s.pop(); if (a < 0 || a > 255) return T(6); s.push(m[a]); } pc++; break;
      case 65: // STORE: ( v addr -- )
        if (l < 2) return T(2); { const a = s.pop(), v = s.pop(); if (a < 0 || a > 255) return T(6); m[a] = v; } pc++; break;
      case 80:
        if (l < 1) return T(2); { const t = String(s.pop());
          if (L + t.length > 65536) return T(11); o.push(Buffer.from(t)); L += t.length; } pc++; break;
      case 81:
        if (l < 1) return T(2); if (L + 1 > 65536) return T(11);
        o.push(Buffer.from([s.pop() & 255])); L++; pc++; break;
      case 82: // IN: -1 once the input is used up
        if (l > 255) return T(3); s.push(ip < q.length ? q[ip++] : -1); pc++; break;
      case 83: // EXIT: code is v AND 255
        if (l < 1) return T(2); return T(s.pop() & 255);
    }
  }
}
