const ivm = require('isolated-vm');
const fs = require('fs');
const path = require('path');

// console.log('benchmark_deps_lodash.js: Script starting');

// 1. Resolve and read dependency code (lodash.isempty)
const lodashIsEmptyPath = require.resolve('lodash.isempty');
const lodashIsEmptyCode = fs.readFileSync(lodashIsEmptyPath, 'utf8');
// console.log('benchmark_deps_lodash.js: lodash.isempty code read.');

// 2. Read MCP script code
const mcpScriptAPath = path.resolve(__dirname, 'mcp_script_A_lodash.js');
const mcpScriptACode = fs.readFileSync(mcpScriptAPath, 'utf8');
// console.log('benchmark_deps_lodash.js: mcp_script_A_lodash.js code read.');

// 3. Construct the combined script
// Strategy: Wrap lodash.isempty to get its exported function and assign to global.isEmpty
const combinedScriptCode = `
// === lodash.isempty bundled code START ===
let resolvedIsEmpty;
(function() {
    // Create a context similar to Node.js module loading
    let module = { exports: {} };
    let exports = module.exports;
    // lodash.isempty source code:
    ${lodashIsEmptyCode}
    // Assign the exported function (or object if it's not default export)
    resolvedIsEmpty = module.exports; 
})();
global.isEmpty = resolvedIsEmpty; // Make it available to mcp_script_A_lodash.js
// === lodash.isempty bundled code END ===

// === mcp_script_A_lodash.js code START ===
${mcpScriptACode}
// === mcp_script_A_lodash.js code END ===
`;
// console.log('benchmark_deps_lodash.js: Combined script constructed.');
// fs.writeFileSync('./combined_lodash_debug.js', combinedScriptCode); // For debugging the bundle

const inputData = { value: [] }; // Example input for isEmpty
const iterationsInScript = 10; // Number of context cycles

async function main() {
    // console.log('benchmark_deps_lodash.js: main() called');
    const isolate = new ivm.Isolate({ memoryLimit: 128 });
    // console.log('benchmark_deps_lodash.js: Isolate created');
    
    let totalInternalCycleTimeNs = 0n;
    let sharedData = {};

    for (let i = 0; i < iterationsInScript; i++) {
        const cycleStartTime = process.hrtime.bigint();

        const context = await isolate.createContext();
        const jail = context.global;
        await jail.set('global', jail.derefInto());

        sharedData = { 'toolInput': inputData, 'toolResult': null };

        await jail.set('getSync', new ivm.Callback(function(key) {
            if (sharedData.hasOwnProperty(key)) {
                return new ivm.ExternalCopy(sharedData[key]).copyInto();
            }
            return new ivm.ExternalCopy(null).copyInto();
        }));
        await jail.set('setSync', new ivm.Callback(function(key, value) {
            sharedData[key] = value;
        }));
    
        const script = await isolate.compileScript(combinedScriptCode, {
            filename: 'mcp_script_A_lodash_bundled.js'
        });
        
        await script.run(context, { timeout: 100 });
        
        // const currentResult = sharedData['toolResult']; // Optional: verify
        // console.log(\`benchmark_deps_lodash.js: Iter \${i}, Result: \${JSON.stringify(currentResult)}\`);
        // if (currentResult && currentResult.error) throw new Error(\`Iter \${i} error: \${currentResult.error}\`);

        context.release();
        const cycleEndTime = process.hrtime.bigint();
        totalInternalCycleTimeNs += (cycleEndTime - cycleStartTime);
    }
    
    const averageCycleTimeMs = Number(totalInternalCycleTimeNs / BigInt(iterationsInScript)) / 1e6;
    console.log(averageCycleTimeMs.toFixed(4)); 

    isolate.dispose();
    // console.log('benchmark_deps_lodash.js: Isolate disposed. main() finished.');
}

main().catch(err => {
    // console.error('FATAL_ERROR in benchmark_deps_lodash.js:', 
    //     'Message:', err.message, 
    //     'Stack:', err.stack
    // );
    process.exit(1);
});
