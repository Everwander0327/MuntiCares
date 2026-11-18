import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const f=vi.hoisted(()=>({maps:[],reverse:vi.fn()}));
vi.mock('maplibre-gl',()=>({setWorkerUrl:vi.fn(),AttributionControl:class {},Map:class {
 constructor(options){this.center={lat:options.center[1],lng:options.center[0]};this.events={};this.canvas=document.createElement('div');f.maps.push(this);}
 on(name,cb){(this.events[name] ||= []).push(cb);return this;} off(){} emit(name){this.events[name]?.forEach(cb=>cb());}
 getCenter(){return this.center;} getCanvasContainer(){return this.canvas;} addControl(){} resize(){} remove(){}
 setPadding(){this.emit('movestart');this.emit('moveend');} setStyle(){}
}}));
vi.mock('@/contexts/ThemeContext',()=>({useTheme:()=>({dark:false})}));
vi.mock('@/contexts/LanguageContext',()=>({useLanguage:()=>({t:key=>key})}));
vi.mock('@/features/tracking/services/geocoding',()=>({reverseGeocode:f.reverse}));
vi.mock('@/features/tracking/components/CenterMapPin',()=>({default:()=>null}));
vi.mock('@/features/tracking/components/BasemapControl',()=>({default:()=>null}));
import ModernLocationPicker from '@/features/tracking/components/ModernLocationPicker';
beforeEach(()=>vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();f.maps=[];f.reverse.mockReset();});
describe('shared location picker',()=>{
 it('does not turn a padding-only change into a new pin lookup',()=>{
  const changed=vi.fn();const view=render(<ModernLocationPicker initial={{lat:14.4,lng:121}} onPinChange={changed} fullBleed hudInsets={{top:20,bottom:100}}/>);
  changed.mockClear();view.rerender(<ModernLocationPicker initial={{lat:14.4,lng:121}} onPinChange={changed} fullBleed hudInsets={{top:40,bottom:180}}/>);
  expect(changed).not.toHaveBeenCalled();
 });
 it('ignores an older address response after the map has moved',async()=>{
  vi.useFakeTimers();let resolveA,resolveB;
  f.reverse.mockImplementationOnce(()=>new Promise(r=>{resolveA=r;})).mockImplementationOnce(()=>new Promise(r=>{resolveB=r;}));
  const changed=vi.fn();render(<ModernLocationPicker onPinChange={changed}/>);
  const map=f.maps[0];
  act(()=>{map.emit('dragstart');map.center={lat:14.4,lng:121};map.emit('move');map.emit('moveend');vi.advanceTimersByTime(350);});
  act(()=>{map.center={lat:14.42,lng:121.02};map.emit('move');map.emit('moveend');vi.advanceTimersByTime(350);});
  await act(async()=>{resolveB('New address');});
  await act(async()=>{resolveA('Old address');});
  expect(changed.mock.calls.at(-1)[0]).toMatchObject({lat:14.42,lng:121.02,address:'New address'});
 });
});

