const { spawn } = require('child_process');

async function testPythonInput() {
    const pythonCode = `
name = input("Enter name: ")
age = input("Enter age: ")
print(f"Hello {name}, you are {age} years old.")
`;
    const stdin = "Alice\n25\n";
    
    console.log("Testing Python with input...");
    
    // Simulating the backend runCode logic
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const tmpDir = os.tmpdir();
    const srcPath = path.join(tmpDir, 'test_input.py');
    fs.writeFileSync(srcPath, pythonCode);
    
    const start = Date.now();
    const child = spawn('python', [srcPath]);
    
    let stdout = "";
    let stderr = "";
    
    child.stdin.write(stdin);
    child.stdin.end();
    
    child.stdout.on("data", (data) => { stdout += data.toString(); });
    child.stderr.on("data", (data) => { stderr += data.toString(); });
    
    child.on("close", (code) => {
        console.log("Exit Code:", code);
        console.log("Stdout:", stdout);
        console.log("Stderr:", stderr);
        console.log("Duration:", Date.now() - start, "ms");
        fs.unlinkSync(srcPath);
        
        if (stdout.includes("Hello Alice, you are 25 years old.")) {
            console.log("✅ TEST PASSED");
        } else {
            console.log("❌ TEST FAILED");
        }
    });
}

testPythonInput();
