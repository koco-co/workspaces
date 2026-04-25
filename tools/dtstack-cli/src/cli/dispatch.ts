export async function dispatchCommand(args: string[]): Promise<void> {
  throw new Error(`command not implemented: ${args.join(" ")}`);
}
