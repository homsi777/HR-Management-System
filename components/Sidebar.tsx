import React from 'react';
import { Page } from '../types';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
}

// This component has been deprecated and its functionality is now handled by the Navbar component.
// It is kept to avoid breaking imports but no longer renders any UI.
const Sidebar: React.FC<SidebarProps> = () => {
  return null;
};

export default Sidebar;