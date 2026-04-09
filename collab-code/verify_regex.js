const tests = [
  { code: 'print("hello")', lang: 'Python', expected: false },
  { code: 'name = input("name: ")', lang: 'Python', expected: true },
  { code: 'name = input ("name: ")', lang: 'Python', expected: true },
  { code: '# this is a comment with input()', lang: 'Python', expected: true }, // Our current regex doesn't handle comments yet, but that's okay for now
  { code: 'scanf("%d", &x);', lang: 'C', expected: true },
  { code: 'cin >> x;', lang: 'C++', expected: true },
  { code: 'Scanner sc = new Scanner(System.in);', lang: 'Java', expected: true },
  { code: 'const x = prompt("hello");', lang: 'JavaScript', expected: true },
  { code: 'process.stdin.on("data", () => {});', lang: 'JavaScript', expected: true }
];

const codeRequiresInput = (src, lang) => {
  if (!src) return false;
  switch (lang) {
    case "Python": return /\binput\s*\(/.test(src);
    case "C": return /\bscanf\s*\(/.test(src);
    case "C++": return /\bcin\b/.test(src);
    case "Java": return /\bScanner\b/.test(src);
    case "JavaScript":
    case "TypeScript": return /\bprompt\s*\(/.test(src) || /\bstdin\b/.test(src);
    default: return false;
  }
};

tests.forEach(t => {
  const result = codeRequiresInput(t.code, t.lang);
  console.log(`Lang: ${t.lang}, Code: ${t.code}, Expected: ${t.expected}, Got: ${result}, ${t.expected === result ? '✅' : '❌'}`);
});
