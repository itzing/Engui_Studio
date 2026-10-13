import { NextRequest, NextResponse } from 'next/server';
import { withWorkspaceRoute } from '@/lib/workspaces/route';
import { resolveCharacterLook } from '@/lib/outfits/server';
import { buildLookPreviewPrompt } from '@/lib/outfits/previewPrompt';
import { compileVisibleLook } from '@/lib/looks/compiler';
import { normalizeFraming } from '@/lib/looks/parts';
import { normalizeCharacterPreviewSlot } from '@/lib/characters/previews';
export const POST = withWorkspaceRoute(async (request: NextRequest, context: { params: Promise<{id:string}> }) => {
 try {
  const body=await request.json();
  const look=await resolveCharacterLook((await context.params).id,body);
  if(body.slot!==undefined){
   const slot=normalizeCharacterPreviewSlot(body.slot);
   if(!slot) return NextResponse.json({success:false,error:'A valid preview slot is required'},{status:400});
   return NextResponse.json({success:true,look,prompt:buildLookPreviewPrompt(look,slot),composition:compileVisibleLook(look,normalizeFraming(slot))});
  }
  return NextResponse.json({success:true,look});
 } catch(e:any) {return NextResponse.json({success:false,error:e.message},{status:e.status||422});}
}, 'content');
