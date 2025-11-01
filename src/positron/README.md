# Positron Support for Julia

This directory contains the implementation of Positron runtime support for the Julia extension.

## Overview

Positron is a data science IDE built on VS Code. This integration allows Julia to be used as a language runtime in Positron, providing:

- Automatic discovery of Julia installations
- Console/REPL integration
- Runtime management (start, stop, restart)
- Code execution
- Session management

## Architecture

### Components

1. **runtimeManager.ts** - Implements `LanguageRuntimeManager` interface
   - Discovers all available Julia installations on the system
   - Determines the recommended workspace runtime
   - Creates runtime sessions
   - Validates runtime metadata

2. **runtimeMetadata.ts** - Creates runtime metadata
   - Generates unique runtime IDs
   - Extracts version and architecture information
   - Determines runtime source (Juliaup, System, PATH, etc.)
   - Loads Julia icon

3. **session.ts** - Implements `LanguageRuntimeSession` interface
   - Manages Julia process lifecycle
   - Handles code execution
   - Processes runtime messages (stdout, stderr, state changes)
   - Implements REPL functionality

## Integration

The Positron runtime manager is registered in the main extension activation (`extension.ts`):

```typescript
try {
    const positron = await import('positron')
    const { JuliaRuntimeManager } = await import('./positron/runtimeManager')
    const juliaRuntimeManager = new JuliaRuntimeManager(context, g_juliaExecutablesFeature)
    context.subscriptions.push(positron.runtime.registerLanguageRuntimeManager('julia', juliaRuntimeManager))
} catch (error) {
    // Positron API not available (running in VS Code)
}
```

This ensures the extension continues to work in regular VS Code while adding Positron support when available.

## Current Status

### Implemented
- ✅ Runtime discovery via existing Julia executable detection
- ✅ Runtime metadata generation
- ✅ Basic session management
- ✅ Process spawning and lifecycle management
- ✅ Basic REPL/console output
- ✅ Code execution interface

### TODO
- ⚠️ Proper Julia kernel integration (currently just spawns basic Julia process)
- ⚠️ Variables pane support
- ⚠️ Plot support
- ⚠️ Help pane integration
- ⚠️ Debugger integration
- ⚠️ Working directory management
- ⚠️ Environment variable handling
- ⚠️ Interrupt handling
- ⚠️ Code completeness detection
- ⚠️ Session restoration

## Testing

To test this implementation:

1. Install Positron from https://github.com/posit-dev/positron
2. Build this extension: `npm run compile && npm run webpack`
3. Install the extension in Positron
4. Open a Julia file or workspace
5. Julia should appear in the runtime selector
6. Start a Julia console

## Related Files

- `../positron.d.ts` - TypeScript definitions for Positron API
- `../juliaexepath.ts` - Julia executable detection and management
- `../extension.ts` - Main extension activation

## References

- [Positron Repository](https://github.com/posit-dev/positron)
- [Positron Python Extension](https://github.com/posit-dev/positron/tree/main/extensions/positron-python)
- [Positron R Extension](https://github.com/posit-dev/positron/tree/main/extensions/positron-r)
