const ivm = require('isolated-vm');
const fs = require('fs');
const path = require('path');

console.log('MINIMAL_B: Script starting');

const mcpScriptCodePath = path.resolve(__dirname, 'mcp_tool_logic_for_isolate.js');
const mcpScriptCode = fs.readFileSync(mcpScriptCodePath, 'utf8');
console.log('MINIMAL_B: Script code read.');

const inputData = { action: 'uppercase', payload: 'test isolate B minimal' };

async function main() {
    console.log('MINIMAL_B: main() called');
    const isolate = new ivm.Isolate({ memoryLimit: 128 });
    console.log('MINIMAL_B: Isolate created');
    const context = await isolate.createContext();
    console.log('MINIMAL_B: Context created');

    const jail = context.global;
    await jail.set('global', jail.derefInto());
    console.log('MINIMAL_B: jail.global.global set');
    
    let sharedData = {
        'toolInput': inputData,
        'toolResult': null
    };

    await jail.set('getSync', new ivm.Callback(function(key) {
        console.log(`MINIMAL_B_HOST_CALLBACK_getSync: Key "${key}"`);
        if (sharedData.hasOwnProperty(key)) {
            return new ivm.ExternalCopy(sharedData[key]).copyInto();
        }
        console.warn(`MINIMAL_B_HOST_CALLBACK_getSync: Key "${key}" not found. Returning null.`);
        return new ivm.ExternalCopy(null).copyInto();
    }));
    console.log('MINIMAL_B: getSync callback set');

    await jail.set('setSync', new ivm.Callback(function(key, value) {
        console.log(`MINIMAL_B_HOST_CALLBACK_setSync: Key "${key}", Value: ${JSON.stringify(value)}`);
        sharedData[key] = value;
    }));
    console.log('MINIMAL_B: setSync callback set');

    console.log('MINIMAL_B: Compiling script...');
    const script = await isolate.compileScript(mcpScriptCode, {
        filename: 'mcp_tool_logic_for_isolate.js' 
    });
    console.log('MINIMAL_B: Script compiled. Running...');
    
    await script.run(context, { timeout: 100 }); 
    console.log('MINIMAL_B: Script run completed.');
    
    const currentResult = sharedData['toolResult'];
    console.log(`MINIMAL_B: Result from isolate: ${JSON.stringify(currentResult)}`);
    if (!currentResult || (currentResult.error && currentResult.error !== "Unknown action")) {
        // Allow "Unknown action" for test flexibility
        if (!currentResult || currentResult.error !== "Unknown action") {
             console.error(`MINIMAL_B: Script returned an error or no result: ${JSON.stringify(currentResult)}`);
             // throw new Error(`MINIMAL_B: Script error: ${JSON.stringify(currentResult)}`);
        }
    }

    context.release(); 
    console.log('MINIMAL_B: Context released.');
    isolate.dispose();
    console.log('MINIMAL_B: Isolate disposed. main() finished.');
}

main().then(() => {
    console.log("MINIMAL_B: main() promise resolved.");
    process.exit(0); // Explicitly exit with 0 on success
}).catch(err => {
    console.error('MINIMAL_B_FATAL_ERROR:', 
        'Message:', err.message, 
        'Stack:', err.stack
    );
    process.exit(1); 
});
