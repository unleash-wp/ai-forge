// The white brand bar: UnleashWP wordmark + "Forge" + credential status pills.
import { LOGO_FULL } from '../brand.js';

export default function Header({ headerRef, scrolled, ghSet, tracSet, onToggleSetup }) {
  return (
    <header ref={headerRef} className={scrolled ? 'scrolled' : ''}>
      <div className="bar">
        <a className="logo" href="https://unleash-wp.com" target="_blank" rel="noopener" aria-label="UnleashWP" dangerouslySetInnerHTML={{ __html: LOGO_FULL }} />
        <span className="divider" />
        <a href="#" className="product" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Forge</a>
        <div className="pills">
          <button className={'pill ' + (ghSet ? 'ok' : 'off')} onClick={onToggleSetup}><span className="ic" />GitHub</button>
          <button className={'pill ' + (tracSet ? 'ok' : 'off')} onClick={onToggleSetup}><span className="ic" />Trac</button>
        </div>
      </div>
    </header>
  );
}
