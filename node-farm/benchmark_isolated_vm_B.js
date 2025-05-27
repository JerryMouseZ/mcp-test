const ivm = require('isolated-vm');
const fs = require('fs');
const path = require('path');

// console.log('benchmark_isolated_vm_B.js: Script starting');

const mcpScriptCodePath = path.resolve(__dirname, 'mcp_tool_logic_for_isolate.js');
// console.log(`benchmark_isolated_vm_B.js: Attempting to read ${mcpScriptCodePath}`);
const mcpScriptCode = fs.readFileSync(mcpScriptCodePath, 'utf8'); // This now reads the IIFE version
// console.log('benchmark_isolated_vm_B.js: Script code read successfully.');

const inputData = { action: 'uppercase', payload: 'test isolate B' };
const compileRunIterations = 10; // Number of compile+run cycles in the same context

async function main() {
    // console.log('benchmark_isolated_vm_B.js: main() called');
    const isolate = new ivm.Isolate({ memoryLimit: 128 }); 
    // console.log('benchmark_isolated_vm_B.js: Isolate created');
    const context = await isolate.createContext();
    // console.log('benchmark_isolated_vm_B.js: Context created');

    const jail = context.global;
    await jail.set('global', jail.derefInto()); // Allows 'global.getSync' etc. inside isolate
    // console.log('benchmark_isolated_vm_B.js: jail.global.global set');
    
    // Setup sharedData and callbacks for getSync/setSync
    // This is crucial for mcp_tool_logic_for_isolate.js to work.
    let sharedData = {
        'toolInput': inputData, // Set initial input
        'toolResult': null
    };

    await jail.set('getSync', new ivm.Callback(function(key) {
        // console.log(`HOST_CALLBACK_getSync_B: Called with key "${key}"`);
        if (sharedData.hasOwnProperty(key)) {
            return new ivm.ExternalCopy(sharedData[key]).copyInto();
        }
        // console.warn(`HOST_CALLBACK_getSync_B: Key "${key}" not found. Returning null.`);
        return new ivm.ExternalCopy(null).copyInto();
    }));
    // console.log('benchmark_isolated_vm_B.js: getSync callback set on jail');

    await jail.set('setSync', new ivm.Callback(function(key, value) {
        // console.log(`HOST_CALLBACK_setSync_B: Called with key "${key}", value: ${JSON.stringify(value)}`);
        sharedData[key] = value;
    }));
    // console.log('benchmark_isolated_vm_B.js: setSync callback set on jail');

    // The loop for re-compiling and re-running the script in the same context
    // const loopStartTime = process.hrtime.bigint(); 

    for (let i = 0; i < compileRunIterations; i++) {
        // If input needed to change per iteration:
        // sharedData['toolInput'] = { action: 'uppercase', payload: `test iter ${i}` };
        
        // console.log(`benchmark_isolated_vm_B.js: Iteration ${i}, Compiling script...`);
        const script = await isolate.compileScript(mcpScriptCode, {
            filename: 'mcp_tool_logic_for_isolate.js' // For stack traces if errors
        });
        // console.log(`benchmark_isolated_vm_B.js: Iteration ${i}, Script compiled. Running...`);
        
        try {
            await script.run(context, { timeout: 100 }); // Run in the same context
            // script.release(); // Optional: release script resources
            // const currentResult = sharedData['toolResult']; // Optional: verify result
            // console.log(`benchmark_isolated_vm_B.js: Iteration ${i}, Result: ${JSON.stringify(currentResult)}`);
            // if (currentResult && currentResult.error && currentResult.error !== "Unknown action") {
            //     throw new Error(`Inner script error on iter ${i}: ${currentResult.error}`);
            // }
        } catch (e) {
            // console.error(`benchmark_isolated_vm_B.js: Iteration ${i}, Error during script.run():`, e);
            throw e; // Propagate error to be caught by main().catch()
        }
    }

    // const loopEndTime = process.hrtime.bigint();
    // const avgLoopTimeNs = (loopEndTime - loopStartTime) / BigInt(compileRunIterations);
    // Hyperfine measures the total time of this script.
    // The value of avgLoopTimeNs / 1e6 would be the internal average for the N iterations.
    // console.log(`INTERNAL_AVG_COMPILE_RUN_MS_B: ${Number(avgLoopTimeNs) / 1e6}`);

    context.release(); // Synchronous
    // console.log('benchmark_isolated_vm_B.js: Context released.');
    isolate.dispose(); // Synchronous
    // console.log('benchmark_isolated_vm_B.js: Isolate disposed. main() finished.');
}

main().catch(err => {
    console.error('FATAL_ERROR in benchmark_isolated_vm_B.js:', 
        'Message:', err.message, 
        'Stack:', err.stack
    );
    process.exit(1); 
});
