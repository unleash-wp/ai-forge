// The white brand bar: UnleashWP wordmark + "Forge" + credential status pills.
import { LOGO_FULL } from '../brand.js';

export default function Header({ headerRef, scrolled, ghSet, tracSet, onToggleSetup }) {
  return (
    <header ref={headerRef} className={'c-header' + (scrolled ? ' is-scrolled' : '')}>
      <div className="c-header__bar">
        <a className="c-logo" href="https://unleash-wp.com" target="_blank" rel="noopener" aria-label="UnleashWP" dangerouslySetInnerHTML={{ __html: LOGO_FULL }} />
        <span className="c-header__divider" />
        <a href="#" className="c-header__product" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Forge</a>
        <div className="c-header__pills">
          <button className={'c-pill ' + (ghSet ? 'is-ok' : 'is-off')} onClick={onToggleSetup}><span className="c-pill__ic" />GitHub</button>
          <button className={'c-pill ' + (tracSet ? 'is-ok' : 'is-off')} onClick={onToggleSetup}><span className="c-pill__ic" />Trac</button>
        </div>
      </div>
    </header>
  );
}
