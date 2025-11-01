/*---------------------------------------------------------------------------------------------
 *  Julia Runtime Metadata Creator
 *  Creates LanguageRuntimeMetadata objects for Julia interpreters
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode'
import * as positron from 'positron'
import * as crypto from 'crypto'
import * as path from 'path'
import * as fs from 'fs'
import { JuliaExecutable } from '../juliaexepath'

/**
 * Extra data for Julia runtime metadata
 */
export interface JuliaRuntimeExtraData {
    juliaPath: string
    juliaVersion: string
    juliaArgs: string[]
    arch?: string
    channel?: string
}

/**
 * Creates a LanguageRuntimeMetadata object for a Julia interpreter.
 */
export async function createJuliaRuntimeMetadata(
    juliaExe: JuliaExecutable,
    context: vscode.ExtensionContext,
    recommendedForWorkspace: boolean
): Promise<positron.LanguageRuntimeMetadata | undefined> {
    try {
        // Generate a unique runtime ID based on the Julia path
        const runtimeId = crypto
            .createHash('sha256')
            .update(juliaExe.file)
            .digest('hex')
            .substring(0, 32)

        // Determine startup behavior
        let startupBehavior: positron.LanguageRuntimeStartupBehavior
        if (recommendedForWorkspace) {
            startupBehavior = positron.LanguageRuntimeStartupBehavior.Immediate
        } else {
            startupBehavior = positron.LanguageRuntimeStartupBehavior.Explicit
        }

        // Determine runtime source
        let runtimeSource = 'Unknown'
        if (juliaExe.channel) {
            runtimeSource = `Juliaup (${juliaExe.channel})`
        } else if (juliaExe.file.includes('Applications')) {
            runtimeSource = 'System'
        } else if (juliaExe.file.includes('AppData')) {
            runtimeSource = 'User'
        } else if (juliaExe.file === 'julia' || juliaExe.file === 'julia.exe') {
            runtimeSource = 'PATH'
        }

        // Get the architecture
        const arch = juliaExe.arch || process.arch

        // Create a short name for the runtime
        const shortName = `${juliaExe.version}${arch ? ` (${arch})` : ''}`

        // Create a full name for the runtime
        const runtimeName = `Julia ${shortName}`

        // Load the Julia icon (we'll use a base64-encoded SVG)
        const iconPath = path.join(context.extensionPath, 'images', 'julia-logo.svg')
        let base64EncodedIconSvg: string | undefined
        if (fs.existsSync(iconPath)) {
            const iconData = fs.readFileSync(iconPath, 'utf8')
            base64EncodedIconSvg = Buffer.from(iconData).toString('base64')
        }

        // Create extra runtime data
        const extraRuntimeData: JuliaRuntimeExtraData = {
            juliaPath: juliaExe.file,
            juliaVersion: juliaExe.version,
            juliaArgs: juliaExe.args,
            arch: arch,
            channel: juliaExe.channel
        }

        // Create and return the metadata
        const metadata: positron.LanguageRuntimeMetadata = {
            runtimeId: runtimeId,
            runtimeName: runtimeName,
            runtimeShortName: shortName,
            runtimePath: juliaExe.file,
            runtimeVersion: '1.0.0', // Extension version
            runtimeSource: runtimeSource,
            languageName: 'Julia',
            languageId: 'julia',
            languageVersion: juliaExe.version,
            base64EncodedIconSvg: base64EncodedIconSvg,
            startupBehavior: startupBehavior,
            sessionLocation: positron.LanguageRuntimeSessionLocation.Workspace,
            extraRuntimeData: extraRuntimeData
        }

        return metadata
    } catch (error) {
        console.error('Error creating Julia runtime metadata:', error)
        return undefined
    }
}
