import { spawn } from 'node:child_process';

/** On win32 `cmd /c start` is not used: cmd splits the URL at `&` and the token is lost. */
export function openCommand(platform: NodeJS.Platform, url: string): { cmd: string; args: string[] } {
  if (platform === 'darwin') return { cmd: 'open', args: [url] };
  if (platform === 'win32') return { cmd: 'rundll32', args: ['url.dll,FileProtocolHandler', url] };
  return { cmd: 'xdg-open', args: [url] };
}

export function openBrowser(url: string): void {
  const { cmd, args } = openCommand(process.platform, url);
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.on('error', () => undefined);
  child.unref();
}
