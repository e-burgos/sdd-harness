import { agentMeta } from './agents';

describe('agentMeta', () => {
  it('knows the kit agents', () => {
    expect(agentMeta('sdd-implementor-back')).toEqual({ id: 'sdd-implementor-back', name: 'Impl-back', short: 'IB', color: '#fbbf24' });
  });
  it('derives a label for unknown agents', () => {
    expect(agentMeta('Explore')).toEqual({ id: 'Explore', name: 'Explore', short: 'EX', color: '#a1a1aa' });
    expect(agentMeta('sdd-custom')).toMatchObject({ name: 'custom', short: 'CU' });
  });
});
