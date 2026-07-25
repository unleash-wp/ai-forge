// The white brand bar: UnleashWP wordmark + "Forge" + credential status pills.
import { LOGO_FULL } from '../brand.js';

export default function Header({ headerRef, scrolled, ghSet, tracSet, onToggleSetup }) {
  return (
    <header ref={headerRef} className={'header' + (scrolled ? ' header--scrolled' : '')}>
      <div className="header__bar">
        <a className="logo" href="https://unleash-wp.com" target="_blank" rel="noopener" aria-label="UnleashWP" dangerouslySetInnerHTML={{ __html: LOGO_FULL }} />
        <span className="header__divider" />
        <a href="#" className="header__product" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Forge</a>
        <div className="header__pills">
          <button className={'pill ' + (ghSet ? 'pill--ok' : 'pill--off')} onClick={onToggleSetup}><span className="pill__ic" />GitHub</button>
          <button className={'pill ' + (tracSet ? 'pill--ok' : 'pill--off')} onClick={onToggleSetup}><span className="pill__ic" />Trac</button>
        </div>
      </div>
    </header>
  );
}
