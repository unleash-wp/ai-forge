// Chakra provider + colour-mode. next-themes drives colour mode from the system
// preference (matching the app's previous prefers-color-scheme behaviour); the
// Chakra system supplies the Forge tokens. Wrap the whole app in this.
import { ChakraProvider } from '@chakra-ui/react';
import { ThemeProvider } from 'next-themes';
import { system } from '../theme.js';

export function Provider({ children }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
      </ThemeProvider>
    </ChakraProvider>
  );
}
