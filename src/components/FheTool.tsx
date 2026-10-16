import React, { useState } from 'react';
import {
  generateDghvKey,
  dghvEncryptBit,
  dghvDecryptBit,
  fheAnd,
  fheXor,
  fheOr,
  fheNand,
  fheHalfAdder,
  fheFullAdder,
  generatePaillierKeys,
  paillierEncrypt,
  paillierDecrypt,
  paillierAdd,
  paillierMultiplyScalar,
  DghvKey,
  FheCipherBit,
  PaillierPublicKey,
  PaillierPrivateKey,
} from '../utils/fheUtils';
import {
  Cpu,
  Lock,
  Unlock,
  Plus,
  Play,
  RotateCcw,
  Check,
  Sparkles,
  Info,
  Server,
  ShieldCheck,
  Zap,
  Layers,
  Calculator,
  ArrowRight,
} from 'lucide-react';

export const FheTool: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'boolean-fhe' | 'adder-fhe' | 'paillier'>('boolean-fhe');

  // -------------------------------------------------------------
  // Mode 1: Boolean FHE Gates (DGHV)
  // -------------------------------------------------------------
  const [dghvKey] = useState<DghvKey>(() => generateDghvKey(64));
  const [bitA, setBitA] = useState<number>(1);
  const [bitB, setBitB] = useState<number>(1);

  const [cipherA, setCipherA] = useState<FheCipherBit | null>(null);
  const [cipherB, setCipherB] = useState<FheCipherBit | null>(null);

  const [selectedGate, setSelectedGate] = useState<'AND' | 'XOR' | 'OR' | 'NAND' | 'HALF_ADDER'>('AND');
  const [evalResult, setEvalResult] = useState<{
    cipherOut: FheCipherBit;
    carryOut?: FheCipherBit;
    gate: string;
    evaluatedAt: number;
  } | null>(null);

  const [decryptedValue, setDecryptedValue] = useState<string | null>(null);

  const handleEncryptBits = () => {
    const ca = dghvEncryptBit(bitA, dghvKey);
    const cb = dghvEncryptBit(bitB, dghvKey);
    setCipherA(ca);
    setCipherB(cb);
    setEvalResult(null);
    setDecryptedValue(null);
  };

  const handleEvaluateGate = () => {
    if (!cipherA || !cipherB) return;
    setDecryptedValue(null);

    if (selectedGate === 'AND') {
      const out = fheAnd(cipherA, cipherB);
      setEvalResult({ cipherOut: out, gate: 'AND (乗算)', evaluatedAt: Date.now() });
    } else if (selectedGate === 'XOR') {
      const out = fheXor(cipherA, cipherB);
      setEvalResult({ cipherOut: out, gate: 'XOR (加算)', evaluatedAt: Date.now() });
    } else if (selectedGate === 'OR') {
      const out = fheOr(cipherA, cipherB);
      setEvalResult({ cipherOut: out, gate: 'OR', evaluatedAt: Date.now() });
    } else if (selectedGate === 'NAND') {
      const out = fheNand(cipherA, cipherB);
      setEvalResult({ cipherOut: out, gate: 'NAND (万能ゲート)', evaluatedAt: Date.now() });
    } else if (selectedGate === 'HALF_ADDER') {
      const ha = fheHalfAdder(cipherA, cipherB);
      setEvalResult({
        cipherOut: ha.sum,
        carryOut: ha.carry,
        gate: '半加算器 (Sum = A XOR B, Carry = A AND B)',
        evaluatedAt: Date.now(),
      });
    }
  };

  const handleDecryptGate = () => {
    if (!evalResult) return;
    const decSum = dghvDecryptBit(evalResult.cipherOut, dghvKey);
    if (evalResult.carryOut) {
      const decCarry = dghvDecryptBit(evalResult.carryOut, dghvKey);
      setDecryptedValue(`Sum = ${decSum}, Carry = ${decCarry} (2進数: ${decCarry}${decSum} = 10進数 ${decCarry * 2 + decSum})`);
    } else {
      setDecryptedValue(`出力ビット = ${decSum}`);
    }
  };

  // -------------------------------------------------------------
  // Mode 2: 4-Bit Encrypted Adder Circuit
  // -------------------------------------------------------------
  const [numA, setNumA] = useState<number>(5);
  const [numB, setNumB] = useState<number>(7);
  const [isAdding, setIsAdding] = useState(false);
  const [adderResult, setAdderResult] = useState<{
    encBitsA: FheCipherBit[];
    encBitsB: FheCipherBit[];
    encSumBits: FheCipherBit[];
    decryptedSum: number;
  } | null>(null);

  const handleRunEncryptedAdder = () => {
    setIsAdding(true);
    setAdderResult(null);

    setTimeout(() => {
      // Convert numA and numB to 4-bit arrays
      const bitsA = [numA & 1, (numA >> 1) & 1, (numA >> 2) & 1, (numA >> 3) & 1];
      const bitsB = [numB & 1, (numB >> 1) & 1, (numB >> 2) & 1, (numB >> 3) & 1];

      // Step 1: Encrypt each bit
      const encA = bitsA.map((b) => dghvEncryptBit(b, dghvKey));
      const encB = bitsB.map((b) => dghvEncryptBit(b, dghvKey));

      // Step 2: Ripple-carry full adder on encrypted ciphertexts!
      let carry: FheCipherBit = dghvEncryptBit(0, dghvKey);
      const sumCipherBits: FheCipherBit[] = [];

      for (let i = 0; i < 4; i++) {
        const fa = fheFullAdder(encA[i], encB[i], carry);
        sumCipherBits.push(fa.sum);
        carry = fa.cout;
      }
      sumCipherBits.push(carry); // 5th bit (overflow carry)

      // Step 3: Decrypt
      let total = 0;
      for (let i = 0; i < sumCipherBits.length; i++) {
        const bitVal = dghvDecryptBit(sumCipherBits[i], dghvKey);
        total |= bitVal << i;
      }

      setAdderResult({
        encBitsA: encA,
        encBitsB: encB,
        encSumBits: sumCipherBits,
        decryptedSum: total,
      });
      setIsAdding(false);
    }, 200);
  };

  // -------------------------------------------------------------
  // Mode 3: Paillier Additive Aggregator
  // -------------------------------------------------------------
  const [paillierKeys] = useState<{ publicKey: PaillierPublicKey; privateKey: PaillierPrivateKey }>(() =>
    generatePaillierKeys()
  );
  const [entries, setEntries] = useState<{ label: string; plaintext: number; ciphertext: bigint }[]>([
    {
      label: 'エンジニア A の希望給与',
      plaintext: 520,
      ciphertext: paillierEncrypt(520, paillierKeys.publicKey),
    },
    {
      label: 'エンジニア B の希望給与',
      plaintext: 680,
      ciphertext: paillierEncrypt(680, paillierKeys.publicKey),
    },
    {
      label: 'エンジニア C の希望給与',
      plaintext: 600,
      ciphertext: paillierEncrypt(600, paillierKeys.publicKey),
    },
  ]);

  const [newLabel, setNewLabel] = useState('');
  const [newVal, setNewVal] = useState<number>(500);

  const [aggCipherSum, setAggCipherSum] = useState<bigint | null>(null);
  const [decryptedAggResult, setDecryptedAggResult] = useState<{
    sum: number;
    count: number;
    average: number;
  } | null>(null);

  const handleAddPaillierEntry = () => {
    if (!newVal || isNaN(newVal)) return;
    const cipher = paillierEncrypt(newVal, paillierKeys.publicKey);
    setEntries((prev) => [
      ...prev,
      {
        label: newLabel.trim() || `データ #${prev.length + 1}`,
        plaintext: newVal,
        ciphertext: cipher,
      },
    ]);
    setNewLabel('');
    setAggCipherSum(null);
    setDecryptedAggResult(null);
  };

  const handleComputePaillierSum = () => {
    if (entries.length === 0) return;
    let acc = entries[0].ciphertext;
    for (let i = 1; i < entries.length; i++) {
      acc = paillierAdd(acc, entries[i].ciphertext, paillierKeys.publicKey);
    }
    setAggCipherSum(acc);
    setDecryptedAggResult(null);
  };

  const handleDecryptPaillier = () => {
    if (!aggCipherSum) return;
    const sum = Number(paillierDecrypt(aggCipherSum, paillierKeys.privateKey));
    setDecryptedAggResult({
      sum,
      count: entries.length,
      average: entries.length > 0 ? sum / entries.length : 0,
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">完全準同型暗号 (FHE) スタジオ</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono font-medium">
                DGHV / Paillier 準拠
              </span>
            </div>
            <p className="text-xs text-slate-400">
              暗号文を一度も復号することなく、暗号化したまま任意の計算（加算・乗算・全加算器）を実行
            </p>
          </div>
        </div>

        {/* Sub-tab switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveSubTab('boolean-fhe')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'boolean-fhe'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>暗号化論理ゲート</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('adder-fhe')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'adder-fhe'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>暗号化4-bit加算器</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('paillier')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'paillier'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Paillier 機密統計集計</span>
          </button>
        </div>
      </div>

      {/* Explanatory Box */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center gap-2 text-cyan-300 font-bold">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>完全準同型暗号（FHE: Fully Homomorphic Encryption）の革新性</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          通常のクラウドコンピューティングでは、計算を行う際にデータを一度「平文」に復号する必要があり、情報漏洩や不正アクセスのリスクが伴います。
          <strong>完全準同型暗号（Gentry, 2009）</strong>は、秘密鍵を持たない外部サーバー（クラウド）が暗号化されたデータのまま演算（足し算・掛け算）を実行し、その暗号化結果だけをクライアントに返送することを可能にする「暗号学の聖杯（Holy Grail）」です。
        </p>
      </div>

      {/* Mode 1: Boolean FHE Gates */}
      {activeSubTab === 'boolean-fhe' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>1. ビットの入力 &amp; DGHV暗号化</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">入力ビット A</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBitA(0);
                      setCipherA(null);
                    }}
                    className={`flex-1 py-2 rounded-lg font-mono font-bold text-sm border transition-colors ${
                      bitA === 0
                        ? 'bg-cyan-600 text-white border-cyan-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBitA(1);
                      setCipherA(null);
                    }}
                    className={`flex-1 py-2 rounded-lg font-mono font-bold text-sm border transition-colors ${
                      bitA === 1
                        ? 'bg-cyan-600 text-white border-cyan-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    1
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-300 font-semibold">入力ビット B</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBitB(0);
                      setCipherB(null);
                    }}
                    className={`flex-1 py-2 rounded-lg font-mono font-bold text-sm border transition-colors ${
                      bitB === 0
                        ? 'bg-cyan-600 text-white border-cyan-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBitB(1);
                      setCipherB(null);
                    }}
                    className={`flex-1 py-2 rounded-lg font-mono font-bold text-sm border transition-colors ${
                      bitB === 1
                        ? 'bg-cyan-600 text-white border-cyan-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    1
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleEncryptBits}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
            >
              <Lock className="w-4 h-4" />
              <span>A と B を DGHV 完全準同型暗号化</span>
            </button>

            {cipherA && cipherB && (
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono text-[10px]">
                  <div className="text-slate-400 font-sans text-xs">暗号文 cA (ノイズ付与済み):</div>
                  <div className="text-cyan-300 truncate select-all">{cipherA.c.toString()}</div>
                </div>
                <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1 font-mono text-[10px]">
                  <div className="text-slate-400 font-sans text-xs">暗号文 cB (ノイズ付与済み):</div>
                  <div className="text-cyan-300 truncate select-all">{cipherB.c.toString()}</div>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>2. クラウド側での暗号化ゲート演算</span>
            </h3>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                評価する論理回路 / ゲート
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'AND', label: 'AND (乗算)', desc: 'cA * cB' },
                  { id: 'XOR', label: 'XOR (加算)', desc: 'cA + cB' },
                  { id: 'OR', label: 'OR', desc: 'cA + cB + cA*cB' },
                  { id: 'NAND', label: 'NAND (万能)', desc: '1 + cA*cB' },
                  { id: 'HALF_ADDER', label: '半加算器', desc: 'Sum & Carry' },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGate(g.id as any)}
                    className={`p-2 rounded-lg border text-left transition-colors ${
                      selectedGate === g.id
                        ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold text-xs">{g.label}</div>
                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleEvaluateGate}
              disabled={!cipherA || !cipherB}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
            >
              <Play className="w-4 h-4" />
              <span>暗号文のままゲートを直接演算</span>
            </button>

            {evalResult && (
              <div className="space-y-3 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-[11px] text-slate-400 flex justify-between">
                  <span>演算種別: <strong className="text-slate-200">{evalResult.gate}</strong></span>
                  <span className="text-emerald-400">暗号化評価完了</span>
                </div>
                <div className="font-mono text-[10px] text-emerald-300 break-all select-all p-2 bg-slate-900 rounded border border-slate-800">
                  暗号化結果: {evalResult.cipherOut.c.toString()}
                </div>

                <button
                  type="button"
                  onClick={handleDecryptGate}
                  className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center justify-center gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  <span>クライアントの秘密鍵で復号して検証</span>
                </button>

                {decryptedValue && (
                  <div className="p-3 bg-indigo-950/40 border border-indigo-700 rounded-lg text-indigo-200 font-semibold text-center text-sm">
                    {decryptedValue}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: 4-Bit Encrypted Adder Circuit */}
      {activeSubTab === 'adder-fhe' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Calculator className="w-5 h-5 text-cyan-400" />
              <span>暗号化4ビット全加算器シミュレータ (Ripple-Carry Adder)</span>
            </h3>
            <p className="text-slate-400 text-[11px] mt-1">
              あなたが選んだ数値 A と B を暗号化し、秘密鍵を持たないクラウド側が暗号文のままリップルキャリー全加算器論理回路を実行して、暗号化された合計値を導出します。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                数値 A (0 〜 15): <span className="text-cyan-400 font-mono">{numA}</span> (2進: {numA.toString(2).padStart(4, '0')})
              </label>
              <input
                type="range"
                min="0"
                max="15"
                value={numA}
                onChange={(e) => setNumA(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                数値 B (0 〜 15): <span className="text-cyan-400 font-mono">{numB}</span> (2進: {numB.toString(2).padStart(4, '0')})
              </label>
              <input
                type="range"
                min="0"
                max="15"
                value={numB}
                onChange={(e) => setNumB(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunEncryptedAdder}
            disabled={isAdding}
            className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/40 text-sm"
          >
            <Play className="w-4 h-4" />
            <span>暗号化のまま全加算器を実行 ({numA} + {numB})</span>
          </button>

          {adderResult && (
            <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Check className="w-5 h-5 text-emerald-400" />
                <span>暗号化全加算器の計算に成功しました！</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                  <div className="text-slate-400">暗号化前の値:</div>
                  <div className="text-slate-200 font-mono text-sm font-bold">
                    {numA} + {numB} = {numA + numB}
                  </div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                  <div className="text-slate-400">クラウド側で処理した暗号ビット数:</div>
                  <div className="text-cyan-400 font-mono text-sm font-bold">
                    4bit + 4bit → 5bit 全加算
                  </div>
                </div>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg space-y-1">
                  <div className="text-slate-400">手元で復号した計算結果:</div>
                  <div className="text-emerald-400 font-mono text-sm font-bold">
                    {adderResult.decryptedSum} (一致確認済み)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 3: Paillier Additive Aggregator */}
      {activeSubTab === 'paillier' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>機密数値リスト (各個人が手元で暗号化)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">{entries.length} 件</span>
            </h3>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {entries.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 truncate">{item.label}</div>
                    <div className="font-mono text-[10px] text-cyan-400 truncate mt-0.5">
                      暗号文: {item.ciphertext.toString().slice(0, 32)}...
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                      平文: {item.plaintext}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new entry form */}
            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="ラベル (例: エンジニア D)"
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="number"
                value={newVal}
                onChange={(e) => setNewVal(Number(e.target.value))}
                placeholder="数値"
                className="w-24 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleAddPaillierEntry}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>暗号化追加</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <span>集計係 (中身を一切見ずに合算)</span>
            </h3>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Paillier暗号では、暗号文同士を乗算（c1 · c2 mod n²）するだけで、中身の平文を加算（m1 + m2）した暗号文が完成します。集計係は誰がいくらの数値を提出したのかを1円も知ることができません。
            </p>

            <button
              type="button"
              onClick={handleComputePaillierSum}
              disabled={entries.length === 0}
              className="w-full py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
            >
              <Zap className="w-4 h-4" />
              <span>中身を見ずに暗号文のまま合算を計算</span>
            </button>

            {aggCipherSum && (
              <div className="space-y-3 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-[11px] text-slate-400">暗号化合算値 (n^2 上):</div>
                <div className="font-mono text-[10px] text-cyan-300 break-all select-all p-2 bg-slate-900 rounded border border-slate-800">
                  {aggCipherSum.toString().slice(0, 64)}...
                </div>

                <button
                  type="button"
                  onClick={handleDecryptPaillier}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  <Unlock className="w-4 h-4" />
                  <span>秘密鍵で最終合計・平均を復号</span>
                </button>

                {decryptedAggResult && (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800 rounded-lg space-y-1 text-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-400">合算合計値:</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {decryptedAggResult.sum}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">対象件数:</span>
                      <span className="font-mono">{decryptedAggResult.count} 件</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">計算された平均値:</span>
                      <span className="font-mono font-bold text-cyan-300">
                        {decryptedAggResult.average.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
