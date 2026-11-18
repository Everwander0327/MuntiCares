import { describe,expect,it,vi } from 'vitest';
import {focusOnLocation} from './mapStyles';
describe('location focus camera',()=>{
 it('uses an eased pan instead of a flyTo arc that zooms out',()=>{
 const map={getZoom:()=>18,getCenter:()=>({}),project:()=>({x:0,y:0}),getContainer:()=>({clientWidth:600,clientHeight:600}),flyTo:vi.fn(),easeTo:vi.fn(),jumpTo:vi.fn()};
 focusOnLocation(map,[121,14.4]);expect(map.flyTo).not.toHaveBeenCalled();expect(map.easeTo).toHaveBeenCalledWith(expect.objectContaining({center:[121,14.4],zoom:18}));
 });
});
