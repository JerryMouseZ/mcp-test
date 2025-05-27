const ivm = require('isolated-vm');
const fs =require('fs');
const path = require('path');

// console.log('benchmark_isolated_vm_A.js: Script starting');

const mcpScriptCodePath = path.resolve(__dirname, 'mcp_tool_logic_for_isolate.js');
// console.log(`benchmark_isolated_vm_A.js: Attempting to read ${mcpScriptCodePath}`);
const mcpScriptCode = fs.readFileSync(mcpScriptCodePath, 'utf8');
// console.log('benchmark_isolated_vm_A.js: Script code read successfully.');

const inputData = { action: 'uppercase', payload: 'test isolate A from benchmark' };

async function main() {
    // console.log('benchmark_isolated_vm_A.js: main() called');
    const isolate = new ivm.Isolate({ memoryLimit: 128 });
    // console.log('benchmark_isolated_vm_A.js: Isolate created');
    const context = await isolate.createContext();
    // console.log('benchmark_isolated_vm_A.js: Context created');

    const jail = context.global;
    await jail.set('global', jail.derefInto());
    // console.log('benchmark_isolated_vm_A.js: jail.global.global set');

    let sharedData = {
        'toolInput': inputData, // Pre-populate with expected key
        'toolResult': null      // Pre-populate for the result
    };

    await jail.set('getSync', new ivm.Callback(function(key) {
        // console.log(`HOST_CALLBACK_getSync: Called with key "${key}"`);
        if (sharedData.hasOwnProperty(key)) {
            // console.log(`HOST_CALLBACK_getSync: Returning sharedData["${key}"]: ${JSON.stringify(sharedData[key])}`);
            return new ivm.ExternalCopy(sharedData[key]).copyInto();
        }
        // console.warn(`HOST_CALLBACK_getSync: Key "${key}" not found in sharedData. Returning null.`);
        return new ivm.ExternalCopy(null).copyInto(); // Explicitly copy null
    }));
    // console.log('benchmark_isolated_vm_A.js: getSync callback set on jail');

    await jail.set('setSync', new ivm.Callback(function(key, value) {
        // console.log(`HOST_CALLBACK_setSync: Called with key "${key}", value: ${JSON.stringify(value)}`);
        sharedData[key] = value;
    }));
    // console.log('benchmark_isolated_vm_A.js: setSync callback set on jail');

    // console.log('benchmark_isolated_vm_A.js: Compiling script...');
    const script = await isolate.compileScript(mcpScriptCode, {
        filename: 'mcp_tool_logic_for_isolate.js'
    });
    // console.log('benchmark_isolated_vm_A.js: Script compiled. Running...');

    try {
        await script.run(context, { timeout: 1000 });
        // console.log('benchmark_isolated_vm_A.js: Script run completed.');
    } catch (e) {
        // console.error('benchmark_isolated_vm_A.js: Error during script.run():', e);
        throw e; // Re-throw to be caught by main().catch()
    }

    // const resultFromIsolate = sharedData['toolResult'];
    // console.log('benchmark_isolated_vm_A.js: Result from isolate:', resultFromIsolate);
    // if (!resultFromIsolate || (resultFromIsolate && resultFromIsolate.error === 'No input provided via global.toolInput')) {
    //    throw new Error(`Isolate did not process input correctly. Result: ${JSON.stringify(resultFromIsolate)}`);
    // }


    context.release();
    // console.log('benchmark_isolated_vm_A.js: Context released.');
    isolate.dispose();
    // console.log('benchmark_isolated_vm_A.js: Isolate disposed. main() finished.');
}

main().catch(err => {
    // Ensure all parts of the error are logged
    // console.error('FATAL_ERROR in benchmark_isolated_vm_A.js:', 
    //     'Message:', err.message, 
    //     'Stack:', err.stack, 
    //     'Name:', err.name, 
    //     'Details:', JSON.stringify(err) 
    // );
    process.exit(1); // Exit with 1 to signal failure to Hyperfine
});
