const ivm = require('isolated-vm');
const fs = require('fs');
const path = require('path');
// const { v4: uuidv4Function } = require('uuid'); // Intentionally not using the real one for this test

// console.log('benchmark_deps_uuid.js: Script starting. FORCING PLACEHOLDER FOR UUIDV4.');

// 1. Force use of the placeholder for uuid.v4
let uuidv4CodeString = `
    function uuidv4_placeholder() {
        let d = Date.now(); 
        if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
          d += performance.now(); 
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = (d + Math.random()*16)%16 | 0;
            d = Math.floor(d/16);
            return (c=='x' ? r : (r&0x3|0x8)).toString(16);
        });
    }
`;
// console.warn('benchmark_deps_uuid.js: Using a JS placeholder for uuidv4 FORCED.');


// 2. Read MCP script code
const mcpScriptBPath = path.resolve(__dirname, 'mcp_script_B_uuid.js');
const mcpScriptBCode = fs.readFileSync(mcpScriptBPath, 'utf8');
// console.log('benchmark_deps_uuid.js: mcp_script_B_uuid.js code read.');

// 3. Construct the combined script
const combinedScriptCodeForUuid = `
// === uuid.v4 bundled code (placeholder) START ===
global.uuidv4 = (${uuidv4CodeString}); // Assign the placeholder function
// === uuid.v4 bundled code END ===

// === mcp_script_B_uuid.js code START ===
${mcpScriptBCode}
// === mcp_script_B_uuid.js code END ===
`;
// console.log('benchmark_deps_uuid.js: Combined script for UUID (placeholder) constructed.');
// fs.writeFileSync('./combined_uuid_debug_placeholder.js', combinedScriptCodeForUuid); // For debugging

const iterationsInScript = 10; // Number of context cycles

async function main() {
    // console.log('benchmark_deps_uuid.js: main() called');
    const isolate = new ivm.Isolate({ memoryLimit: 128 });
    // console.log('benchmark_deps_uuid.js: Isolate created');
    
    let totalInternalCycleTimeNs = 0n;
    let sharedData = {}; 

    for (let i = 0; i < iterationsInScript; i++) {
        const cycleStartTime = process.hrtime.bigint();

        const context = await isolate.createContext();
        const jail = context.global;
        await jail.set('global', jail.derefInto());

        sharedData = { 'toolResult': null }; 

        await jail.set('getSync', new ivm.Callback(function(key) {
            if (sharedData.hasOwnProperty(key)) { return new ivm.ExternalCopy(sharedData[key]).copyInto(); }
            return new ivm.ExternalCopy(null).copyInto();
        }));
        await jail.set('setSync', new ivm.Callback(function(key, value) {
            sharedData[key] = value;
        }));
    
        const script = await isolate.compileScript(combinedScriptCodeForUuid, {
            filename: 'mcp_script_B_uuid_placeholder_bundled.js'
        });
        
        await script.run(context, { timeout: 100 });
        
        // const currentResult = sharedData['toolResult']; 
        // if (currentResult && currentResult.error) throw new Error(\`Iter \${i} error: \${currentResult.error}\`);

        context.release();
        const cycleEndTime = process.hrtime.bigint();
        totalInternalCycleTimeNs += (cycleEndTime - cycleStartTime);
    }
    
    const averageCycleTimeMs = Number(totalInternalCycleTimeNs / BigInt(iterationsInScript)) / 1e6;
    console.log(averageCycleTimeMs.toFixed(4)); 

    isolate.dispose();
    // console.log('benchmark_deps_uuid.js: Isolate disposed. main() finished.');
}

main().catch(err => {
    console.error('FATAL_ERROR in benchmark_deps_uuid.js (placeholder forced):', 
        'Message:', err.message, 
        'Stack:', err.stack
    );
    process.exit(1);
});
