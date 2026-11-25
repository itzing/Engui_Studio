/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopPreviewImage } from '@/components/layout/DesktopPreviewImage';

class Request {
  static all: Request[] = [];
  onprogress: ((e: {lengthComputable:boolean;loaded:number;total:number}) => void) | null = null;
  onload: (()=>void) | null = null;
  onerror: (()=>void) | null = null;
  ontimeout: (()=>void) | null = null;
  status=200; response=new Blob(['image']); responseType='';
  open=vi.fn(); send=vi.fn(); abort=vi.fn(); setRequestHeader=vi.fn();
  constructor(){Request.all.push(this);}
  progress(loaded:number,total=0){act(()=>this.onprogress?.({lengthComputable:total>0,loaded,total}));}
  finish(){act(()=>this.onload?.());}
}
const props={src:'/images/a.png',alt:'Current preview',className:'object-contain',workspaceId:'workspace-a'};
const element=(changes:Partial<typeof props>&{key?:string}={})=>React.createElement(DesktopPreviewImage,{...props,...changes});
const last=()=>Request.all.at(-1)!;
const ready=()=>{last().finish();fireEvent.load(screen.getByAltText(props.alt));};
beforeEach(()=>{Request.all=[];vi.stubGlobal('XMLHttpRequest',Request);let seq=0;vi.stubGlobal('URL',class extends URL {static createObjectURL=vi.fn(()=>`blob:fixture-${++seq}`);static revokeObjectURL=vi.fn();});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

describe('Desktop current-image loading',()=>{
 it('shows honest download progress and waits for image load before revealing it',()=>{
  render(element());expect(screen.queryByRole('img')).toBeNull();expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBeNull();
  last().progress(30,100);expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('30');
  last().finish();const img=screen.getByAltText(props.alt);expect(img.style.visibility).toBe('hidden');expect(screen.getByText('Preparing image…')).toBeTruthy();
  fireEvent.load(img);expect(img.style.visibility).toBe('visible');expect(screen.queryByRole('progressbar')).toBeNull();
 });
 it('immediately removes old pixels on selection and ignores late callbacks',()=>{
  const view=render(element());ready();const old=last(),late=old.onload!;
  view.rerender(element({src:'/images/b.png'}));expect(screen.queryByAltText(props.alt)).toBeNull();expect(old.abort).toHaveBeenCalled();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture-1');
  act(()=>late());expect(screen.queryByAltText(props.alt)).toBeNull();ready();expect(screen.getByAltText(props.alt).getAttribute('src')).toBe('blob:fixture-2');
 });
 it('cancels rapid pending navigation without starting a stale image decode',()=>{
  const view=render(element());const first=last(),late=first.onload!;
  view.rerender(element({src:'/images/b.png'}));const second=last();view.rerender(element({src:'/images/c.png'}));
  act(()=>late());expect(first.abort).toHaveBeenCalled();expect(second.abort).toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();ready();
 });
 it('resets even when two Jobs reference the same URL',()=>{
  const view=render(element({key:'job-a'}));ready();view.rerender(element({key:'job-b'}));expect(screen.queryByAltText(props.alt)).toBeNull();expect(Request.all).toHaveLength(2);
 });
 it('keeps unknown-length transfers indeterminate rather than inventing percentages',()=>{
  render(element());last().progress(200);expect(screen.getByText('Loading image…')).toBeTruthy();expect(screen.getByRole('progressbar').hasAttribute('aria-valuenow')).toBe(false);
 });
 it.each(['network','http','empty','decode'])('shows retry after %s failure without showing old content',kind=>{
  render(element());const req=last();
  if(kind==='network')act(()=>req.onerror?.());
  if(kind==='http'){req.status=404;req.finish();}
  if(kind==='empty'){req.response=new Blob([]);req.finish();}
  if(kind==='decode'){req.finish();fireEvent.error(screen.getByAltText(props.alt));}
  expect(screen.getByRole('alert').textContent).toBe('Could not load image.');expect(screen.queryByRole('img')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));expect(Request.all).toHaveLength(2);expect(screen.queryByRole('alert')).toBeNull();ready();expect(screen.getByRole('img')).toBeTruthy();
 });
 it('handles a cached response with no progress event',()=>{render(element());ready();expect(screen.queryByRole('progressbar')).toBeNull();});
 it.each(['https://external.example/image.png','data:image/png;base64,AAAA','blob:http://localhost/fixture'])('retains native loading for %s without introducing CORS requirements',src=>{
  render(element({src}));expect(Request.all).toHaveLength(0);const img=screen.getByAltText(props.alt);expect(img.getAttribute('src')).toBe(src);expect(img.style.visibility).toBe('hidden');fireEvent.load(img);expect(img.style.visibility).toBe('visible');
 });
 it('scopes API images and releases the old workspace image on switch',()=>{
  const view=render(element({src:'/api/image'}));expect(last().setRequestHeader).toHaveBeenCalledWith('X-Workspace-Id','workspace-a');ready();
  view.rerender(element({src:'/api/image',workspaceId:'workspace-b'}));expect(last().setRequestHeader).toHaveBeenCalledWith('X-Workspace-Id','workspace-b');expect(screen.queryByAltText(props.alt)).toBeNull();
 });
 it('Fit/1:1 and prompt changes do not restart the same image download',()=>{
  const view=render(element());ready();view.rerender(element({className:'max-w-none',alt:'New caption'}));expect(Request.all).toHaveLength(1);expect(screen.getByRole('img').className).toBe('max-w-none');
 });
 it('aborts pending work and revokes owned URLs on unmount',()=>{
  const view=render(element());ready();view.unmount();expect(last().abort).toHaveBeenCalled();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fixture-1');
 });
});
