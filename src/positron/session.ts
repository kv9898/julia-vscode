/*---------------------------------------------------------------------------------------------
 *  Julia Runtime Session
 *  Implements the LanguageRuntimeSession interface for Positron
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode'
import * as positron from 'positron'
import { ChildProcess, spawn } from 'child_process'
import * as crypto from 'crypto'
import { JuliaRuntimeExtraData } from './runtimeMetadata'

/**
 * Represents a Julia runtime session in Positron.
 */
export class JuliaRuntimeSession implements positron.LanguageRuntimeSession {
    private readonly onDidReceiveRuntimeMessageEmitter = new vscode.EventEmitter<positron.LanguageRuntimeMessage>()
    private readonly onDidChangeRuntimeStateEmitter = new vscode.EventEmitter<positron.RuntimeState>()
    private readonly onDidEndSessionEmitter = new vscode.EventEmitter<positron.LanguageRuntimeExit>()

    public readonly onDidReceiveRuntimeMessage = this.onDidReceiveRuntimeMessageEmitter.event
    public readonly onDidChangeRuntimeState = this.onDidChangeRuntimeStateEmitter.event
    public readonly onDidEndSession = this.onDidEndSessionEmitter.event

    public runtimeInfo: positron.LanguageRuntimeInfo | undefined

    private juliaProcess: ChildProcess | undefined
    private currentState: positron.RuntimeState = positron.RuntimeState.Uninitialized
    private _dynState: positron.LanguageRuntimeDynState

    constructor(
        public readonly runtimeMetadata: positron.LanguageRuntimeMetadata,
        public readonly metadata: positron.RuntimeSessionMetadata,
        _context: vscode.ExtensionContext
    ) {
        // Initialize dynamic state
        this._dynState = {
            inputPrompt: 'julia> ',
            continuationPrompt: '       ',
            sessionName: `Julia ${this.runtimeMetadata.languageVersion}`
        }
    }

    /**
     * Gets the dynamic state of the runtime (async version for Positron API).
     */
    async getDynState(): Promise<positron.LanguageRuntimeDynState> {
        return this._dynState
    }

    /**
     * Gets the dynamic state of the runtime (sync version for internal use).
     */
    dynState(): positron.LanguageRuntimeDynState {
        return this._dynState
    }

    /**
     * Updates the session name.
     */
    async updateSessionName(name: string): Promise<void> {
        this._dynState.sessionName = name
    }

    /**
     * Debugger support (not yet implemented).
     */
    async debug(request: any): Promise<any> {
        throw new Error('Debug support not yet implemented for Julia')
    }

    /**
     * Disposes of the session.
     */
    dispose(): void {
        if (this.juliaProcess) {
            this.juliaProcess.kill()
        }
    }

    /**
     * Starts the Julia runtime session.
     */
    async start(): Promise<positron.LanguageRuntimeInfo> {
        this.setState(positron.RuntimeState.Starting)

        try {
            const extraData = this.runtimeMetadata.extraRuntimeData as JuliaRuntimeExtraData

            // Start Julia process
            this.juliaProcess = spawn(
                extraData.juliaPath,
                [...extraData.juliaArgs, '--startup-file=no', '--history-file=no'],
                {
                    env: {
                        ...process.env,
                        JULIA_NUM_THREADS: 'auto'
                    }
                }
            )

            // Handle process output
            if (this.juliaProcess.stdout) {
                this.juliaProcess.stdout.on('data', (data) => {
                    this.handleOutput(data.toString())
                })
            }

            if (this.juliaProcess.stderr) {
                this.juliaProcess.stderr.on('data', (data) => {
                    this.handleError(data.toString())
                })
            }

            this.juliaProcess.on('exit', (code) => {
                this.handleExit(code)
            })

            // Wait a moment for the process to start
            await new Promise(resolve => setTimeout(resolve, 1000))

            this.setState(positron.RuntimeState.Ready)

            this.runtimeInfo = {
                banner: `Julia ${this.runtimeMetadata.languageVersion} (${extraData.arch || 'unknown'})`,
                implementation_version: this.runtimeMetadata.languageVersion,
                language_version: this.runtimeMetadata.languageVersion,
                input_prompt: this._dynState.inputPrompt,
                continuation_prompt: this._dynState.continuationPrompt
            }

            return this.runtimeInfo
        } catch (error) {
            this.setState(positron.RuntimeState.Exited)
            throw error
        }
    }

    /**
     * Executes code in the Julia runtime.
     */
    async execute(
        code: string,
        id: string,
        mode: positron.RuntimeCodeExecutionMode,
        errorBehavior: positron.RuntimeErrorBehavior
    ): Promise<void> {
        if (!this.juliaProcess || !this.juliaProcess.stdin) {
            throw new Error('Julia process not running')
        }

        this.setState(positron.RuntimeState.Busy)

        // Send input message
        this.onDidReceiveRuntimeMessageEmitter.fire({
            id: id,
            parent_id: '',
            when: new Date().toISOString(),
            type: positron.LanguageRuntimeMessageType.Input,
            code: code,
            execution_count: 0
        } as positron.LanguageRuntimeInput)

        // Write code to Julia process
        this.juliaProcess.stdin.write(code + '\n')

        // TODO: Actually wait for execution to complete
        // For now, we'll just set state back to idle after a delay
        setTimeout(() => {
            this.setState(positron.RuntimeState.Idle)
        }, 100)
    }

    /**
     * Checks if code is complete.
     */
    async isCodeFragmentComplete(code: string): Promise<positron.RuntimeCodeFragmentStatus> {
        // Simple heuristic: if it ends with a backslash or has unclosed brackets, it's incomplete
        const trimmed = code.trim()
        if (trimmed.endsWith('\\')) {
            return positron.RuntimeCodeFragmentStatus.Incomplete
        }

        // Count brackets
        const openBrackets = (trimmed.match(/[\(\[\{]/g) || []).length
        const closeBrackets = (trimmed.match(/[\)\]\}]/g) || []).length

        if (openBrackets > closeBrackets) {
            return positron.RuntimeCodeFragmentStatus.Incomplete
        }

        return positron.RuntimeCodeFragmentStatus.Complete
    }

    /**
     * Creates a client for the runtime.
     */
    async createClient(id: string, type: positron.RuntimeClientType, params: any): Promise<void> {
        // TODO: Implement client creation for variables, plots, etc.
        console.log(`Create client request: ${type}`)
    }

    /**
     * Lists all clients.
     */
    async listClients(type?: positron.RuntimeClientType): Promise<Record<string, string>> {
        // TODO: Implement client listing
        return {}
    }

    /**
     * Removes a client.
     */
    async removeClient(id: string): Promise<void> {
        // TODO: Implement client removal
    }

    /**
     * Sends a message to a client.
     */
    async sendClientMessage(clientId: string, messageId: string, message: any): Promise<void> {
        // TODO: Implement client messaging
    }

    /**
     * Replies to a runtime message prompt.
     */
    async replyToPrompt(id: string, reply: string): Promise<void> {
        // TODO: Implement prompt reply
    }

    /**
     * Restarts the runtime.
     */
    async restart(): Promise<void> {
        this.setState(positron.RuntimeState.Restarting)
        
        if (this.juliaProcess) {
            this.juliaProcess.kill()
        }

        await this.start()
    }

    /**
     * Interrupts the currently executing code.
     */
    async interrupt(): Promise<void> {
        if (this.juliaProcess) {
            this.juliaProcess.kill('SIGINT')
            this.setState(positron.RuntimeState.Idle)
        }
    }

    /**
     * Shuts down the runtime.
     */
    async shutdown(exitReason: positron.RuntimeExitReason): Promise<void> {
        this.setState(positron.RuntimeState.Exiting)

        if (this.juliaProcess) {
            this.juliaProcess.kill()
        }

        this.onDidEndSessionEmitter.fire({
            runtime_name: this.runtimeMetadata.runtimeName,
            session_name: this._dynState.sessionName,
            exit_code: 0,
            reason: exitReason,
            message: 'Julia runtime shut down'
        })

        this.setState(positron.RuntimeState.Exited)
    }

    /**
     * Forces a shutdown of the runtime.
     */
    async forceQuit(): Promise<void> {
        if (this.juliaProcess) {
            this.juliaProcess.kill('SIGKILL')
        }
        this.setState(positron.RuntimeState.Exited)
    }

    /**
     * Shows a message in the runtime.
     */
    async showMessage(message: string): Promise<void> {
        // Send as a stream message
        this.onDidReceiveRuntimeMessageEmitter.fire({
            id: crypto.randomUUID(),
            parent_id: '',
            when: new Date().toISOString(),
            type: positron.LanguageRuntimeMessageType.Stream,
            name: 'stdout',
            text: message
        } as positron.LanguageRuntimeStream)
    }

    /**
     * Shows a question to the user.
     */
    async showQuestion(message: string): Promise<void> {
        // TODO: Implement question prompt
    }

    /**
     * Shows an activity message.
     */
    async showActivity(message: string): Promise<void> {
        // TODO: Implement activity message
    }

    /**
     * Sets a working directory.
     */
    async setWorkingDirectory(dir: string): Promise<void> {
        // TODO: Implement working directory change
    }

    /**
     * Sets the maximum output size.
     */
    async setMaxOutputSize(size: number): Promise<void> {
        // TODO: Implement output size limit
    }

    /**
     * Opens a resource.
     */
    async openResource(resource: vscode.Uri): Promise<boolean> {
        return vscode.env.openExternal(resource)
    }

    /**
     * Gets environment variables.
     */
    async getEnv(): Promise<{ [key: string]: string }> {
        return process.env as { [key: string]: string }
    }

    /**
     * Calls a method on the runtime.
     */
    async callMethod(method: string, ...args: any[]): Promise<any> {
        // TODO: Implement method calling
        throw new Error('Method not implemented')
    }

    // Private helper methods

    private setState(newState: positron.RuntimeState) {
        if (this.currentState !== newState) {
            this.currentState = newState
            this.onDidChangeRuntimeStateEmitter.fire(newState)

            // Also emit a state message for runtime online states
            let onlineState: positron.RuntimeOnlineState | undefined
            switch (newState) {
                case positron.RuntimeState.Starting:
                    onlineState = positron.RuntimeOnlineState.Starting
                    break
                case positron.RuntimeState.Idle:
                case positron.RuntimeState.Ready:
                    onlineState = positron.RuntimeOnlineState.Idle
                    break
                case positron.RuntimeState.Busy:
                    onlineState = positron.RuntimeOnlineState.Busy
                    break
            }

            if (onlineState) {
                this.onDidReceiveRuntimeMessageEmitter.fire({
                    id: crypto.randomUUID(),
                    parent_id: '',
                    when: new Date().toISOString(),
                    type: positron.LanguageRuntimeMessageType.State,
                    state: onlineState
                } as positron.LanguageRuntimeState)
            }
        }
    }

    private handleOutput(data: string) {
        this.onDidReceiveRuntimeMessageEmitter.fire({
            id: crypto.randomUUID(),
            parent_id: '',
            when: new Date().toISOString(),
            type: positron.LanguageRuntimeMessageType.Stream,
            name: 'stdout',
            text: data
        } as positron.LanguageRuntimeStream)
    }

    private handleError(data: string) {
        this.onDidReceiveRuntimeMessageEmitter.fire({
            id: crypto.randomUUID(),
            parent_id: '',
            when: new Date().toISOString(),
            type: positron.LanguageRuntimeMessageType.Stream,
            name: 'stderr',
            text: data
        } as positron.LanguageRuntimeStream)
    }

    private handleExit(code: number | null) {
        const exitReason = code === 0 
            ? positron.RuntimeExitReason.Shutdown 
            : positron.RuntimeExitReason.Error

        this.onDidEndSessionEmitter.fire({
            runtime_name: this.runtimeMetadata.runtimeName,
            session_name: this._dynState.sessionName,
            exit_code: code || 0,
            reason: exitReason,
            message: `Julia process exited with code ${code}`
        })

        this.setState(positron.RuntimeState.Exited)
    }
}
