import "server-only";

// Single-user for now. Every query is already scoped by owner, so adding
// Neon Auth later means only changing this function to return the signed-in
// user's id (and throwing when there is none).
export async function getOwnerId(): Promise<string> {
  return process.env.OWNER_ID ?? "me";
}
