import { openBridgeLink, validateBridgeLink } from '../bridge-link';

const SITE = 'https://studio.example.com';
const TOKEN = 'abcDEF123_-xyz7890';

describe('validateBridgeLink', () => {
  it.each([
    [`${SITE}/w#bridge=4455&token=${TOKEN}`],
    [`${SITE}/w/#bridge=4455&token=${TOKEN}`],
    [`http://127.0.0.1:4455/w/#bridge=4455&token=${TOKEN}`],
    [`http://localhost:4455/w/#bridge=4455&token=${TOKEN}`],
    [`  ${SITE}/w#bridge=4455&token=${TOKEN}  `],
  ])('accepts %s', (link) => {
    expect(validateBridgeLink(link, SITE)).toEqual({ ok: true, href: link.trim() });
  });

  it('asks for the link when the field is empty', () => {
    expect(validateBridgeLink('   ', SITE)).toEqual({ ok: false, reason: 'empty' });
  });

  it.each([
    ['not a url'],
    [`${SITE}/w#bridge=4455`],
    [`${SITE}/w#bridge=4455&token=short`],
    [`${SITE}/w#bridge=99999&token=${TOKEN}`],
    [`${SITE}/w#bridge=4455&token=${TOKEN.slice(0, 10)}!@#$%^&*()`],
    [`https://user:pass@studio.example.com/w#bridge=4455&token=${TOKEN}`],
  ])('rejects the malformed link %s', (link) => {
    expect(validateBridgeLink(link, SITE)).toEqual({ ok: false, reason: 'format' });
  });

  it.each([
    [`https://evil.example/w#bridge=4455&token=${TOKEN}`],
    [`${SITE}/elsewhere#bridge=4455&token=${TOKEN}`],
    [`http://127.0.0.1:5000/w/#bridge=4455&token=${TOKEN}`],
    [`https://127.0.0.1:4455/w/#bridge=4455&token=${TOKEN}`],
    [`http://192.168.0.10:4455/w/#bridge=4455&token=${TOKEN}`],
    [`http://127.0.0.1:4455/other/#bridge=4455&token=${TOKEN}`],
  ])('rejects the link from another place %s', (link) => {
    expect(validateBridgeLink(link, SITE)).toEqual({ ok: false, reason: 'origin' });
  });
});

describe('openBridgeLink', () => {
  const fakeWindow = (href: string) => ({ location: { href, assign: vi.fn(), reload: vi.fn() } });

  it('navigates to another page without reloading', () => {
    const win = fakeWindow(`${SITE}/`);
    openBridgeLink(`${SITE}/w#bridge=4455&token=${TOKEN}`, win);
    expect(win.location.assign).toHaveBeenCalledWith(`${SITE}/w#bridge=4455&token=${TOKEN}`);
    expect(win.location.reload).not.toHaveBeenCalled();
  });

  it('reloads when only the hash changes so the pairing is read again', () => {
    const win = fakeWindow(`${SITE}/w/`);
    openBridgeLink(`${SITE}/w/#bridge=4455&token=${TOKEN}`, win);
    expect(win.location.assign).toHaveBeenCalledOnce();
    expect(win.location.reload).toHaveBeenCalledOnce();
  });
});
