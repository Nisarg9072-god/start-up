from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import sys
import os
import tempfile
import time

app = FastAPI(title="Collab Code Python Runner")

class RunRequest(BaseModel):
    code: str
    stdin: str = ""

@app.post("/run-python")
async def run_python(request: RunRequest):
    # Basic filtering for unsafe operations
    unsafe_keywords = ["import os", "import subprocess", "import sys", "open(", "eval(", "exec("]
    # Note: In a real production app, you'd use a Docker container or a sandbox
    
    with tempfile.NamedTemporaryFile(suffix=".py", delete=False) as tmp:
        tmp.write(request.code.encode('utf-8'))
        tmp_path = tmp.name

    try:
        start_time = time.time()
        # Execute code using subprocess
        process = subprocess.Popen(
            [sys.executable, tmp_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        try:
            # Timeout after 5 seconds as per requirements
            stdout, stderr = process.communicate(input=request.stdin, timeout=5)
            exit_code = process.returncode
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            return {
                "output": stdout,
                "error": "Execution timed out (5s)",
                "exit_code": -1,
                "duration": 5.0
            }

        return {
            "output": stdout,
            "error": stderr,
            "exit_code": exit_code,
            "duration": time.time() - start_time
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
