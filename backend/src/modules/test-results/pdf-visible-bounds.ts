import {pathToFileURL} from 'node:url';
export interface VisiblePdfBox {left:number;bottom:number;right:number;top:number;}
/** Only raster-verified white margins are trimmed; keep every coloured mark.
 * Unsupported pages fall back to their complete original crop box. */
export async function visiblePdfBoxes(bytes:Buffer):Promise<(VisiblePdfBox|undefined)[]> {
 const nativeImport=new Function('specifier','return import(specifier)') as (specifier:string)=>Promise<any>;
 let document:any;
 try{
  const canvas=await nativeImport(pathToFileURL(require.resolve('@napi-rs/canvas')).href),pdfjs=await nativeImport(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
  document=await pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true,disableFontFace:true,disableAutoFetch:true,disableStream:true}).promise;
  const boxes:(VisiblePdfBox|undefined)[]=[],deadline=Date.now()+25000;
  for(let index=1;index<=document.numPages;index++){
   if(Date.now()>deadline){boxes.push(undefined);continue;}
   let page:any,timer:ReturnType<typeof setTimeout>|undefined;
   try{
    page=await document.getPage(index);const base=page.getViewport({scale:1,rotation:0}),scale=Math.min(1.5,1200/Math.max(base.width,base.height)),view=page.getViewport({scale,rotation:0});
    const surface=canvas.createCanvas(Math.ceil(view.width),Math.ceil(view.height)),context=surface.getContext('2d'),task=page.render({canvasContext:context,canvas:surface,viewport:view,background:'rgb(255,255,255)'});timer=setTimeout(()=>task.cancel(),2500);await task.promise;
    const {width,height,data}=context.getImageData(0,0,surface.width,surface.height);let minX=width,minY=height,maxX=-1,maxY=-1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;if(data[i]<255||data[i+1]<255||data[i+2]<255){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}}
    if(maxX<0){boxes.push(undefined);continue;}
    const pad=6,box=page.view,sx=view.width/(box[2]-box[0]),sy=view.height/(box[3]-box[1]);
    let left=box[0]+minX/sx,right=box[0]+(maxX+1)/sx,bottom=box[3]-(maxY+1)/sy,top=box[3]-minY/sy;
    // Text geometry is an additional conservative guard if a local font cannot render.
    const text=await page.getTextContent();for(const item of text.items){if(!item.str?.trim()||!item.transform)continue;const [a,b,c,d,x,y]=item.transform,angle=Math.atan2(b,a),cos=Math.cos(angle),sin=Math.sin(angle),w=Math.abs(item.width??0),h=Math.max(Math.abs(item.height??0),Math.hypot(c,d));for(const distance of [0,w])for(const normal of [-h,h]){const tx=x+cos*distance-sin*normal,ty=y+sin*distance+cos*normal;left=Math.min(left,tx);right=Math.max(right,tx);bottom=Math.min(bottom,ty);top=Math.max(top,ty);}}
    boxes.push({left:Math.max(box[0],left-pad),right:Math.min(box[2],right+pad),bottom:Math.max(box[1],bottom-pad),top:Math.min(box[3],top+pad)});
   }catch{boxes.push(undefined);}finally{if(timer)clearTimeout(timer);try{page?.cleanup();}catch{}}
  }return boxes;
 }catch{return [];}finally{try{await document?.destroy();}catch{}}
}
