/** Verified Wilco test 2707, count rows 1296/1298/1299. Smear narratives
 * (1307/1308/1309), similar names and the separate biochemistry CBP are excluded. */
const countIds = new Set(["ffb3e9c48662cc43921fa48d", "2db8e6a9befd3a1950148465", "8bb125bcc1b581978287edf4"]);
export function cbcCountValueOnly(parameter: {
  id?: string; _id?: unknown; reportValueOnly?: boolean;
  lineage?: { originalId?: string };
  catalogueImport?: { sourceTestId?: string; sourceParameterId?: string };
}): boolean {
  const source = parameter.catalogueImport;
  return parameter.reportValueOnly === true || countIds.has(parameter.lineage?.originalId ?? String(parameter.id ?? parameter._id ?? "")) ||
    (source?.sourceTestId === "2707" && ["1296", "1298", "1299"].includes(source.sourceParameterId ?? ""));
}

/** Verified smear rows in Wilco test2707. Only suppress empty placeholders;
 * configured clinical metadata and numeric zero remain untouched. */
export function cbcSmearEmptyCells(parameter:Parameters<typeof cbcCountValueOnly>[0]):boolean{
 const source=parameter.catalogueImport;
 return ["a5e2832bd0c5046e0ebaa1eb","2b439c190dd60f3ac1303154","7a56a5ec7843e73cb6b21d26"].includes(parameter.lineage?.originalId??String(parameter.id??parameter._id??"")) ||
  source?.sourceTestId==="2707" && ["1307","1308","1309"].includes(source.sourceParameterId??"");
}
export function reportCellText(value:unknown,blankWhenMissing:boolean):string{
 return value===undefined||value===null||String(value).trim()==="" ? (blankWhenMissing?"":"—") : String(value);
}
