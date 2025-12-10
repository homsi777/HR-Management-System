import React from 'react';

interface HeaderProps {
    title: string;
    onOpenAiAssistant: () => void;
}

// This component is deprecated. Its functionality has been merged into the Navbar component.
// It is kept to avoid breaking imports but no longer renders any UI.
const Header: React.FC<HeaderProps> = () => {
  return null;
};

export default Header;