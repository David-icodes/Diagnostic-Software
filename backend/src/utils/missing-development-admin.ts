import { assertDevelopmentDatabase } from "./development-database-guard";

export interface DevelopmentAdminStore {
  database: string;
  hasReadyOwnership(): Promise<boolean>;
  usernames(): Promise<string[]>;
  insert(user: { username: string; name: string; role: "admin"; status: "active"; passwordHash: string }): Promise<void>;
}

/** Insert only: never updates an existing user or changes credentials. */
export async function provisionMissingDevelopmentAdmin(
  context: { environment?: string; uri?: string; username: string; password: string; name: string },
  store: DevelopmentAdminStore,
  hash: (password: string) => Promise<string>,
) {
  assertDevelopmentDatabase(context.environment, context.uri, store.database);
  const username = context.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,50}$/.test(username) || context.password.length < 6 || !context.name.trim()) throw new Error("Invalid configured development administrator");
  if (!await store.hasReadyOwnership()) throw new Error("Development ownership is not established");
  if ((await store.usernames()).some(existing => existing.trim().toLowerCase() === username)) throw new Error("Administrator already exists; preserve credentials");
  const passwordHash = await hash(context.password);
  if (!/^\$2[aby]\$/.test(passwordHash)) throw new Error("Expected bcrypt password hash");
  await store.insert({ username, name: context.name.trim(), role: "admin", status: "active", passwordHash });
}
