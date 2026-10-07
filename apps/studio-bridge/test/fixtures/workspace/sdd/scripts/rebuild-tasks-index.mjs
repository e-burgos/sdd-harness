// Writes a multi-byte UTF-8 string split mid-character across two writes.
const bytes = Buffer.from('ñandú ✓\n', 'utf8');
process.stdout.write(bytes.subarray(0, 1));
setTimeout(() => process.stdout.write(bytes.subarray(1)), 60);
