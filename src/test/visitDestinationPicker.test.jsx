import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,describe,expect,it,vi } from 'vitest';
vi.mock('@/contexts/LanguageContext',()=>({useLanguage:()=>({t:key=>key})}));
vi.mock('@/hooks/useBodyScrollLock',()=>({default:()=>{}}));
vi.mock('@/hooks/useBottomDrawerDrag',()=>({default:()=>({drawerMotionProps:{},dragHandleProps:{}})}));
vi.mock('@/features/tracking/components/ModernLocationPicker',async()=>{const React=await import('react');return {default:React.forwardRef(function Mock(){return null;})};});
vi.mock('@/features/tracking/components/AddressAutocomplete',()=>({default:()=>null}));
import VisitDestinationModal from '@/features/tracking/components/VisitDestinationModal';
afterEach(cleanup);
describe('destination picker draft',()=>{
 it('stays on details when the parent echoes an equivalent initial pin',()=>{
  const pin={lat:14.4,lng:121,address:'Chosen address'};
  const view=render(<VisitDestinationModal isOpen initial={pin}/>);
  fireEvent.click(screen.getByRole('button',{name:'tracking.dest.addGateDetails'}));
  expect(screen.queryByRole('button',{name:'tracking.dest.addGateDetails'})).not.toBeInTheDocument();
  view.rerender(<VisitDestinationModal isOpen initial={{...pin}}/>);
  expect(screen.queryByRole('button',{name:'tracking.dest.addGateDetails'})).not.toBeInTheDocument();
 });
});
