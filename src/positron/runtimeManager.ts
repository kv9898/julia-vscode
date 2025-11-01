/*---------------------------------------------------------------------------------------------
 *  Positron Runtime Manager for Julia
 *  Implements the LanguageRuntimeManager interface for Positron
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode'
import * as positron from 'positron'
import { JuliaExecutablesFeature } from '../juliaexepath'
import { createJuliaRuntimeMetadata } from './runtimeMetadata'
import { JuliaRuntimeSession } from './session'

/**
 * Provides Julia language runtime metadata and sessions to Positron;
 * implements positron.LanguageRuntimeManager.
 */
export class JuliaRuntimeManager implements positron.LanguageRuntimeManager {
    /**
     * A map of Julia interpreter paths to their language runtime metadata.
     */
    readonly registeredJuliaRuntimes: Map<string, positron.LanguageRuntimeMetadata> = new Map()

    private readonly onDidDiscoverRuntimeEmitter = new vscode.EventEmitter<positron.LanguageRuntimeMetadata>()

    /**
     * An event that fires when a new Julia language runtime is discovered.
     */
    public readonly onDidDiscoverRuntime = this.onDidDiscoverRuntimeEmitter.event

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly juliaExecutablesFeature: JuliaExecutablesFeature
    ) {
    }

    /**
     * Discovers all available Julia runtimes on the system.
     */
    async *discoverAllRuntimes(): AsyncGenerator<positron.LanguageRuntimeMetadata> {
        // Get all Julia executables
        const juliaExecutables = await this.juliaExecutablesFeature.getJuliaExePathsAsync()

        for (const juliaExe of juliaExecutables) {
            const metadata = await createJuliaRuntimeMetadata(
                juliaExe,
                this.context,
                false // not recommended for workspace by default
            )
            
            if (metadata) {
                this.registeredJuliaRuntimes.set(juliaExe.file, metadata)
                yield metadata
            }
        }
    }

    /**
     * Returns the recommended Julia runtime for the current workspace, if any.
     */
    async recommendedWorkspaceRuntime(): Promise<positron.LanguageRuntimeMetadata | undefined> {
        // Get the active Julia executable (respects user settings)
        const activeJuliaExe = await this.juliaExecutablesFeature.getActiveJuliaExecutableAsync()

        if (activeJuliaExe) {
            const metadata = await createJuliaRuntimeMetadata(
                activeJuliaExe,
                this.context,
                true // recommended for workspace
            )
            
            if (metadata) {
                this.registeredJuliaRuntimes.set(activeJuliaExe.file, metadata)
                return metadata
            }
        }

        return undefined
    }

    /**
     * Creates a new Julia runtime session.
     */
    async createSession(
        runtimeMetadata: positron.LanguageRuntimeMetadata,
        sessionMetadata: positron.RuntimeSessionMetadata
    ): Promise<positron.LanguageRuntimeSession> {
        const session = new JuliaRuntimeSession(
            runtimeMetadata,
            sessionMetadata,
            this.context
        )

        return session
    }

    /**
     * Validates runtime metadata (optional).
     */
    async validateMetadata(
        metadata: positron.LanguageRuntimeMetadata
    ): Promise<positron.LanguageRuntimeMetadata> {
        // For now, we'll just return the metadata as-is
        // In the future, we could validate that the Julia binary still exists
        return metadata
    }

    /**
     * Registers a new Julia runtime with Positron.
     */
    registerLanguageRuntime(runtime: positron.LanguageRuntimeMetadata): void {
        this.onDidDiscoverRuntimeEmitter.fire(runtime)
    }
}
