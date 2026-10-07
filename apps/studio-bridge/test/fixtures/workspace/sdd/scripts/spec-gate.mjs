const args = process.argv.slice(2);
console.log(`gate ${args.join(' ')}`);
if (args[0] === 'blocked') {
  console.error('blocked');
  process.exit(1);
}
