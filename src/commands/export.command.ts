import * as program from 'commander';
import * as inquirer from 'inquirer';
import { ProtectedValue } from 'kdbxweb';

import { CryptoService } from 'jslib/abstractions/crypto.service';
import { ExportService } from 'jslib/abstractions/export.service';
import { ExportKdbxService } from 'jslib/abstractions/exportKdbx.service';

import { Response } from '../models/response';
import { MessageResponse } from '../models/response/messageResponse';

import { CliUtils } from '../utils';

export class ExportCommand {
    constructor(
        private cryptoService: CryptoService,
        private exportService: ExportService | ExportKdbxService,
    ) {}

    async run(password: string, cmd: program.Command): Promise<Response> {
        const format: 'kdbx' | 'csv' | 'json' = cmd.format || 'csv';
        if (password == null || password === '') {
            const answer: inquirer.Answers = await inquirer.createPromptModule({ output: process.stderr })({
                type: 'password',
                name: 'password',
                message: 'Master password:',
            });
            password = answer.password;
        }
        if (password == null || password === '') {
            return Response.badRequest('Master password is required.');
        }

        const keyHash = await this.cryptoService.hashPassword(password, null);
        const storedKeyHash = await this.cryptoService.getKeyHash();
        if (storedKeyHash != null && keyHash != null && storedKeyHash === keyHash) {
            if (format === 'kdbx') {
                let filePassword;
                if (cmd.filePassword && cmd.filePassword === true) {
                    const answer: inquirer.Answers = await inquirer.createPromptModule({ output: process.stderr })({
                        type: 'password',
                        name: 'password',
                        message: 'Kdbx file password:',
                    });
                    filePassword = ProtectedValue.fromString(answer.password);
                } else if (cmd.filePassword) {
                    filePassword = ProtectedValue.fromString(cmd.filePassword);
                } else {
                    filePassword = ProtectedValue.fromString(password);
                }
                const kdbx = await (this
                    .exportService as ExportKdbxService).getExport(filePassword);
                return await this.saveFile(Buffer.from(kdbx), cmd);
            } else {
                const csv = await (this.exportService as ExportService).getExport(format);
                return await this.saveFile(csv, cmd);
            }
        } else {
            return Response.error('Invalid master password.');
        }
    }

    async saveFile(data: string | Buffer, cmd: program.Command): Promise<Response> {
        try {
            const filePath = await CliUtils.saveFile(data, cmd.output, this.exportService.getFileName());
            const res = new MessageResponse('Saved ' + filePath, null);
            res.raw = filePath;
            return Response.success(res);
        } catch (e) {
            return Response.error(e.toString());
        }
    }
}
