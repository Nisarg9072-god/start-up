const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper to simulate the backend runCode logic
async function simulateBackendRun(language, code, stdin = "") {
    console.log(`\n--- Testing ${language} ---`);
    console.log(`Code: ${code.trim().split('\n')[0]}...`);
    console.log(`Stdin: ${stdin.replace('\n', '\\n')}`);

    const extMap = { python: 'py', cpp: 'cpp', c: 'c' };
    const tmpDir = os.tmpdir();
    const fileId = `test_${Date.now()}`;
    const srcPath = path.join(tmpDir, `${fileId}.${extMap[language]}`);
    fs.writeFileSync(srcPath, code);

    return new Promise((resolve) => {
        let fullCmd;
        if (language === 'python') {
            fullCmd = `python "${srcPath}"`;
        } else if (language === 'cpp') {
            const outPath = path.join(tmpDir, `${fileId}_bin`);
            try {
                const { execSync } = require('child_process');
                execSync(`g++ ${srcPath} -o ${outPath}`);
                fullCmd = `"${outPath}"`;
            } catch (e) {
                return resolve({ stderr: "Compilation failed: " + e.message });
            }
        }

        const start = Date.now();
        const child = exec(fullCmd, { timeout: 15000 }, (error, stdout, stderr) => {
            if (language === 'cpp' && fullCmd.includes('_bin')) {
                try { fs.unlinkSync(fullCmd.replace(/"/g, '')); } catch(e) {}
            }
            try { fs.unlinkSync(srcPath); } catch(e) {}
            resolve({ 
                stdout: stdout || "", 
                stderr: stderr || (error ? error.message : ""), 
                exitCode: error?.code ?? 0, 
                duration: Date.now() - start 
            });
        });

        child.stdin.write(stdin || "\n");
        child.stdin.end();
    });
}

async function runTests() {
    // Test 1: Python No Input
    const t1 = await simulateBackendRun('python', 'print("Hello World")', "");
    console.log(`Result: ${t1.stdout.trim() === "Hello World" ? "✅" : "❌"} (Output: "${t1.stdout.trim()}")`);

    // Test 2: Python With Input
    const t2 = await simulateBackendRun('python', 'name = input()\nprint("Hello", name)', "Maitri\n");
    console.log(`Result: ${t2.stdout.trim() === "Hello Maitri" ? "✅" : "❌"} (Output: "${t2.stdout.trim()}")`);

    // Test 3: Python Error
    const t3 = await simulateBackendRun('python', 'print(undefined_var)', "");
    console.log(`Result: ${t3.stderr.includes("name 'undefined_var' is not defined") ? "✅" : "❌"} (Stderr: ${t3.stderr.split('\n').pop()})`);

    console.log("\n--- All Tests Finished ---");
}

runTests();
