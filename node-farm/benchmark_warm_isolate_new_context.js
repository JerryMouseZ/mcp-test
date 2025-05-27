const ivm = require('isolated-vm');
const fs = require('fs');
const path = require('path');

// console.log('benchmark_warm_isolate_new_context.js: Script starting');

const mcpScriptCodePath = path.resolve(__dirname, 'mcp_tool_logic_for_isolate.js');
// console.log(`benchmark_warm_isolate_new_context.js: Attempting to read ${mcpScriptCodePath}`);
const mcpScriptCode = fs.readFileSync(mcpScriptCodePath, 'utf8');
// console.log('benchmark_warm_isolate_new_context.js: Script code read successfully.');

const inputData = { action: 'uppercase', payload: 'test warm isolate new context' };
const iterationsInScript = 10; // Number of context cycles within one benchmark script execution

async function main() {
    // console.log('benchmark_warm_isolate_new_context.js: main() called');
    const isolate = new ivm.Isolate({ memoryLimit: 128 }); // Isolate created once
    // console.log('benchmark_warm_isolate_new_context.js: Isolate created');
    
    let totalInternalCycleTimeNs = 0n; // Use BigInt for nanoseconds sum

    // Setup for mcp_tool_logic_for_isolate.js to use getSync/setSync
    // This sharedData will be accessed by callbacks from different contexts,
    // but each context gets its own 'toolInput' set via global.setSync.
    // For this benchmark, the state of sharedData across contexts is not critical
    // as each context cycle is independent for mcp_tool_logic_for_isolate.js.
    let sharedData = {}; 

    for (let i = 0; i < iterationsInScript; i++) {
        const cycleStartTime = process.hrtime.bigint();

        const context = await isolate.createContext(); // New context each time
        // console.log(`benchmark_warm_isolate_new_context.js: Iteration ${i}, Context created`);

        const jail = context.global;
        await jail.set('global', jail.derefInto());
        // console.log(`benchmark_warm_isolate_new_context.js: Iteration ${i}, jail.global.global set`);

        // Reset or re-initialize sharedData for this context if needed,
        // or pass distinct data. For this script, mcp_tool_logic_for_isolate.js
        // will always use 'toolInput' and 'toolResult'.
        sharedData = { // Reset sharedData for each cycle to ensure clean state for getSync/setSync
            'toolInput': inputData, 
            'toolResult': null
        };

        await jail.set('getSync', new ivm.Callback(function(key) {
            // console.log(`HOST_CALLBACK_getSync_WarmNewCtx: Iter ${i}, Key "${key}"`);
            if (sharedData.hasOwnProperty(key)) {
                return new ivm.ExternalCopy(sharedData[key]).copyInto();
            }
            return new ivm.ExternalCopy(null).copyInto();
        }));
        // console.log(`benchmark_warm_isolate_new_context.js: Iteration ${i}, getSync callback set`);

        await jail.set('setSync', new ivm.Callback(function(key, value) {
            // console.log(`HOST_CALLBACK_setSync_WarmNewCtx: Iter ${i}, Key "${key}", Value: ${JSON.stringify(value)}`);
            sharedData[key] = value;
        }));
        // console.log(`benchmark_warm_isolate_new_context.js: Iteration ${i}, setSync callback set`);
    
        // console.log(`benchmark_warm_isolate_new_context.js: Iteration ${i}, Compiling script...`);
        const script = await isolate.compileScript(mcpScriptCode, {
            filename: 'mcp_tool_logic_for_isolate.js' // For stack traces
        });
        // console.log(`benchmark_warm_isolate_new_context.js: Iteration ${i}, Script compiled. Running...`);
        
        await script.run(context, { timeout: 100 });
        // console.log(`benchmark_warm_isolate_new_context.js: Iteration ${i}, Script run completed.`);
        
        // const currentResult = sharedData['toolResult']; // Optional: verify result
        // console.log(`benchmark_warm_isolate_new_context.js: Iteration ${i}, Result: ${JSON.stringify(currentResult)}`);

        context.release(); // Release the context
        // console.log(`benchmark_warm_isolate_new_context.js: Iteration ${i}, Context released.`);

        const cycleEndTime = process.hrtime.bigint();
        totalInternalCycleTimeNs += (cycleEndTime - cycleStartTime);
    }
    
    const averageCycleTimeMs = Number(totalInternalCycleTimeNs / BigInt(iterationsInScript)) / 1e6;
    // This console.log is the primary output for this benchmark.
    console.log(averageCycleTimeMs.toFixed(4)); 

    isolate.dispose();
    // console.log('benchmark_warm_isolate_new_context.js: Isolate disposed. main() finished.');
}

main().catch(err => {
    // console.error('FATAL_ERROR in benchmark_warm_isolate_new_context.js:', 
    //     'Message:', err.message, 
    //     'Stack:', err.stack
    // );
    process.exit(1);
});
