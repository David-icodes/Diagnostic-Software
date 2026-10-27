/** Legacy rows with no collection pin remain valid only on legacy unpinned orders. */
export function currentCollectionResult(row:{superseded?:boolean;collectionId?:unknown},activeCollectionId:unknown):boolean{
 return row.superseded!==true&&String(row.collectionId??'')===String(activeCollectionId??'');
}
