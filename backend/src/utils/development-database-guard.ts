export const DEVELOPMENT_DATABASE = "diagnostic_lis_development_20261012";
export const DEVELOPMENT_URI = `mongodb://127.0.0.1:27017/${DEVELOPMENT_DATABASE}`;
export function assertDevelopmentDatabase(environment: string | undefined, uri: string | undefined, selectedName?: string): void {
 if (environment !== "development" || uri !== DEVELOPMENT_URI || (selectedName !== undefined && selectedName !== DEVELOPMENT_DATABASE)) {
  throw new Error("Development initialization requires the exact isolated loopback database and development environment");
 }
}
