import { network } from "hardhat";

export async function takeSnapshot(): Promise<number> {
  return network.provider.send("evm_snapshot", []);
}

export async function revertToSnapShot(id: number): Promise<void> {
  await network.provider.send("evm_revert", [id]);
}
