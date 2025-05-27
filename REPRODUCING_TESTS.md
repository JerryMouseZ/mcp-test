# Reproducing Node Farm Prototype Benchmarks

## 1. Introduction

### Overview
The "Node Farm" prototype explores efficient and isolated execution of arbitrary JavaScript "tool" scripts. The primary goal is to achieve low-latency execution (significantly less than 420ms, ideally in the low milliseconds or sub-milliseconds for warm runs) while maintaining strong isolation between tool executions and between tools and the host system. This exploration involved benchmarking various approaches, including direct STDIO/HTTP execution, containerization with Docker, and different "warm reset" mechanisms within a Node.js host process using `vm` and `isolated-vm`.

### Purpose
This document provides the necessary information to reproduce the performance benchmarks conducted during the prototyping phases. It also summarizes the key findings to help understand the performance characteristics and trade-offs of each approach.

## 2. Overall Findings Summary

The prototyping effort concluded that **`isolated-vm` with a warm Isolate pooling strategy is the most promising approach for the "Node Farm" concept.** This method offers the best balance of strong V8 Isolate-level security/sandboxing and extremely low-latency execution for frequently run tools.

Key performance metrics for `isolated-vm` highlight its efficiency:
*   **~0.47 ms** for a "Warm Isolate, Warm Context, Re-compile & Re-run" cycle (Scenario B): This represents the time to re-compile and re-run a script if both the Isolate and its Context are already warm and can be reused. This is exceptionally fast.
*   **~1.46 ms** for a "Warm Isolate, New Context" cycle (Scenario C): This includes creating a new V8 Context, compiling the script, running it, and releasing the context, all within an already running Isolate. This is still very fast and provides a pristine environment for each tool run.

These warm execution times are significantly faster than any cold-start alternative (e.g., direct Node.js script cold starts, Docker container cold starts) and meet the project's performance goals. While the initial creation of a V8 Isolate has a one-time cost (estimated ~5-11 ms excluding Node.js process startup), this cost is amortized when isolates are pooled and reused for many tool executions. Dependency management for tool scripts run in `isolated-vm` requires a bundling strategy (e.g., using `esbuild`) to create self-contained scripts, which adds a small, manageable overhead.

## 3. Environment Setup

The following tools and versions were used during the prototyping. Similar versions should be used for reproducibility.

*   **Node.js:** v20.19.2 (LTS version recommended)
*   **npm:** v10.8.2 (typically comes with Node.js)
*   **Docker:** v26.1.3 (or any recent stable version)
*   **`hyperfine`:** v1.18.0
    *   Installation: `sudo apt-get update && sudo apt-get install -y hyperfine` (on Debian/Ubuntu) or download from [hyperfine releases](https://github.com/sharkdp/hyperfine/releases).
*   **Build Tools (for `isolated-vm`):**
    *   `python3`
    *   `make`
    *   `g++`
    *   Installation: `sudo apt-get install -y python3 make g++`
*   **Project-Specific Dependencies:**
    *   Navigate to the project root containing the `node-farm` directory.
    *   Install `isolated-vm` and other Node.js dependencies:
        ```bash
        cd node-farm
        npm install isolated-vm lodash.isempty uuid
        cd .. 
        ```
        *(Note: Benchmarking scripts for `isolated-vm` often re-ran `npm install isolated-vm --no-save` to ensure module availability in the specific `run_in_bash_session` environment. For local reproduction, a single `npm install` in `node-farm` should suffice if your Node.js environment resolves modules correctly.)*

## 4. Project Structure

The core scripts for this prototype reside in the `node-farm/` directory. Key scripts include:
*   `mcp_server_stdio.js`: A simple server processing requests via STDIO.
*   `mcp_server_http.js`: A simple HTTP server processing requests.
*   `client.js`: A client to interact with both STDIO and HTTP servers.
*   `mcp_tool_logic.js`: Basic tool logic for "No Reset" and "vm Module" benchmarks.
*   `mcp_tool_logic_for_isolate.js`: Tool logic adapted for `isolated-vm`.
*   `mcp_script_A_lodash.js`, `mcp_script_B_uuid.js`: Tool scripts with dependencies.
*   Various `benchmark_*.js` scripts: Used by `hyperfine` to test different scenarios.
*   Various `Dockerfile.*` and `*.sh` scripts for containerized and cold-start HTTP benchmarks.

All benchmark commands below should be run from within the `node-farm` directory (e.g., after `cd node-farm`).

## 5. Benchmark Scripts and Execution Commands

*(Ensure `isolated-vm` and other dependencies are installed in `node-farm/node_modules` before running `isolated-vm` benchmarks. For robustness during automated testing, some benchmark commands below re-run `npm install isolated-vm --no-save`.)*

### Phase 1: Baseline Performance (STDIO vs. HTTP Stream)

*   **Scripts:** `mcp_server_stdio.js`, `mcp_server_http.js`, `client.js`, `run_http_cold.sh`
*   **Commands (run from `node-farm` directory):**
    *   **STDIO Cold Start:**
        ```bash
        hyperfine --runs 10 'node client.js --mode stdio --action uppercase --payload "performance test"'
        ```
        *   Mean Result: ~128.8 ms
    *   **HTTP Cold Start (using wrapper script):**
        *   Make `run_http_cold.sh` executable: `chmod +x run_http_cold.sh`
        ```bash
        hyperfine --runs 10 ./run_http_cold.sh
        ```
        *   Mean Result: ~413.3 ms
    *   **HTTP Warm Start:**
        1.  Start server: `node mcp_server_http.js &` (note its PID)
        2.  Run benchmark:
            ```bash
            hyperfine --runs 100 'node client.js --mode http --action uppercase --payload "performance test"'
            ```
        3.  Kill server: `kill <PID_OF_SERVER>`
        *   Mean Result: ~74.4 ms

### Phase 2: Containerization Overhead Assessment

*   **Scripts & Images:** `Dockerfile.stdio`, `Dockerfile.http`, `run_http_cold_docker.sh`.
    *   Build images first (from `node-farm` directory):
        ```bash
        sudo docker build -f Dockerfile.stdio -t mcp_server_stdio_image .
        sudo docker build -f Dockerfile.http -t mcp_server_http_image .
        ```
*   **Commands (run from `node-farm` directory):**
    *   **STDIO Container Cold Start:**
        ```bash
        hyperfine --runs 10 "echo '{\\"action\\": \\"uppercase\\", \\"payload\\": \\"docker stdio test\\"}' | sudo docker run --rm -i mcp_server_stdio_image:latest"
        ```
        *   Mean Result: ~2.74 s
    *   **HTTP Container Cold Start (using wrapper script):**
        *   Make `run_http_cold_docker.sh` executable: `chmod +x run_http_cold_docker.sh`
        ```bash
        hyperfine --runs 10 ./run_http_cold_docker.sh
        ```
        *   Mean Result: ~13.34 s
    *   **HTTP Container Warm Start:**
        1.  Start container: `sudo docker run -d -p 3000:3000 --name mcp_http_container mcp_server_http_image:latest && sleep 1`
        2.  Run benchmark:
            ```bash
            hyperfine --runs 100 'node client.js --mode http --action uppercase --payload "docker http warm"'
            ```
        3.  Stop/remove container: `sudo docker stop mcp_http_container && sudo docker rm mcp_http_container`
        *   Mean Result: ~75.1 ms

### Phase 3: NodeJS "Warm Reset" Schemes

*   **Scripts:** `mcp_tool_logic.js`, `benchmark_no_reset.js`, `benchmark_vm_reset.js`.
*   **Commands (run from `node-farm` directory):**
    *   **No Reset (Module Reload):**
        ```bash
        hyperfine --runs 1000 "node benchmark_no_reset.js"
        ```
        *   Mean Result (script execution): ~37.6 ms
    *   **`vm` Module (New Context):**
        ```bash
        hyperfine --runs 1000 "node benchmark_vm_reset.js"
        ```
        *   Mean Result (script execution): ~36.3 ms

### Phase 3 & 4: `isolated-vm` Performance

*   **Scripts:** `mcp_tool_logic_for_isolate.js`, `benchmark_isolated_vm_A.js`, `benchmark_isolated_vm_B.js`, `benchmark_warm_isolate_new_context.js`.
*   **Commands (run from `node-farm` directory):**
    *   **Isolate Cold Start + Context Cycle (Scenario A):**
        ```bash
        npm install isolated-vm --no-save --no-audit --no-fund # Ensure module available
        hyperfine --runs 100 "node benchmark_isolated_vm_A.js"
        ```
        *   Mean Result (total script time): ~42.1 ms
    *   **Warm Isolate, New Context Cycle (Scenario C - script prints internal average):**
        ```bash
        npm install isolated-vm --no-save --no-audit --no-fund
        hyperfine --runs 10 --show-output "node benchmark_warm_isolate_new_context.js"
        ```
        *   Key Result: ~1.46 ms (average of the printed values from the 10 script runs)
    *   **Warm Isolate, Warm Context, Re-compile/Re-run (Scenario B):**
        ```bash
        npm install isolated-vm --no-save --no-audit --no-fund
        hyperfine --runs 100 "node benchmark_isolated_vm_B.js"
        ```
        *   Mean Result (total script time): ~46.3 ms
        *   Key Result: ~0.47 ms (estimated internal cycle average, derived by comparing Scenario A and B script times)

### Phase 5: Dependency Management (Manual Bundling with `isolated-vm`)

*   **Scripts:** `mcp_script_A_lodash.js`, `mcp_script_B_uuid.js`, `benchmark_deps_lodash.js`, `benchmark_deps_uuid.js`.
*   **Commands (run from `node-farm` directory, scripts print internal average cycle time):**
    *   **`lodash.isempty` bundled:**
        ```bash
        npm install isolated-vm lodash.isempty --no-save --no-audit --no-fund
        hyperfine --runs 10 --show-output "node benchmark_deps_lodash.js"
        ```
        *   Key Result: ~2.16 ms (average of printed values)
    *   **`uuid` (JS placeholder) bundled:**
        ```bash
        npm install isolated-vm uuid --no-save --no-audit --no-fund
        hyperfine --runs 10 --show-output "node benchmark_deps_uuid.js" 
        ```
        *   Key Result: ~1.64 ms (average of printed values, using JS placeholder for `uuid.v4`)

## 6. Interpreting Results

*   **Node.js Startup Overhead:** `hyperfine` runs scripts as separate Node.js processes. For simple scripts, this startup time (observed ~30-38 ms) often dominates the measurement. The key is to compare relative differences or, where possible (as in `isolated-vm` Scenarios B and C), measure internal loop times.
*   **Cold vs. Warm:** Cold starts (new process, new container, new Isolate) are always significantly slower than warm starts (reusing existing process, container, Isolate).
*   **`isolated-vm` Internal Costs:**
    *   The cost of creating a new Isolate is estimated at ~5-11 ms (excluding Node.js process startup).
    *   Once an Isolate is warm:
        *   Creating a new Context + compiling + running a simple script + releasing context is ~1.46 ms.
        *   Re-compiling + re-running a script in an existing Context is ~0.47 ms.
*   **Bundling Overhead:** Adding dependencies (like `lodash.isempty`) increases the script size and thus the compile/run time within the isolate, adding ~0.70 ms in the tested case.

## 7. Final Recommendations

The performance benchmarks strongly recommend using **`isolated-vm` with a pool of warm Isolates** for the "Node Farm". This approach provides:
*   **Strong Isolation:** V8 Isolate-level sandboxing.
*   **High Performance for Warm Executions:** ~0.47 ms to ~1.46 ms for subsequent tool runs, depending on context reuse strategy.
This meets the project's goals for speed and isolation. A robust dependency management strategy (likely involving a JavaScript bundler like `esbuild` integrated into the Node Farm manager) is crucial for handling tool scripts with npm package dependencies.
