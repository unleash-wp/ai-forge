// Brand SVGs imported as raw markup strings (webpack asset/source) and inlined
// into components. Strips the XML prolog exactly as the server used to.
import logoFull from '../brand/unleashwp-logo-full.svg';
import logoWhite from '../brand/unleashwp-logo-white.svg';

const strip = (s) => s.replace(/<\?xml[^?]*\?>/, '').trim();

export const LOGO_FULL = strip(logoFull);
export const LOGO_WHITE = strip(logoWhite);
