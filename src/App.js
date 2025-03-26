import React from 'react';
import { ThemeProvider } from './components/theme-provider';
import { ThemeToggle } from './components/theme-toggle';
import WarcraftLogsReport from './WarcraftLogsReport';
import './App.css';

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <div className="min-h-screen bg-background text-foreground">
        <header className="container mx-auto py-4 flex justify-end">
          <ThemeToggle />
        </header>
        <div className="container mx-auto py-4">
          <WarcraftLogsReport />
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;